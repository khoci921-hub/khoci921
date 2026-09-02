// =============================================================
// E2E UPLOAD CHECK — ASJ Portal
// -------------------------------------------------------------
// Menguji JALUR UPLOAD file end-to-end:
//   1. Guard client (upload-guard.js / cekUploadFile):
//      - file ekstensi salah -> alert + input di-reset (TANPA menulis data)
//      - file > batas MB    -> alert + input di-reset
//      - file valid kecil   -> TIDAK ada alert
//   2. Upload pemberkasan END-TO-END dengan KANDIDAT TES TERISOLASI:
//      - insert baris kandidat + master tes (Supabase, service role)
//      - login sebagai kandidat tes lewat UI
//      - upload KTP.pdf + KK.pdf via modal pemberkasan (guard -> base64 ->
//        simpanBerkasTahapan -> Supabase Storage -> PATCH pemberkasan/master
//        + sync mail)
//      - verifikasi: URL tersimpan di DB + status UI "Lihat Dokumen"
//      - CLEANUP penuh: hapus baris DB kandidat tes + file Storage
// Aman: tidak menyentuh data/berkas kandidat sungguhan. Berlaku untuk
// BASE_URL preview (lokal) maupun live.
// Jalankan: BASE_URL=<url> node e2e/upload-check.mjs
//   (butuh Supabase keys di .env.local / env — dibaca oleh _lib/supabase.js)
// =============================================================
import { check, waitFor as harnessWaitFor, launchBrowser, finish, BASE } from './harness.mjs';
// client.ts is ESM (TS) — use dynamic import
const { supabaseKey, supabaseUrl } = await import('../netlify/functions/_lib/db/client.ts');

// Upload butuh waktu lebih lama (base64 + Storage) — default waitFor 40s.
const waitFor = (c, t, i) => harnessWaitFor(c, t ?? 40000, i);
const TEST_WA =
  process.env.E2E_UPLOAD_WA || '62813' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const TEST_PIN = process.env.E2E_UPLOAD_PIN || '9911';
const TEST_NAMA = 'E2E UPLOAD TEST';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'asj-files';
const FOLDER = 'master/E2E_UPLOAD_TEST'; // TEST_NAMA.toUpperCase() sanitasi

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
async function storageList(prefix) {
  const res = await fetch(`${SB}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ prefix, limit: 200, offset: 0 }),
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}
async function storageDelete(path) {
  await fetch(`${SB}/storage/v1/object/${BUCKET}/${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  }).catch(() => {});
}

// ---- File dummy --------------------------------------------------------------
// PDF MINIMAL VALID (xref offset benar) — wajib, karena sejak migrasi Cloudinary
// (2026-08-17) file diupload langsung dari browser ke Cloudinary yang
// MEMVALIDASI isi file (PDF palsu ditolak HTTP 400 "Invalid image file").
const PDF_BYTES = Buffer.from(
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDcyIDcyMCBUZCAoRTJFIFRFU1QgUERGKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMzNCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQwNAolJUVPRgo=',
  'base64',
);
const browser = await launchBrowser();
console.log(`\nTarget: ${BASE} | Kandidat tes: ${TEST_WA}\n`);

