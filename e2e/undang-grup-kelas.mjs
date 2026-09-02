// =============================================================
// E2E — Fitur Undang Grup Kelas (admin.html)
// -------------------------------------------------------------
// Menguji alur lengkap fitur kirim undangan WA grup ke orang tua/wali:
//   1. Login admin (PIN master → pilih admin → PIN personal)
//   2. Buka modal Undangan Grup Kelas + cek preview (jumlah ortu,
//      varian pesan, placeholder {nama}/{link_grup})
//   3. Kirim dengan window.callAPI di-STUB (TIDAK mengirim WA beneran —
//      Fonnte dikonfigurasi di preview/prod; stub menangkap payload)
//   4. Verifikasi payload: WA ternormalisasi 0xx/8xx→62xx, baris invalid
//      dibuang, jobCode '', linkGrup, interval, customMessage berisi
//      varian (pemisah ---). ROTASI varian bergilir anti-ban di backend
//      handleKirimTawaranMassal diuji unit: actions-wa.test.js.
//
// Jalankan (butuh preview jalan + Node ≥22 / bun):
//   BASE_URL="http://localhost:3000" node e2e/undang-grup-kelas.mjs
// =============================================================
import { BASE, check, waitFor, launchBrowser, finish } from './harness.mjs';

const ADMIN_MASTER_PIN = process.env.E2E_MASTER_PIN || '123456';
const ADMIN_NAME = process.env.E2E_ADMIN_NAME || 'KHOCI';
const ADMIN_PIN = process.env.E2E_ADMIN_PIN || '4444';

const DAFTAR_ORTU =
  'Budi Santoso|081234567890\n' + // 0xx → 62xx
  'Siti Aminah|6282222222222\n' + // sudah kanonik
  'Tanpa Nomor'; // invalid → dibuang
const LINK_GRUP = 'https://chat.whatsapp.com/E2ETESTGRUP';
const PESAN_VARIAN =
  'Halo {nama}, silakan bergabung ke grup kelas: {link_grup}\n' +
  '---\n' +
  'Assalamualaikum {nama}, bergabung yuk: {link_grup}';

