// Probe: verifikasi pembersihan Google/GAS.
// - Semua halaman memuat /api-client.js (bukan gas-client.js) tanpa 404
// - Aset brand (jeklin, logo) termuat dari Supabase Storage
// - Tidak ada request jaringan ke host google (lh3/drive/docs)
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PAGES = [
  '/',
  '/admin.html',
  '/ai_form.html',
  '/apply-full.html',
  '/master-full.html',
  '/siswa-baru.html',
  '/share.html',
];
const JEKLIN =
  'gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/jeklin.png';
const LOGO =
  'gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/logo_asj.png';
const LOGO_APPLY =
  'gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/logo_apply.png';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const problems = [];
  const googleReqs = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/lh3\.googleusercontent|drive\.google\.com|docs\.google\.com|script\.google/.test(u))
      googleReqs.push(u);
    if (r.status() >= 400 && /api-client|\.js\?v=/.test(u))
      problems.push(`HTTP ${r.status()} ${u}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`JS ERROR: ${m.text().slice(0, 120)}`);
  });

  for (const p of PAGES) {
    googleReqs.length = 0;
    await page
      .goto(BASE + p, { waitUntil: 'domcontentloaded' })
      .catch((e) => problems.push(`${p} goto: ${e.message}`));
    await page.waitForTimeout(1500);
    // share.html adalah viewer mandiri yang memakai fetch('/api/share-data')
    // langsung — tidak pernah memuat /api-client.js, jadi callAPI tidak wajib.
    const needsApiClient = p !== '/share.html';
    const hasApiClient = await page.evaluate(
      () => !!window.callAPI && typeof window.callAPI === 'function',
    );
    const hasCallGAS = await page.evaluate(() => typeof window.callGAS !== 'undefined');
    console.log(
      `${p}: callAPI=${hasApiClient} callGAS=${hasCallGAS} googleReqs=${googleReqs.length} ${googleReqs.length ? googleReqs[0] : ''}`,
    );
    if (needsApiClient && !hasApiClient) problems.push(`${p}: callAPI tidak terdefinisi`);
    if (hasCallGAS) problems.push(`${p}: callGAS masih ada!`);
  }

  // aset termuat di index & ai_form
  for (const [p, needle] of [
    ['/', JEKLIN],
    ['/', LOGO],
    ['/apply-full.html', LOGO_APPLY],
  ]) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    // Tunggu logo dirender (JS menyisipkan img setelah data dimuat).
    await page
      .waitForFunction((n) => [...document.images].some((i) => i.src.includes(n)), needle, {
        timeout: 8000,
      })
      .catch(() => {});
    const ok = await page.evaluate(
      (n) => [...document.images].some((i) => i.src.includes(n)),
      needle,
    );
    console.log(`${p} memuat ${needle.split('/').pop()}: ${ok}`);
    if (!ok) problems.push(`${p}: ${needle.split('/').pop()} tidak dimuat`);
  }

  await browser.close();
  if (problems.length) {
    console.log('\nPROBLEMS:');
    problems.forEach((x) => console.log(' -', x));
    process.exit(1);
  }
  console.log('\n✅ SEMUA BERSIH');
})();
