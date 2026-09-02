// e2e/master-full-test.mjs — E2E test for master-full.html
import { check, launchBrowser, finish } from './harness.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const WA = process.env.E2E_WA || '6282130442661';
const NAMA = process.env.E2E_NAMA || 'AGUS KHOCI';
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
master-full.html - E2E Test
');
  // 1. PAGE LOAD
  await page.goto(BASE + '/master-full.html?wa=' + WA + '&nama=' + encodeURIComponent(NAMA), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  check('Page loads', jsErrors.length === 0, jsErrors.slice(0, 2));
  check('Title', (await page.title()).includes('ASJ'));
  // 2. BACK BUTTON
  const bb = await safeEval(() => { const a = document.querySelector('a[aria-label="Kembali ke Portal"]'); return a ? { href: a.getAttribute('href'), vis: a.offsetParent !== null } : null; });
  check('Back button', !!bb);
  check('Back href="/"', bb?.href === '/');
  check('Back visible', bb?.vis);
  // 3. FORM INPUTS + ARIA
  const ids = ['wa','nama','gender','tglLahir','alamat','email'];
  for (const id of ids) {
    const r = await safeEval((i) => { const e = document.getElementById(i); return { ex: !!e, ar: e?.hasAttribute('aria-label') }; }, id);
    check('Input #' + id, r?.ex);
    check('Input #' + id + ' aria-label', r?.ar);
  }
  // 4. URL AUTO-FILL
  const af = await safeEval(() => ({ w: (document.getElementById('wa')?.value||'').replace(/D/g,''), n: document.getElementById('nama')?.value||'' }));
  check('WA auto-filled', af?.w === WA, af?.w);
  check('Nama auto-filled', af?.n === NAMA, af?.n);
  // 5. STEPPER (5 steps)
  check('Step 1 active', await safeEval(() => document.getElementById('step-1')?.classList.contains('active')));
  // 6. NAV BUTTONS
  const nav = await safeEval(() => ({ prev: !!document.getElementById('btnPrev'), next: !!document.getElementById('btnNext'), prevAr: document.getElementById('btnPrev')?.hasAttribute('aria-label'), nextAr: document.getElementById('btnNext')?.hasAttribute('aria-label') }));
  check('Prev button', nav?.prev);
  check('Next button', nav?.next);
  check('Prev aria-label', nav?.prevAr);
  check('Next aria-label', nav?.nextAr);
  // 7. LOGIN GATE
  const gate = await safeEval(() => ({ modal: !!document.getElementById('login-gate'), pass: !!document.getElementById('gate-pass'), passAr: document.getElementById('gate-pass')?.hasAttribute('aria-label') }));
  check('Login gate modal', gate?.modal);
  check('Password input', gate?.pass);
  check('Password aria-label', gate?.passAr);
  // 8. LANGUAGE TOGGLE
  check('Lang toggle', await safeEval(() => !!document.getElementById('lang-btn-mf')));
  // 9. LOADING STATE
  const ld = await safeEval(() => ({ ex: !!document.getElementById('loading'), al: document.getElementById('loading')?.hasAttribute('aria-live') }));
  check('Loading modal', ld?.ex);
  check('Loading aria-live', ld?.al);
  // 10. FILE INPUTS
  const files = await safeEval(() => ['photo','jft','ssw','ijazahSd','ktpFile'].map(id => !!document.getElementById(id)));
  check('Photo input', files?.[0]);
  check('JFT input', files?.[1]);
  check('SSW input', files?.[2]);
  // 11. I18N
  check('tr fn', await safeEval(() => typeof window.tr === 'function'));
  check('renderLanguageLight', await safeEval(() => typeof window.renderLanguageLight === 'function'));
  // 12. PWA
  check('SW API', await safeEval(() => 'serviceWorker' in navigator));
  check('Manifest', await safeEval(() => !!document.querySelector('link[rel="manifest"]')));
  // 13. THEME
  check('Theme', await safeEval(() => document.body.classList.contains('theme-dark') || document.body.classList.contains('theme-light')));
  // 14. KEY FUNCTIONS
  const fns = await safeEval(() => ['changeStep','submitMaster','gateLogin','handleFile'].filter(f => typeof window[f] === 'function'));
  check('Key functions exposed', fns?.length === 4, fns);
  // 15. JS ERRORS
  check('JS errors = 0', jsErrors.length === 0, jsErrors.slice(0, 3));
} finally { await browser.close(); finish(); }
