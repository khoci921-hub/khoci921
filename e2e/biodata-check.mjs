// =============================================================
// E2E BIODATA CHECK — ASJ Portal
// -------------------------------------------------------------
// Menguji alur UPDATE BIODATA kandidat (simpanBiodataLengkap):
//   setup kandidat TES terisolasi (tahapan PEMBERKASAN — syarat modal
//   pemberkasan terbuka) → login lewat UI → buka modal pemberkasan →
//   isi EMAIL / ALAMAT / PERUSAHAAN nilai tes → Simpan → verifikasi
//   tersimpan (UI menampilkan nilai baru) → CLEANUP penuh (hapus row
//   database_candidate / master_database_candidate / pemberkasan).
// Aman: tidak menyentuh data kandidat sungguhan. Catatan: kandidat
// dengan tahapan di luar PEMBERKASAN (mis. LIST) memang DIKUNCI oleh
// pipeline (bukaModalPemberkasan menolak non-admin) — ini perilaku
// yang benar, bukan bug tes.
// Jalankan: BASE_URL=<url> node e2e/biodata-check.mjs
//   (butuh Supabase keys di .env.local / env — dibaca _lib/supabase.js)
// =============================================================
import { check, waitFor as harnessWaitFor, launchBrowser, finish, BASE } from './harness.mjs';
// client.ts is ESM (TS) — use dynamic import
const { supabaseKey, supabaseUrl } = await import('../netlify/functions/_lib/db/client.ts');

// Update biodata butuh sinkronisasi DB — default waitFor 30s.
const waitFor = (c, t, i) => harnessWaitFor(c, t ?? 30000, i);
const TEST_WA =
  process.env.E2E_BIODATA_WA || '62812' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const TEST_PIN = process.env.E2E_BIODATA_PIN || '9912';
const TEST_NAMA = 'E2E BIODATA TEST';

const TES_EMAIL = 'e2e.biodata.test@example.com';
const TES_ALAMAT = 'E2E ALAMAT BIODATA TEST';
const TES_TMPL = 'E2E TEMPAT LAHIR TEST';

