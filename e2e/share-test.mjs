// e2e/share-test.mjs — E2E test for share.html
import { check, launchBrowser, finish } from './harness.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const JOB = process.env.E2E_SHARE_JOB || 'TG9ASJ';
const browser = await launchBrowser();
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(String(e)));
async function safeEval(fn) {
  for (let i = 0; i < 5; i++) {
    try { return await page.evaluate(fn); }
    catch (e) { if (String(e).includes('Execution context')) { await page.waitForTimeout(700); continue; } return null; }
  }
  return null;
}
try {
  console.log('
share.html - E2E Test
');
  // 1. PAGE LOAD
  await page.goto(BASE + '/share.html?job=' + JOB, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  check('Page loads', jsErrors.length === 0, jsErrors.slice(0, 2));
  check('Title', (await page.title()).includes('ASJ'));
  // 2. BACK BUTTON
  const bb = await safeEval(() => { const a = document.querySelector('a[aria-label="Kembali ke Portal"]'); return a ? { href: a.getAttribute('href'), vis: a.offsetParent !== null } : null; });
  check('Back button', !!bb);
  check('Back href="/"', bb?.href === '/');
  check('Back visible', bb?.vis);
  // 3. HEADER
  const hd = await safeEval(() => ({ logo: !!document.querySelector('img[alt="ASJ Logo"]'), title: document.getElementById('job-title')?.textContent || '', code: document.getElementById('job-code')?.textContent || '' }));
  check('Logo', hd?.logo);
  check('Job title loaded', hd?.title && !hd.title.includes('Loading'));
  check('Job code set', hd?.code && hd?.code !== '---');
  // 4. LANGUAGE TOGGLE
  const lb = await safeEval(() => { const b = document.querySelector('button[onclick*="toggleLang"]'); return { ex: !!b, ar: b?.hasAttribute('aria-label') }; });
  check('Lang toggle exists', lb?.ex);
  check('Lang toggle aria-label', lb?.ar);
  await safeEval(() => { if (typeof window.toggleLang === 'function') window.toggleLang(); });
  await page.waitForTimeout(500);
  check('Toggled to JP', await safeEval(() => document.getElementById('lang-ind')?.textContent) === 'JP');
  await safeEval(() => { if (typeof window.toggleLang === 'function') window.toggleLang(); });
  await page.waitForTimeout(500);
  // 5. FILTERS
  const ft = await safeEval(() => ({ bar: !!document.getElementById('filter-bar'), g: document.getElementById('filter-gender')?.hasAttribute('aria-label'), a: document.getElementById('filter-age')?.hasAttribute('aria-label'), j: document.getElementById('filter-jft')?.hasAttribute('aria-label') }));
  check('Filter bar', ft?.bar);
  check('Filter gender aria', ft?.g);
  check('Filter age aria', ft?.a);
  check('Filter jft aria', ft?.j);
  // 6. GRID
  const gr = await safeEval(() => ({ ex: !!document.getElementById('candidates-grid'), vis: !document.getElementById('candidates-grid')?.classList.contains('hidden'), cards: document.querySelectorAll('#candidates-grid .glass-card').length }));
  check('Grid exists', gr?.ex);
  check('Grid visible', gr?.vis);
  check('Has candidates', gr?.cards >= 1, 'cards=' + gr?.cards);
  // 7. CARD CONTENT
  const cd = await safeEval(() => { const f = document.querySelector('#candidates-grid .glass-card'); if (!f) return null; return { photo: !!f.querySelector('img'), name: f.querySelector('h3')?.textContent?.length > 0, gender: f.querySelector('.fa-mars, .fa-venus') !== null, btns: f.querySelectorAll('button').length > 0, ariaPressed: f.querySelector('button[aria-pressed]') !== null }; });
  check('Card photo', cd?.photo);
  check('Card name', cd?.name);
  check('Card gender', cd?.gender);
  check('Card buttons', cd?.btns);
  check('Card aria-pressed', cd?.ariaPressed);
  // 8. SELECTION
  await safeEval(() => { const f = document.querySelector('#candidates-grid button[aria-pressed]'); if (f) f.click(); });
  await page.waitForTimeout(500);
  const sl = await safeEval(() => ({ count: document.getElementById('selection-count')?.textContent, bar: !document.getElementById('selection-bar')?.classList.contains('translate-y-full') }));
  check('Select count=1', sl?.count === '1', sl?.count);
  check('Selection bar visible', sl?.bar);
  // 9. SELECTION ARIA
  const sa = await safeEval(() => ({ al: document.querySelector('button[onclick*="submitSelection"]')?.hasAttribute('aria-label'), live: document.getElementById('selection-count')?.hasAttribute('aria-live') }));
  check('Submit aria-label', sa?.al);
  check('Count aria-live', sa?.live);
  // 10. DESELECT
  await safeEval(() => { const f = document.querySelector('#candidates-grid button[aria-pressed]'); if (f) f.click(); });
  await page.waitForTimeout(500);
  check('Deselect count=0', await safeEval(() => document.getElementById('selection-count')?.textContent) === '0');
  // 11. PREVIEW MODAL
  const pv = await safeEval(() => ({ m: !!document.getElementById('modal-preview'), i: !!document.getElementById('preview-iframe'), img: !!document.getElementById('preview-img'), dl: !!document.getElementById('preview-download'), cl: !!document.getElementById('preview-close') }));
  check('Preview modal', pv?.m);
  check('Preview iframe', pv?.i);
  check('Preview img', pv?.img);
  check('Download btn', pv?.dl);
  check('Close btn', pv?.cl);
  // 12. I18N
  check('toggleLang fn', await safeEval(() => typeof window.toggleLang === 'function'));
  check('tr fn', await safeEval(() => typeof window.tr === 'function'));
  // 13. PWA
  check('SW API', await safeEval(() => 'serviceWorker' in navigator));
  check('Manifest', await safeEval(() => !!document.querySelector('link[rel="manifest"]')));
  // 14. THEME
  check('Theme', await safeEval(() => document.body.classList.contains('theme-dark') || document.body.classList.contains('theme-light')));
  // 15. LOADING STATE
  const ld = await safeEval(() => ({ ex: !!document.getElementById('loading-state'), hid: document.getElementById('loading-state')?.classList.contains('hidden'), al: document.getElementById('loading-state')?.hasAttribute('aria-live') }));
  check('Loading state', ld?.ex);
  check('Loading hidden', ld?.hid);
  check('Loading aria-live', ld?.al);
  // 16. ERROR STATE
  const es = await safeEval(() => ({ ex: !!document.getElementById('error-state'), hid: document.getElementById('error-state')?.classList.contains('hidden'), al: document.getElementById('error-state')?.hasAttribute('aria-live') }));
  check('Error state', es?.ex);
  check('Error hidden', es?.hid);
  check('Error aria-live', es?.al);
  // 17. MISC
  check('Empty state', await safeEval(() => !!document.getElementById('empty-state')));
  check('Skip link', await safeEval(() => !!document.getElementById('skip-link')));
  check('JS errors = 0', jsErrors.length === 0, jsErrors.slice(0, 3));
} finally { await browser.close(); finish(); }