let browser = null;
try {
  browser = await launchBrowser();
} catch (e) {
  console.log(
    `  ⚠ browser check dilewati (playwright tidak bisa launch di runtime ini): ${String(e.message || e).slice(0, 120)}`,
  );
}
if (browser) {
  console.log(`\nTarget: ${BASE}\n`);
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') jsErrors.push(m.text().slice(0, 150));
  });

  // -------------------------------------------------------------
  // 1. Login admin
  // -------------------------------------------------------------
  await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  // Matikan Service Worker + cache (host non-localhost: controllerchange bisa
  // me-reload halaman di tengah tes — sama seperti upload-check/biodata-check).
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
  const modalOpen = await waitFor(async () => await page.locator('#modal-admin').isVisible());
  if (!modalOpen) await page.evaluate(() => window.showLoginAdminMaster());
  check('Modal login admin terbuka', await page.locator('#modal-admin').isVisible());

  await page.fill('#admin-pin-master', ADMIN_MASTER_PIN);
  await page.click('#btn-login-master');
  const step2 = await waitFor(async () => await page.locator('#login-step-2').isVisible());
  check('Step 1 (PIN master) lolos', step2);

  await page.click(`[onclick*="showLoginPersonal('${ADMIN_NAME}')"]`);
  const step3 = await waitFor(async () => await page.locator('#login-step-3').isVisible());
  check(`Step 2 (pilih ${ADMIN_NAME})`, step3);

  await page.fill('#admin-pin-personal', ADMIN_PIN);
  await page.click('#btn-login-personal');
  const adminMode = await waitFor(async () => await page.locator('#page-admin').isVisible());
  check('Login admin sukses → dashboard admin tampil', adminMode);

  // -------------------------------------------------------------
  // 2. Buka modal + preview
  // -------------------------------------------------------------
  await page.evaluate(() => window.bukaModalUndanganKelas());
  const modalVisible = await waitFor(async () =>
    page.evaluate(
      () => !document.getElementById('modal-undangan-kelas').classList.contains('hidden'),
    ),
  );
  check('Modal Undangan Grup Kelas terbuka', modalVisible);

  await page.fill('#input-daftar-ortu', DAFTAR_ORTU);
  await page.fill('#input-link-grup-kelas', LINK_GRUP);
  await page.fill('#input-pesan-kelas', PESAN_VARIAN);
  await page.fill('#input-interval-kelas', '10');
  await page.evaluate(() => window.previewUndanganKelas());

  const preview = await page.evaluate(() => ({
    jumlah: document.getElementById('span-kelas-jumlah').textContent,
    varian: document.getElementById('span-kelas-varian').textContent,
    prv: document.getElementById('preview-pesan-kelas').textContent,
  }));
  check(
    'Jumlah ortu valid = 2 (baris invalid dibuang)',
    /2/.test(preview.jumlah),
    `jumlah="${preview.jumlah}"`,
  );
  check('Indikator 2 varian pesan tampil', /2/.test(preview.varian), `varian="${preview.varian}"`);
  check(
    'Preview varian pertama + {nama} ter-replace',
    preview.prv.includes('Budi Santoso') && preview.prv.includes(LINK_GRUP),
    `preview="${preview.prv.slice(0, 60)}"`,
  );

  // -------------------------------------------------------------
  // 3. Kirim dengan callAPI di-stub (TIDAK mengirim WA beneran)
  // -------------------------------------------------------------
  await page.evaluate(() => {
    const origCall = window.callAPI;
    window.__e2eCaptured = null;
    window.callAPI = async (action, payload) => {
      if (action === 'kirimTawaranMassal') {
        window.__e2eCaptured = payload;
        return { success: true, results: [{ success: true }, { success: true }] };
      }
      return origCall(action, payload);
    };
  });
  page.once('dialog', (d) => d.accept()); // konfirmasi kirim
  await page.click('#btn-undang-kelas');

  const sent = await waitFor(async () => page.evaluate(() => !!window.__e2eCaptured));
  check('kirimTawaranMassal dipanggil (payload tertangkap)', sent);

  const p = await page.evaluate(() => window.__e2eCaptured && window.__e2eCaptured[0]);
  check('Payload ada', !!p && Array.isArray(p.candidates));
  if (p && Array.isArray(p.candidates)) {
    check(
      '2 kandidat valid dikirim (invalid dibuang)',
      p.candidates.length === 2,
      `n=${p.candidates.length}`,
    );
    check(
      'WA 0xx ternormalisasi → 628…',
      p.candidates[0].wa === '6281234567890',
      `wa0=${p.candidates[0].wa}`,
    );
    check(
      'WA kanonik tetap 628…',
      p.candidates[1].wa === '6282222222222',
      `wa1=${p.candidates[1].wa}`,
    );
    check('jobCode kosong (mode kelas, bukan loker)', p.jobCode === '');
    check('linkGrup sesuai isian', p.linkGrup === LINK_GRUP);
    check('interval 10 dtk (jeda anti-ban)', p.interval === 10);
    const variants = String(p.customMessage || '')
      .split(/^---\s*$/m)
      .map((s) => s.trim())
      .filter(Boolean);
    check(
      'customMessage membawa 2 varian (backend rotasi per penerima)',
      variants.length === 2,
      `n=${variants.length}`,
    );
    check('placeholder {nama} dipertahankan sampai backend', p.customMessage.includes('{nama}'));
  }

  const toastOk = await waitFor(async () =>
    page
      .evaluate(() => (document.getElementById('toast-container') || {}).textContent || '')
      .then((t) => t.includes('2')),
  );
  const toastText = await page.evaluate(
    () => (document.getElementById('toast-container') || {}).textContent || '',
  );
  check('Toast sukses muncul (2 undangan)', toastOk, `toast="${String(toastText).slice(0, 60)}"`);

  check('Tidak ada error JS', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
  await browser.close();
}

finish();
