// Diag browser: simpan CV Mini sebagai kandidat AGUS KHOCI
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const WA = process.env.E2E_WA || '082130442661';
const PIN = process.env.E2E_PIN || '2661';

const browser = await chromium.launch();
const page = await browser.newPage();
const jsErrors = [];
const dialogs = [];
page.on('pageerror', (e) => jsErrors.push(String(e)));
page.on('dialog', (d) => {
  dialogs.push(d.message());
  d.accept();
});

async function waitFor(fn, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page
    .evaluate(async () => {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const ks = await caches.keys();
        await Promise.all(ks.map((k) => caches.delete(k)));
      }
    })
    .catch(() => {});

  // Login kandidat
  await page.evaluate(() => window.bukaModalKandidat('login'));
  await waitFor(async () => await page.locator('#form-login-kandidat').isVisible());
  await page.fill('#log-wa', WA);
  await page.fill('#log-pass', PIN);
  await page.evaluate(() => document.getElementById('btn-log-kandidat').click());
  const okLogin = await waitFor(async () => await page.locator('#page-kandidat').isVisible());
  console.log('login kandidat:', okLogin ? 'OK' : 'GAGAL');
  const dataReady = await waitFor(
    async () => (await page.evaluate(() => (window.ALL_CANDIDATES || []).length)) > 0,
    30000,
  );
  console.log('ALL_CANDIDATES terisi:', dataReady);

  // Buka modal CV Mini
  await page.evaluate(() => window.bukaModalCvMini());
  const modalOpen = await waitFor(async () => await page.locator('#modal-cv-mini').isVisible());
  console.log('modal CV Mini terbuka:', modalOpen);
  if (!modalOpen) {
    console.log(
      'toast terakhir:',
      await page.evaluate(() => (window.__toastLog || []).join(' | ')),
    );
  }

  // Ubah field lalu Simpan
  await page.fill('#um-usia', '25');
  await page.fill('#um-tb', '165');
  const toasts = [];
  page.on('console', (m) => {
    if (m.text().includes('toast') || m.text().includes('CV')) toasts.push(m.text());
  });
  await page.evaluate(() => document.getElementById('btn-submit-cv-mini').click());

  const saved = await waitFor(async () => {
    const t = await page.evaluate(() => {
      const el = document.querySelector('#toast-container .toast, #toast-container div');
      return el ? el.textContent : '';
    });
    return /berhasil|sukses|updated|berubah/i.test(t);
  }, 20000);
  console.log('toast sukses muncul:', saved);

  const toastText = await page.evaluate(() => {
    const el = document.querySelector('#toast-container');
    return el ? el.textContent : '';
  });
  console.log('isi toast-container:', JSON.stringify(toastText).slice(0, 200));
  console.log('modal masih terbuka:', await page.locator('#modal-cv-mini').isVisible());
  console.log('JS errors:', jsErrors.length ? jsErrors.slice(0, 3) : 'tidak ada');
} finally {
  await browser.close();
}
