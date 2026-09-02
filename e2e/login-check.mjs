// =============================================================
// E2E SMOKE CHECK (Playwright) — ASJ Portal
// -------------------------------------------------------------
// Menguji alur login & render dashboard setelah refactor frontend
// (async/await). Bisa dijalankan dari mesin mana pun (atau CI):
//
//   bun add -D playwright && bunx playwright install chromium
//   BASE_URL="https://<preview-or-netlify-url>" node e2e/login-check.mjs
//
// Kredensial tes default = akun kandidat & admin milik pemilik repo
// (bisa dioverride via env: E2E_WA, E2E_PIN, E2E_ADMIN_NAME, E2E_ADMIN_PIN).
// =============================================================
import { BASE, check, waitFor, launchBrowser, finish } from './harness.mjs';
const WA = process.env.E2E_WA || '082130442661';
const PIN = process.env.E2E_PIN || '2661';
const ADMIN_MASTER_PIN = process.env.E2E_MASTER_PIN || '123456';
const ADMIN_NAME = process.env.E2E_ADMIN_NAME || 'KHOCI';
const ADMIN_PIN = process.env.E2E_ADMIN_PIN || '4444';

const browser = await launchBrowser();
console.log(`\nTarget: ${BASE}\n`);

// -------------------------------------------------------------
// TEST 1 — Landing publik: loker render + tidak ada error JS
// -------------------------------------------------------------
{
  console.log('TEST 1: Landing publik');
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  // Matikan Service Worker + cache (kalau host bukan localhost, SW aktif dan
  // controllerchange bisa me-reload halaman di tengah tes — sama seperti
  // upload-check/biodata-check).
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
  const rendered = await waitFor(
    async () => (await page.locator('#public-table-body tr').count()) > 0,
  );
  check('Tabel loker publik render (getAppData ok)', rendered);
  check('Tidak ada error JS di landing', jsErrors.length === 0, jsErrors[0] || '');
  const loginBtn = await page.locator('[onclick*="bukaModalKandidat"]').count();
  check('Tombol Login/Daftar tersedia', loginBtn > 0);
  await page.close();
}

// -------------------------------------------------------------
// TEST 2 — Login Kandidat (WA + PIN) → dashboard kandidat
// -------------------------------------------------------------
{
  console.log('\nTEST 2: Login kandidat (Agus khoci)');
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  // Matikan Service Worker + cache — lihat komentar di TEST 1.
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
  const modalVisible = await waitFor(
    async () => await page.locator('#form-login-kandidat').isVisible(),
  );
  check('Modal login kandidat terbuka', modalVisible);

  await page.fill('#log-wa', WA);
  await page.fill('#log-pass', PIN);
  // click via evaluate: #global-loader bisa menutupi tombol saat proses
  // login, dan modal tertutup tepat saat Playwright mengecek stabilitas
  await page.evaluate(() => document.getElementById('btn-log-kandidat').click());

  // Nav top memakai kelas !hidden (sengaja selalu tersembunyi) — indikator
  // login yang valid: dashboard kandidat tampil (changePage dipanggil initApp)
  const loggedIn = await waitFor(
    async () =>
      await page.evaluate(() => {
        const el = document.getElementById('page-kandidat');
        return el && getComputedStyle(el).display !== 'none';
      }),
  );
  check('Login sukses → dashboard kandidat tampil', loggedIn);
  check('Modal login tertutup', !(await page.locator('#modal-kandidat').isVisible()));
  const stored = await page.evaluate(() => localStorage.getItem('asj_kandidat_login'));
  check('Sesi kandidat tersimpan', stored === 'sukses');

  // Dashboard menerima data kandidatnya sendiri (getAppData mode kandidat):
  // progres & biodata dirender JS (badge biodata bukan lagi default "Biodata: ?"),
  // dan field tahapan/status terisi dari DB — bukan statis kosong.
  const bioRendered = await waitFor(
    async () => (await page.locator('#prog-biodata-badge').innerText()).indexOf('?') === -1,
  );
  check('Progres pemberkasan dirender (biodata dari DB)', bioRendered);
  const tahapan = (await page.locator('#k-dash-tahapan').innerText()).trim();
  check('Tahapan kandidat dari DB (' + tahapan + ')', tahapan !== '' && tahapan !== '-');
  const hasCandidates = await page.evaluate(() => (window.ALL_CANDIDATES || []).length);
  check('ALL_CANDIDATES terisi (myData ada)', hasCandidates > 0);

  check('Tidak ada error JS saat login', jsErrors.length === 0, jsErrors[0] || '');
  await page.close();
}

