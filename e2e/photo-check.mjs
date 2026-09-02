// =============================================================
// E2E PHOTO CHECK — ASJ Portal
// Memeriksa render foto kandidat di 3 alur: publik, kandidat, admin.
// Menunggu semua <img> selesai load (atau gagal) lalu melaporkan yang
// benar-benar gagal (naturalWidth=0 setelah complete).
// =============================================================
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const WA = process.env.E2E_WA || '082130442661';
const PIN = process.env.E2E_PIN || '2661';
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

// Tunggu sampai TIDAK ada lagi <img> yang masih loading, lalu kembalikan
// daftar img yang complete tapi naturalWidth=0 (gagal load).
async function failedImages(page, waitMs = 6000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const stillLoading = await page.evaluate(() => {
      let n = 0;
      document.querySelectorAll('img').forEach((i) => {
        if (i.src && !i.complete) n++;
      });
      return n;
    });
    if (stillLoading === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('img').forEach((img) => {
      // Abaikan img placeholder yang src-nya kosong (resolve ke URL halaman)
      // atau data-URI — bukan foto yang benar-benar gagal dimuat.
      if (!img.src || img.src.startsWith('data:') || img.src === location.href) return;
      const rect = img.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      const style = getComputedStyle(img);
      const shown = style.display !== 'none' && style.visibility !== 'hidden';
      if (img.complete && img.naturalWidth === 0 && shown) {
        out.push({
          src: img.src.slice(0, 150),
          visible,
          cls: (img.className || '').toString().slice(0, 45),
        });
      }
    });
    return out;
  });
}

const browser = await chromium.launch();
console.log(`\nTarget: ${BASE}\n`);

// -------------------------------------------------------------
// TEST 1 — Landing publik
// -------------------------------------------------------------
{
  console.log('TEST 1: Landing publik');
  const page = await browser.newPage();
  const failedReqs = [];
  page.on('requestfailed', (r) => {
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(r.url())) failedReqs.push(r.url().slice(0, 150));
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await waitFor(async () => (await page.locator('#public-table-body tr').count()) > 0);
  const failed = await failedImages(page);
  console.log('  img gagal (terlihat):', failed.length);
  failed.forEach((b) => console.log('    -', b.src, '| class:', b.cls));
  console.log('  request gagal (gambar):', failedReqs.length);
  failedReqs.forEach((u) => console.log('    !', u));
  check(
    'Foto/aset publik semua termuat',
    failed.length === 0 && failedReqs.length === 0,
    JSON.stringify([...failed.slice(0, 2), ...failedReqs.slice(0, 2)]),
  );
  await page.close();
}

// -------------------------------------------------------------
// TEST 2 — Kandidat: dashboard (foto & CV mini)
// -------------------------------------------------------------
{
  console.log('\nTEST 2: Login kandidat → foto dashboard & CV mini');
  const page = await browser.newPage();
  const jsErrors = [];
  const failedReqs = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  page.on('requestfailed', (r) => {
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(r.url())) failedReqs.push(r.url().slice(0, 150));
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
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
  await page.evaluate(() => window.bukaModalKandidat('login'));
  await waitFor(async () => await page.locator('#form-login-kandidat').isVisible());
  await page.fill('#log-wa', WA);
  await page.fill('#log-pass', PIN);
  await page.click('#btn-log-kandidat');
  await waitFor(async () => await page.locator('#page-kandidat').isVisible());
  await new Promise((r) => setTimeout(r, 1200));

  // Buka CV mini kandidat (fungsi bukaModalCvMini di 03_candidate.js)
  try {
    await page.evaluate(() => window.bukaModalCvMini && window.bukaModalCvMini());
    await new Promise((r) => setTimeout(r, 1800));
  } catch (e) {
    console.log('  (bukaModalCvMini error:', String(e).slice(0, 80), ')');
  }

  const failed = await failedImages(page);
  console.log('  img gagal (terlihat):', failed.length);
  failed.forEach((b) => console.log('    -', b.src, '| class:', b.cls));
  console.log('  request gagal (gambar):', failedReqs.length);
  failedReqs.forEach((u) => console.log('    !', u));
  check(
    'Tidak ada foto gagal di dashboard kandidat',
    failed.length === 0 && failedReqs.length === 0,
    JSON.stringify([...failed.slice(0, 2), ...failedReqs.slice(0, 2)]),
  );
  check('Tidak ada error JS di dashboard kandidat', jsErrors.length === 0, jsErrors[0] || '');
  await page.close();
}

// -------------------------------------------------------------
// TEST 3 — Admin: buka modal kandidat (foto pas foto)
// -------------------------------------------------------------
{
  console.log('\nTEST 3: Login admin → buka modal kandidat pertama');
  const page = await browser.newPage();
  const jsErrors = [];
  const failedReqs = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  page.on('requestfailed', (r) => {
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(r.url())) failedReqs.push(r.url().slice(0, 150));
  });
  await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  // Matikan Service Worker + cache — lihat komentar di TEST 2.
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
  await waitFor(async () => await page.locator('#modal-admin').isVisible());
  await page.fill('#admin-pin-master', ADMIN_MASTER_PIN);
  await page.click('#btn-login-master');
  await waitFor(async () => await page.locator('#login-step-2').isVisible());
  await page.click(`[onclick*="showLoginPersonal('${ADMIN_NAME}')\"]`);
  await waitFor(async () => await page.locator('#login-step-3').isVisible());
  await page.fill('#admin-pin-personal', ADMIN_PIN);
  await page.click('#btn-login-personal');
  await waitFor(async () => await page.locator('#page-admin').isVisible());

  // Buka modal kandidat via fungsi yang dipakai baris tabel admin
  const opened = await page.evaluate(() => {
    // cari fungsi global yang membuka modal kandidat dari baris admin
    const names = [
      'bukaModalKandidatAdmin',
      'bukaDetailKandidat',
      'adminBukaKandidat',
      'bukaAdminKandidat',
      'bukaModalKandidat',
    ];
    for (const n of names) {
      if (typeof window[n] === 'function') return n;
    }
    return null;
  });
  if (opened) {
    await page.evaluate((n) => window[n](0), opened);
    await new Promise((r) => setTimeout(r, 1800));
  } else {
    // Fallback: klik tombol buka modal pada baris pertama tabel kandidat
    const btn = page.locator('#admin-kandidat-body tr').first().locator('button').first();
    if (await btn.count()) {
      await btn.click();
      await new Promise((r) => setTimeout(r, 1800));
    }
  }

  const failed = await failedImages(page);
  console.log('  img gagal (terlihat):', failed.length);
  failed.forEach((b) => console.log('    -', b.src, '| class:', b.cls));
  console.log('  request gagal (gambar):', failedReqs.length);
  failedReqs.forEach((u) => console.log('    !', u));
  check(
    'Tidak ada foto gagal di modal admin',
    failed.length === 0 && failedReqs.length === 0,
    JSON.stringify([...failed.slice(0, 2), ...failedReqs.slice(0, 2)]),
  );
  check('Tidak ada error JS di dashboard admin', jsErrors.length === 0, jsErrors[0] || '');
  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? '🎉 SEMUA LULUS' : `💥 ${failures} GAGAL`}\n`);
process.exit(failures === 0 ? 0 : 1);
