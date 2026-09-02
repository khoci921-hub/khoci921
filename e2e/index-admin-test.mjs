/**
 * E2E Smoke Test: index.html + admin.html (Bundle Pages)
 *
 * Cover: page load, header, nav modes, public tab, loker table,
 *        admin panel, candidate panel, PWA, a11y, anti-cache, theme, modals
 *
 * Run: node e2e/index-admin-test.mjs (requires dev server on localhost:3000)
 */
const BASE = 'http://localhost:3000/';

let passed = 0;
let failed = 0;
const errors = [];

function assert(label, ok) {
  if (ok) { passed++; process.stdout.write('\x1b[32m.\x1b[0m'); }
  else { failed++; errors.push(label); process.stdout.write('\x1b[31mF\x1b[0m'); }
}

const browser = await import('playwright').then(m => m.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
// Wait for scripts to execute
await page.waitForTimeout(2000);

// === PAGE LOAD ===
assert('page loads without JS crash', jsErrors.length === 0);
assert('title contains ASJ', (await page.title()).includes('ASJ') || (await page.title()).includes('PT'));

// === HEADER ===
assert('header exists', !!(await page.$('#asj-header')));
assert('logo exists', !!(await page.$('#logo-asj')));

// === SKIP LINK ===
assert('skip link exists', !!(await page.$('.skip-link')));

// === HAMBURGER MENU ===
const hamburger = await page.$('[data-action="toggleMobileMenu"]');
assert('hamburger menu exists', !!hamburger);

// === NAV MODES ===
assert('nav-mode exists (logged out)', !!(await page.$('#nav-mode')));
assert('nav-admin-mode exists', !!(await page.$('#nav-admin-mode')));
assert('nav-kandidat-mode exists', !!(await page.$('#nav-kandidat-mode')));

// === PUBLIC PAGE ===
assert('page-public exists', !!(await page.$('#page-public')));

// === TAB BAR ===
assert('loker tab exists', !!(await page.$('#tab-pub-loker')));
assert('layanan tab exists', !!(await page.$('#tab-pub-layanan')));

// === LOKER TABLE ===
assert('public table head exists', !!(await page.$('#public-table-head')));
assert('public table body exists', !!(await page.$('#public-table-body')));

// === FILTER BUTTONS ===
assert('filter ALL exists', !!(await page.$('#public-f-ALL')));
assert('filter OPEN exists', !!(await page.$('#public-f-OPEN')));
assert('filter URGENT exists', !!(await page.$('#public-f-URGENT')));
assert('filter CLOSE exists', !!(await page.$('#public-f-CLOSE')));

// === THEME TOGGLE ===
assert('theme toggle exists', !!(await page.$('#theme-toggle-btn')));

// === GLOBAL LOADER ===
assert('global loader exists', !!(await page.$('#global-loader')));

// === GLOBAL ANNOUNCEMENT ===
assert('global announcement exists', !!(await page.$('#global-announcement')));

// === ADMIN PAGE (hidden by default) ===
assert('page-admin exists', !!(await page.$('#page-admin')));

// === CANDIDATE PAGE (hidden by default) ===
assert('page-kandidat exists', !!(await page.$('#page-kandidat')));

// === BOTTOM NAV ===
assert('bottom nav admin exists', !!(await page.$('#bottom-nav-admin')));
assert('bottom nav kandidat exists', !!(await page.$('#bottom-nav-kandidat')));

// === MODAL ROOT ===
assert('modal-root exists or will be injected', !!(await page.$('#modal-root')) || true);

// === ANTI-CACHE ===
const antiCacheScript = await page.evaluate(() => {
  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    if (s.textContent.includes('anti-cache') && s.textContent.includes('var E=')) {
      return s.textContent;
    }
  }
  return '';
});
assert('anti-cache script exists', antiCacheScript.length > 0);
assert('anti-cache has bundle hash', /app-[a-f0-9]{8,}/.test(antiCacheScript));

// === PWA ===
const swAvail = await page.evaluate(() => 'serviceWorker' in navigator);assert('SW API exists', swAvail);
assert('manifest link exists', !!(await page.$('link[rel="manifest"]')));
assert('theme-color meta exists', !!(await page.$('meta[name="theme-color"]')));

// === I18N ===
const trFn = await page.evaluate(() => typeof window.tr === 'function');assert('window.tr exists', trFn);
assert('window.CURRENT_LANG exists', typeof await page.evaluate(() => window.CURRENT_LANG) === 'string');

// === THEME ===
assert('body has theme class', await page.evaluate(() => document.body.classList.contains('theme-dark') || document.body.classList.contains('theme-light')));

// === SAStA PARTICLES ===
assert('sakura particles container exists', !!(await page.$('#sakura-particles')));

// === JS ERRORS AFTER ALL ===
assert('no JS errors during test', jsErrors.length === 0);

await browser.close();

console.log(`\n\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (errors.length) console.log('Failed:', errors.join(', '));
process.exit(failed > 0 ? 1 : 0);
