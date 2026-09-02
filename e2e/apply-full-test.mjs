// =============================================================
// e2e/apply-full-test.mjs — Comprehensive E2E test untuk apply-full.html
// =============================================================
// Test coverage: render, toast, navigation, draft, a11y, i18n, validation
// Run: node e2e/apply-full-test.mjs
// Env: BASE_URL, E2E_WA, E2E_NAMA
// =============================================================
import { check, waitFor, launchBrowser, finish } from './harness.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const WA = process.env.E2E_WA || '6282130442661';
const NAMA = process.env.E2E_NAMA || 'AGUS KHOCI';

const browser = await launchBrowser();
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(String(e)));

async function safeEval(fn, label) {
  for (let i = 0; i < 5; i++) {
    try { return await page.evaluate(fn); }
    catch (e) {
      if (String(e).includes('Execution context')) { await page.waitForTimeout(700); continue; }
      return null;
    }
  }
  return null;
}

try {
  console.log('
📋 apply-full.html — E2E Test
');

  // 1. PAGE LOAD
  await page.goto(BASE + '/apply-full.html?wa=' + WA + '&nama=' + encodeURIComponent(NAMA) + '&job=TG9ASJ', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  check('Page loads without crash', jsErrors.length === 0, jsErrors.slice(0, 2));
  check('Page title set', (await page.title()).includes('ASJ'));

  // 2. BACK BUTTON
  const bb = await safeEval(() => { const a = document.querySelector('a[aria-label="Kembali ke Portal"]'); return a ? { href: a.getAttribute('href'), vis: a.offsetParent !== null } : null; });
  check('Back button exists', !!bb);
  check('Back button href="/"', bb?.href === '/');
  check('Back button visible', bb?.vis);

  // 3. FORM INPUTS + ARIA
  const ids = ['job','bidang','wa','nama','email','gender','usia','tb','bb'];
  for (const id of ids) {
    const r = await safeEval((i) => { const e = document.getElementById(i); return { ex: !!e, ar: e?.hasAttribute('aria-label') }; }, id);
    check('Input #' + id + ' exists', r?.ex);
    check('Input #' + id + ' aria-label', r?.ar);
  }

  // 4. URL AUTO-FILL
  const af = await safeEval(() => ({ w: (document.getElementById('wa')?.value||'').replace(/D/g,''), n: document.getElementById('nama')?.value||'', j: document.getElementById('job')?.value||'' }));
  check('WA auto-filled', af?.w === WA, af?.w);
  check('Nama auto-filled', af?.n === NAMA, af?.n);
  check('Job auto-filled', af?.j === 'TG9ASJ', af?.j);

  // 5. STEPPER
  check('Step 1 active', await safeEval(() => document.getElementById('step-1')?.classList.contains('active')));
  await safeEval(() => { ['nama','email','wa','gender','usia','tb','bb'].forEach((id,i) => { const el = document.getElementById(id); if(el) el.value = ['TEST','t@t.com','+6281234567890','LAKI-LAKI','25','170','65'][i]; }); });
  await page.click('#btnNext'); await page.waitForTimeout(500);
  check('Step 2 after Next', await safeEval(() => document.getElementById('step-2')?.classList.contains('active')));
  await page.click('#btnPrev'); await page.waitForTimeout(500);
  check('Step 1 after Prev', await safeEval(() => document.getElementById('step-1')?.classList.contains('active')));

  // 6. TOAST
  await safeEval(() => { document.getElementById('nama').value = ''; });
  await page.click('#btnNext'); await page.waitForTimeout(500);
  const toastOk = await safeEval(() => document.body.innerHTML.includes('wajib diisi'));
  check('Toast on validation error', toastOk);

  // 7. DRAFT
  await safeEval(() => { const e = document.getElementById('nama'); e.value = 'DRAFT TEST'; });
  await safeEval(() => { const w = document.getElementById('wa'); if(w && window.formatInputWA) window.formatInputWA(w); });
  const draft = await safeEval(() => { const r = localStorage.getItem('asj_apply_draft_v1'); return r ? JSON.parse(r) : null; });
  check('Draft saved', !!draft);
  check('Draft has savedAt', draft?.savedAt > 0);
  check('Draft has nama', draft?.nama === 'DRAFT TEST');

  // 8. FILE UPLOAD
  const up = await safeEval(() => { const p = document.getElementById('photo'); return { ex: !!p, al: p?.hasAttribute('aria-label') }; });
  check('Photo input exists', up?.ex);
  check('Photo aria-label', up?.al);

  // 9. I18N
  const tr = await safeEval(() => ({ has: typeof window.tr === 'function', s: typeof window.tr === 'function' ? window.tr('form.siswa_welcome') : null }));
  check('window.tr exists', tr?.has);
  check('i18n returns string', typeof tr?.s === 'string' && tr.s.length > 0);

  // 10. PWA
  check('SW API', await safeEval(() => 'serviceWorker' in navigator));
  check('Manifest link', await safeEval(() => !!document.querySelector('link[rel="manifest"]')));

  // 11. MODALS
  check('Loading modal', await safeEval(() => !!document.getElementById('loading')));
  check('Success modal', await safeEval(() => !!document.getElementById('success')));

  // 12. ARIA-LIVE
  check('aria-live on wa-msg', await safeEval(() => document.getElementById('wa-msg')?.hasAttribute('aria-live')));

  // 13. STEPPER INDICATORS
  const si = await safeEval(() => [1,2,3].map(i => document.getElementById('indicator-'+i)?.classList.contains('active')));
  check('Indicator 1 active', si?.[0]);
  check('Indicators 2-3 inactive', !si?.[1] && !si?.[2]);

  // 14. PROGRESS LINE
  check('Progress line exists', await safeEval(() => !!document.getElementById('progress-line')));

  check('Total JS errors = 0', jsErrors.length === 0, jsErrors.slice(0,3));

} finally { await browser.close(); finish(); }
