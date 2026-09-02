// =============================================================
// E2E MODAL RUNTIME CHECK — ASJ Portal
// Memvalidasi loader modal runtime (assets/modals-shared.html):
// - modal SHARED ter-inject di #modal-root saat halaman dibuka
// - modal login admin bisa dibuka & dioperasikan (login penuh)
// - openRincianBuilder('input') jalan tanpa error (regresi fix
//   rb-catatan yang hilang di versi admin lama)
// - modal share loker terbuka (modal shared, tanpa API berat)
// - foto yang BENAR-BENAR gagal (visible + src non-kosong) = 0
// =============================================================
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_MASTER_PIN = process.env.E2E_MASTER_PIN || '123456';
const ADMIN_NAME = process.env.E2E_ADMIN_NAME || 'KHOCI';
const ADMIN_PIN = process.env.E2E_ADMIN_PIN || '4444';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ❌ ${name} ${extra}`);
    failures++;
  }
}
async function waitFor(condition, timeoutMs = 20000, intervalMs = 300) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// Foto yang benar-benar gagal: img VISIBLE + src non-kosong + naturalWidth=0.
async function realFailedImages(page) {
  return page.evaluate(async () => {
    const out = [];
    const imgs = [...document.querySelectorAll('img')];
    for (const i of imgs) {
      const src = i.currentSrc || i.src || '';
      if (!src || src === location.href) continue;
      const visible =
        !!(i.offsetWidth || i.offsetHeight) && getComputedStyle(i).visibility !== 'hidden';
      if (!visible) continue;
      if (i.complete && i.naturalWidth === 0) {
        out.push(src.slice(0, 150));
        continue;
      }
      if (!i.complete) {
        await new Promise((r) => {
          i.addEventListener('load', r, { once: true });
          i.addEventListener('error', r, { once: true });
          setTimeout(r, 4000);
        });
        if (i.naturalWidth === 0) out.push(src.slice(0, 150));
      }
    }
    return out;
  });
}

const browser = await chromium.launch();
console.log(`\nTarget: ${BASE}\n`);

// -------------------------------------------------------------
// 1. Login admin (modal login = modal shared via runtime)
// -------------------------------------------------------------
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(String(e)));

await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
await waitFor(async () => await page.locator('#modal-admin').isVisible());
check(
  'Modal login admin terbuka (modal shared, runtime)',
  await page.locator('#modal-admin').isVisible(),
);

await page.fill('#admin-pin-master', ADMIN_MASTER_PIN);
await page.click('#btn-login-master');
await waitFor(async () => await page.locator('#login-step-2').isVisible());
await page.click(`[onclick*="showLoginPersonal('${ADMIN_NAME}')"]`);
await waitFor(async () => await page.locator('#login-step-3').isVisible());
await page.fill('#admin-pin-personal', ADMIN_PIN);
await page.click('#btn-login-personal');
const adminMode = await waitFor(async () => await page.locator('#page-admin').isVisible());
check('Login admin sukses', adminMode);

// -------------------------------------------------------------
// 2. Rincian Builder (regresi rb-catatan) — modal SHARED
// -------------------------------------------------------------
const rbFn = await page.evaluate(() => typeof window.openRincianBuilder === 'function');
if (rbFn) {
  const errBefore = jsErrors.length;
  await page.evaluate(() => window.openRincianBuilder('input'));
  const rbOpen = await waitFor(
    async () => await page.locator('#modal-rincian-builder').isVisible(),
    15000,
  );
  check('Modal Rincian Builder terbuka (fix rb-catatan, shared)', rbOpen);
  check(
    'Tidak ada error JS saat buka Rincian Builder',
    jsErrors.length === errBefore,
    jsErrors.slice(errBefore)[0] || '',
  );
  if (rbOpen) {
    await new Promise((r) => setTimeout(r, 1200));
    const failed = await realFailedImages(page);
    check(
      'Foto di modal Rincian Builder termuat',
      failed.length === 0,
      JSON.stringify(failed.slice(0, 3)),
    );
    await page.locator('#modal-rincian-builder').evaluate((el) => el.classList.add('hidden'));
  }
} else {
  console.log('  (openRincianBuilder tidak tersedia)');
}

// -------------------------------------------------------------
// 3. Modal Share Loker (bukaModalShare) — modal SHARED
// -------------------------------------------------------------
const jobCode = await page.evaluate(() => {
  const btn = document.querySelector('[onclick*="bukaModalShare"]');
  if (!btn) return null;
  const m = btn.getAttribute('onclick').match(/bukaModalShare\('([^']+)'\)/);
  return m ? m[1] : null;
});
if (jobCode) {
  await page.evaluate((code) => window.bukaModalShare(code), jobCode);
  const shareOpen = await waitFor(async () => await page.locator('#modal-share-loker').isVisible());
  check('Modal Share Loker (shared) terbuka via runtime', shareOpen);
  if (shareOpen) {
    await new Promise((r) => setTimeout(r, 1000));
    const failed = await realFailedImages(page);
    check('Foto di modal Share termuat', failed.length === 0, JSON.stringify(failed.slice(0, 3)));
  }
} else {
  console.log('  (tidak ada tombol bukaModalShare di halaman)');
}

check('Tidak ada error JS selama tes modal', jsErrors.length === 0, jsErrors[0] || '');

await browser.close();
console.log(`\n${failures === 0 ? '🎉 SEMUA LULUS' : `💥 ${failures} GAGAL`}\n`);
process.exit(failures === 0 ? 0 : 1);