// ---- Supabase direct (setup & cleanup kandidat tes) -------------------------
const SB = supabaseUrl().replace(/\/$/, '');
const KEY = supabaseKey();
if (!SB || !KEY) {
  console.error('Supabase belum dikonfigurasi (cek .env.local / Keys).');
  process.exit(1);
}
function sbHeaders() {
  return {
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}
async function sbReq(method, path, query = {}, body) {
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${SB}/rest/v1/${path}${qs ? '?' + qs : ''}`, {
    method,
    headers: sbHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Buka modal pemberkasan + pastikan panel biodata terlihat (Tahap 1).
async function bukaModal(page, wa) {
  await page.evaluate((w) => window.bukaModalPemberkasan(w), wa);
  const opened = await waitFor(async () => await page.locator('#modal-pemberkasan').isVisible());
  await page.evaluate(() => {
    const p = document.getElementById('modal-panel-bio');
    if (p) p.classList.remove('hidden');
  });
  return opened;
}

// Isi form biodata + klik Simpan, tunggu modal tertutup.
async function simpanBiodata(page, { email, alamat, tmplahir }) {
  await page.fill('#bio-email', email);
  await page.fill('#bio-alamat', alamat);
  await page.fill('#bio-tmplahir', tmplahir);
  await page.evaluate(() => document.getElementById('btn-submit-bio').click());
  return waitFor(async () => !(await page.locator('#modal-pemberkasan').isVisible()), 30000);
}

const browser = await launchBrowser();
console.log(`\nTarget: ${BASE} | Kandidat tes: ${TEST_WA}\n`);

try {
  // ---- Setup kandidat tes ---------------------------------------------------
  console.log('SETUP: buat kandidat tes (tahapan PEMBERKASAN)');
  const row = {
    id_kandidat: 'E2E' + Math.floor(Date.now() / 1000),
    nama_lengkap: TEST_NAMA,
    no_wa: TEST_WA,
    password_kandidat: TEST_PIN,
    gender: 'LAKI-LAKI',
    tahapan_seleksi: 'PEMBERKASAN',
    alamat_lengkap: 'Alamat E2E',
    email: 'e2e.origin@example.com',
    created_at: new Date().toISOString(),
  };
  const ins = await sbReq('POST', 'database_candidate', {}, [row]);
  const candId = Array.isArray(ins) && ins[0] ? ins[0].id : null;
  check('Kandidat tes dibuat di database_candidate', !!candId, JSON.stringify(ins).slice(0, 120));

  // ---- TES: update biodata ----------------------------------------------------
  console.log('\nTEST: Update biodata kandidat (simpanBiodataLengkap)');
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  // Matikan Service Worker + cache (kalau host bukan localhost, SW aktif dan
  // controllerchange bisa me-reload halaman di tengah tes).
  await page
    .evaluate(async () => {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    })
    .catch(() => {});
  await page.evaluate(() => window.bukaModalKandidat('login'));
  await waitFor(async () => await page.locator('#form-login-kandidat').isVisible());
  await page.fill('#log-wa', TEST_WA);
  await page.fill('#log-pass', TEST_PIN);
  // click via evaluate: #global-loader bisa menutupi tombol saat proses
  // login, dan modal tertutup tepat saat Playwright mengecek stabilitas
  await page.evaluate(() => document.getElementById('btn-log-kandidat').click());
  const loggedIn = await waitFor(
    async () =>
      await page.evaluate(() => {
        const el = document.getElementById('page-kandidat');
        return el && getComputedStyle(el).display !== 'none';
      }),
  );
  check('Login kandidat tes sukses', loggedIn);
  // Dashboard tampil optimistis — data kandidat (ALL_CANDIDATES) datang
  // belakangan via refreshDataDinamis; tunggu sampai terisi dulu supaya
  // bukaModalPemberkasan menemukan kandidatnya.
  const dataReady = await waitFor(
    async () => (await page.evaluate(() => (window.ALL_CANDIDATES || []).length)) > 0,
    30000,
  );
  check('Data kandidat termuat (ALL_CANDIDATES)', dataReady);

  const modalOpen = await bukaModal(page, TEST_WA);
  check('Modal pemberkasan terbuka (tahapan PEMBERKASAN)', modalOpen);

  // Isi nilai TES → Simpan → modal tertutup
  const saved = await simpanBiodata(page, {
    email: TES_EMAIL,
    alamat: TES_ALAMAT,
    tmplahir: TES_TMPL,
  });
  check('Simpan biodata sukses (modal tertutup)', saved);

  // refreshDataDinamis berjalan async setelah simpan — tunggu data kandidat
  // benar-benar ter-update (bukti tersimpan di DB & ter-fetch ulang).
  const synced = await waitFor(async () => {
    const b = await page.evaluate(() => {
      const c = (window.ALL_CANDIDATES || [])[0];
      return c && c.bio ? c.bio : null;
    });
    return !!b && b.email === TES_EMAIL && b.alamat === TES_ALAMAT && b.tmplahir === TES_TMPL;
  }, 30000);
  check('Biodata tersinkron ke data kandidat (DB + fetch ulang)', synced);

  // Verifikasi: buka lagi → nilai tes tampil (persisted dari DB)
  await bukaModal(page, TEST_WA);
  const persisted = await page.evaluate(() => ({
    email: document.getElementById('bio-email').value,
    alamat: document.getElementById('bio-alamat').value,
    tmplahir: document.getElementById('bio-tmplahir').value,
  }));
  check('EMAIL tes tampil di form', persisted.email === TES_EMAIL, persisted.email);
  check('ALAMAT tes tampil di form', persisted.alamat === TES_ALAMAT, persisted.alamat);
  check('TEMPAT LAHIR tes tampil di form', persisted.tmplahir === TES_TMPL, persisted.tmplahir);
  check('Tidak ada error JS saat simpan biodata', jsErrors.length === 0, jsErrors[0] || '');
  await page.close();
} finally {
  // ---- CLEANUP -----------------------------------------------------------------
  console.log('\nCLEANUP: hapus jejak kandidat tes…');
  const errors = [];
  for (const [table, col] of [
    ['database_candidate', 'no_wa'],
    ['master_database_candidate', 'no_wa'],
    ['pemberkasan_checklist', 'wa'],
    ['database_asj_form', 'no_wa'],
  ]) {
    try {
      await sbReq('DELETE', table, { [col]: 'eq.' + TEST_WA });
    } catch (e) {
      errors.push(table + ': ' + e.message);
    }
  }
  try {
    await sbReq('DELETE', 'database_asj_form', { wa: 'eq.' + TEST_WA });
  } catch {
    /* opsional */
  }
  console.log(
    errors.length ? '  ⚠ cleanup sebagian gagal: ' + errors.join(' | ') : '  ✅ DB bersih',
  );
  await browser.close();
}

finish();
