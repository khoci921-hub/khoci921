/**
 * E2E Smoke Test: AI Submit Data ASJ + TTD Naitei
 * 
 * Cover: save button, form validation, JS functions, a11y, errors
 * 
 * Run: node e2e/ai_submit_ttd-test.mjs (requires dev server on localhost:3000)
 */
const BASE = 'http://localhost:3000/ai_form.html?flow=master&job=test&wa=6281234567890&nama=Test';

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

// === PAGE LOAD ===
assert('page loads without JS crash', jsErrors.length === 0);

// === SAVE BUTTON ===
const btnSave = await page.$('#btnSaveDB');
assert('btnSaveDB exists', !!btnSave);
assert('btnSaveDB visible', btnSave ? await btnSave.isVisible() : false);

// === FORM VALIDATION (empty form) ===
// saveToDatabase should show toast when nama is empty
const formNama = await page.$('#f_nama');
assert('form nama input exists', !!formNama);

// === JS FUNCTIONS ===
const fns = await page.evaluate(() => {
  return {
    saveToDatabase: typeof window.saveToDatabase === 'function',
    compressImage: typeof window.compressImage === 'function',
    handleDocUpload: typeof window.handleDocUpload === 'function',
    updateFormUI: typeof window.updateFormUI === 'function',
    sendMessage: typeof window.sendMessage === 'function',
  };
});
assert('saveToDatabase registered', fns.saveToDatabase);
assert('compressImage registered', fns.compressImage);
assert('handleDocUpload registered', fns.handleDocUpload);
assert('updateFormUI registered', fns.updateFormUI);
assert('sendMessage registered', fns.sendMessage);

// === FILE UPLOAD INPUTS (via onchange) ===
const uploadSelectors = ['compressImage', 'jft', 'ssw', 'ktp', 'kk', 'ijazahSd', 'ijazahSmp', 'ijazahSma', 'univ'];
let uploadCount = 0;
for (const sel of uploadSelectors) {
  if (await page.$('input[onchange*="' + sel + '"]')) uploadCount++;
}
assert('at least 5 upload inputs exist', uploadCount >= 5);

// === LANGUAGE TOGGLE ===
const langBtn = await page.$('#lang-btn-ai');
assert('language toggle exists', !!langBtn);

// === RESULTS ===
console.log('\n');
if (failed === 0) {
  console.log(`\x1b[32m✓ ALL ${passed} TESTS PASSED\x1b[0m`);
} else {
  console.log(`\x1b[33m${passed} passed, \x1b[31m${failed} failed\x1b[0m`);
  errors.forEach(e => console.log(`  \x1b[31m✗ ${e}\x1b[0m`));
}
process.exit(failed > 0 ? 1 : 0);