// -------------------------------------------------------------
// TEST 3 — Login Admin (PIN master → pilih admin → PIN personal)
//          lalu verifikasi tabel dashboard render (regresi refactor)
// -------------------------------------------------------------
{
  console.log('\nTEST 3: Login admin + render dashboard');
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  // Matikan Service Worker + cache — lihat komentar di TEST 1.
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
  // Modal admin auto-buka di admin.html (IS_ADMIN_PORTAL + belum login)
  const modalOpen = await waitFor(async () => await page.locator('#modal-admin').isVisible());
  if (!modalOpen) await page.evaluate(() => window.showLoginAdminMaster());
  check('Modal login admin terbuka', await page.locator('#modal-admin').isVisible());

  // Step 1: PIN master
  await page.fill('#admin-pin-master', ADMIN_MASTER_PIN);
  await page.click('#btn-login-master');
  const step2 = await waitFor(async () => await page.locator('#login-step-2').isVisible());
  check('Step 1 (PIN master) lolos', step2);

  // Step 2: pilih admin KHOCI
  await page.click(`[onclick*="showLoginPersonal('${ADMIN_NAME}')"]`);
  const step3 = await waitFor(async () => await page.locator('#login-step-3').isVisible());
  check(`Step 2 (pilih ${ADMIN_NAME})`, step3);

  // Step 3: PIN personal → masuk portal (click via evaluate — lihat catatan
  // di TEST 2: #global-loader bisa menutupi tombol saat proses login)
  await page.fill('#admin-pin-personal', ADMIN_PIN);
  await page.evaluate(() => document.getElementById('btn-login-personal').click());
  const adminMode = await waitFor(
    async () =>
      await page.evaluate(() => {
        const el = document.getElementById('page-admin');
        return el && getComputedStyle(el).display !== 'none';
      }),
  );
  check('Login admin sukses → dashboard admin tampil', adminMode);
  check(
    'Menu hamburger admin aktif',
    await page.evaluate(
      () => !document.getElementById('mobile-nav-admin').classList.contains('hidden'),
    ),
  );

  // Dashboard render (fungsi render yang baru di-refactor: jadwal, kandidat, dbjob)
  // Catatan: fitur jadwal/tugas sudah dihapus dari produk (changelog d86b854),
  // jadi tabel jadwal boleh kosong — yang wajib adalah tbody-nya ter-render.
  const jadwalRendered = await waitFor(
    async () => (await page.locator('#admin-jadwal-body').count()) > 0,
  );
  const kandidat = await waitFor(
    async () => (await page.locator('#admin-kandidat-body tr').count()) > 0,
  );
  const dbjob = await waitFor(async () => (await page.locator('#admin-dbjob-body tr').count()) > 0);
  const jadwalRows = await page.locator('#admin-jadwal-body tr').count();
  check(
    'Tabel Jadwal ter-render' + (jadwalRows === 0 ? ' (kosong — fitur sudah dihapus)' : ''),
    jadwalRendered,
  );
  check('Tabel Kandidat render', kandidat);
  check('Tabel DB Job render', dbjob);
  check('Tidak ada error JS di dashboard admin', jsErrors.length === 0, jsErrors[0] || '');
  await page.close();
}

await browser.close();
finish();