try {
  // =============================================================
  // TEST 1 — Guard client (negatif & positif, tanpa menulis data)
  // =============================================================
  {
    console.log('TEST 1: Guard client (upload-guard.js)');
    const page = await browser.newPage();
    const dialogs = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      d.accept();
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await waitFor(async () => (await page.locator('#public-table-body tr').count()) > 0);

    // 1a. Ekstensi salah -> ditolak + input di-reset
    await page.setInputFiles('#file-revisi', {
      name: 'virus.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('MZ fake payload'),
    });
    const extAlert = await waitFor(() => dialogs.length > 0, 8000);
    check('Ekstensi salah -> alert muncul', extAlert, JSON.stringify(dialogs.slice(0, 2)));
    check(
      'Pesan alert menyebut format/ekstensi',
      dialogs.some((m) => /tidak diizinkan|format/i.test(m)),
      dialogs[0] || '',
    );
    const resetExt = await page.evaluate(() => document.getElementById('file-revisi').value === '');
    check('Input di-reset setelah ditolak', resetExt);

    // 1b. Ukuran > batas (3 MB di #file-revisi) -> ditolak
    dialogs.length = 0;
    await page.setInputFiles('#file-revisi', {
      name: 'foto-besar.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(3.2 * 1024 * 1024),
    });
    const sizeAlert = await waitFor(() => dialogs.length > 0, 8000);
    check('File > 3 MB -> alert muncul', sizeAlert, JSON.stringify(dialogs.slice(0, 2)));
    check(
      'Pesan alert menyebut batas MB',
      dialogs.some((m) => /3 MB|terlalu besar/i.test(m)),
      dialogs[0] || '',
    );
    const resetSize = await page.evaluate(
      () => document.getElementById('file-revisi').value === '',
    );
    check('Input di-reset setelah ditolak (ukuran)', resetSize);

    // 1c. File valid kecil -> TIDAK ada alert
    dialogs.length = 0;
    await page.setInputFiles('#file-revisi', {
      name: 'cv-ok.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    });
    await new Promise((r) => setTimeout(r, 1200));
    check('File valid kecil -> tidak ada alert', dialogs.length === 0, dialogs[0] || '');
    await page.close();
  }

  // =============================================================
  // TEST 2 — Setup kandidat tes (Supabase, service role)
  // =============================================================
  let candId = null;
  {
    console.log('\nTEST 2: Setup kandidat tes (terisolasi)');
    const ins = await sbReq('POST', 'database_candidate', {}, [
      {
        id_kandidat: 'E2E' + Math.floor(Date.now() / 1000),
        nama_lengkap: TEST_NAMA,
        no_wa: TEST_WA,
        password_kandidat: TEST_PIN,
        gender: 'LAKI-LAKI',
        tahapan_seleksi: 'PEMBERKASAN',
        alamat_lengkap: 'Alamat E2E',
        created_at: new Date().toISOString(),
      },
    ]);
    candId = Array.isArray(ins) && ins[0] ? ins[0].id : null;
    check('Kandidat tes dibuat di database_candidate', !!candId, JSON.stringify(ins).slice(0, 120));

    await sbReq('POST', 'master_database_candidate', {}, [
      {
        id_kandidat: 'E2E' + Math.floor(Date.now() / 1000),
        nama_lengkap: TEST_NAMA,
        no_wa: TEST_WA,
        gender: 'LAKI-LAKI',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  }

  // =============================================================
  // TEST 3 — Upload pemberkasan end-to-end (login kandidat tes)
  // =============================================================
  {
    console.log('\nTEST 3: Upload pemberkasan end-to-end');
    const page = await browser.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(String(e)));

    // Login sebagai kandidat tes
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

    // Buka modal pemberkasan (kandidat tsb ada di ALL_CANDIDATES)
    await page.evaluate((wa) => window.bukaModalPemberkasan(wa), TEST_WA);
    const modalOpen = await waitFor(
      async () => await page.locator('#modal-pemberkasan').isVisible(),
    );
    check('Modal pemberkasan terbuka', modalOpen);
    // Tahapan = PEMBERKASAN -> panel T1 terbuka; pastikan defensif
    await page.evaluate(() => {
      const p = document.getElementById('modal-panel-t1');
      if (p) p.classList.remove('hidden');
    });

    // Pilih 2 berkas: KTP.pdf + KK.pdf (keduanya accept .pdf -> FileReader
    // biasa -> uploadBase64). Label KK/KTP punya mapping DB yang pasti
    // (kk_url/ktp_url di pemberkasan & master).
    await page.setInputFiles('#berkas-ktp', {
      name: 'KTP.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    });
    await page.setInputFiles('#berkas-kk', {
      name: 'KK.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    });

    await page.click('#btn-upload-t1');
    const closed = await waitFor(
      async () => !(await page.locator('#modal-pemberkasan').isVisible()),
      60000,
    );
    check('Upload selesai -> modal tertutup', closed);

    // refreshDataDinamis berjalan async setelah upload — tunggu berkas
    // benar-benar ter-attach ke data kandidat (bukti tersimpan + fetch ulang).
    const berkasSynced = await waitFor(async () => {
      const b = await page.evaluate(() => {
        const c = (window.ALL_CANDIDATES || [])[0];
        return c && c.berkas ? c.berkas : null;
      });
      // URL Cloudinary: nama file dipertahankan (ktp/kk, case insensitive).
      return (
        !!b &&
        String(b.ktp || '')
          .toLowerCase()
          .includes('ktp') &&
        String(b.kk || '')
          .toLowerCase()
          .includes('kk')
      );
    }, 30000);
    check('Berkas tersinkron ke data kandidat (DB + fetch ulang)', berkasSynced);

    // Verifikasi UI: status KTP & KK jadi "Lihat Dokumen"
    await page.evaluate((wa) => window.bukaModalPemberkasan(wa), TEST_WA);
    const ktpSt = await waitFor(async () =>
      (
        await page
          .locator('#st-ktp')
          .innerHTML()
          .catch(() => '')
      ).includes('bukaPreviewDokumen'),
    );
    const kkSt = await waitFor(async () =>
      (
        await page
          .locator('#st-kk')
          .innerHTML()
          .catch(() => '')
      ).includes('bukaPreviewDokumen'),
    );
    check('Status UI KTP = Lihat Dokumen', ktpSt);
    check('Status UI KK = Lihat Dokumen', kkSt);
    check('Tidak ada error JS saat upload', jsErrors.length === 0, jsErrors[0] || '');
    await page.close();

    // Verifikasi DB: pemberkasan_checklist + master ter-update
    const pRows = await sbReq('GET', 'pemberkasan_checklist', {
      select: '*',
      wa: 'eq.' + TEST_WA,
      limit: '5',
    });
    const pRow = (Array.isArray(pRows) ? pRows : []).find((r) => r.wa === TEST_WA);
    check(
      'pemberkasan_checklist.ktp_url tersimpan (Cloudinary)',
      !!pRow &&
        String(pRow.ktp_url || '')
          .toLowerCase()
          .includes('ktp'),
      (JSON.stringify(pRow && pRow.ktp_url) || '').slice(0, 150),
    );
    check(
      'pemberkasan_checklist.kk_url tersimpan (Cloudinary)',
      !!pRow &&
        String(pRow.kk_url || '')
          .toLowerCase()
          .includes('kk'),
      (JSON.stringify(pRow && pRow.kk_url) || '').slice(0, 150),
    );

    const mRows = await sbReq('GET', 'master_database_candidate', {
      select: '*',
      no_wa: 'eq.' + TEST_WA,
      limit: '5',
    });
    const mRow = (Array.isArray(mRows) ? mRows : []).find((r) => String(r.no_wa || '') === TEST_WA);
    check(
      'master_database_candidate.ktp_url ikut tersimpan',
      !!mRow &&
        String(mRow.ktp_url || '')
          .toLowerCase()
          .includes('ktp'),
      (JSON.stringify(mRow && mRow.ktp_url) || '').slice(0, 150),
    );
  }
} finally {
  // =============================================================
  // CLEANUP — hapus SEMUA jejak kandidat tes (DB + Storage)
  // =============================================================
  console.log('\nCLEANUP: hapus jejak kandidat tes…');
  const cleanupErrors = [];
  try {
    const objs = await storageList(FOLDER + '/');
    await Promise.all(
      (Array.isArray(objs) ? objs : [])
        .filter((o) => o && o.name)
        .map((o) => storageDelete(FOLDER + '/' + o.name)),
    );
    console.log(`  Storage: ${Array.isArray(objs) ? objs.length : 0} file dihapus dari ${FOLDER}/`);
  } catch (e) {
    cleanupErrors.push('storage: ' + e.message);
  }
  for (const [table, col] of [
    ['database_candidate', 'no_wa'],
    ['master_database_candidate', 'no_wa'],
    ['pemberkasan_checklist', 'wa'],
    ['database_asj_form', 'no_wa'],
  ]) {
    try {
      await sbReq('DELETE', table, { [col]: 'eq.' + TEST_WA });
    } catch (e) {
      cleanupErrors.push(table + ': ' + e.message);
    }
  }
  // database_asj_form bisa pakai kolom wa sebagai gantinya
  try {
    await sbReq('DELETE', 'database_asj_form', { wa: 'eq.' + TEST_WA });
  } catch {
    /* opsional */
  }
  console.log(
    cleanupErrors.length
      ? '  ⚠ cleanup sebagian gagal: ' + cleanupErrors.join(' | ')
      : '  ✅ DB + Storage bersih',
  );
  await browser.close();
}

finish();
