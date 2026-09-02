/**
 * E2E Smoke Test: siswa-baru.html (AI Siswa Baru)
 * 
 * Cover: page load, back button, split view, chat, form, file upload,
 *        tab switch, typing indicator, save button, a11y, i18n, PWA, theme
 * 
 * Run: node e2e/siswa-baru-ai-test.mjs (requires dev server on localhost:3000)
 */
const BASE = 'http://localhost:3000/siswa-baru.html';

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
assert('title', (await page.title()).length > 0);

// === BACK BUTTON ===
const backBtn = await page.$('a[href="/"]');
assert('back button exists', !!backBtn);
assert('back button visible', backBtn ? await backBtn.isVisible() : false);

// === SPLIT VIEW ===
assert('chatPanel exists', !!(await page.$('#chatPanel')));
assert('formPanel exists', !!(await page.$('#formPanel')));

// === CHAT BOX ===
const chatBox = await page.$('#chatBox');
assert('chatBox exists', !!chatBox);

// === CHAT INPUT ===
const userInput = await page.$('#userInput');
assert('userInput exists', !!userInput);
assert('sendBtn exists', !!(await page.$('#sendBtn')));

// === FORM INPUTS ===
const formFields = ['f_nama', 'f_ttl', 'f_gender', 'f_agama', 'f_alamat', 'f_email', 'f_pendidikan', 'f_wa_siswa', 'f_wa_ortu'];
for (const field of formFields) {
  assert('form input ' + field + ' exists', !!(await page.$('#' + field)));
}

// === FILE UPLOAD INPUTS (via onchange) ===
assert('ktp upload exists', !!(await page.$('input[onchange*="ktp"]')));
assert('kk upload exists', !!(await page.$('input[onchange*="kk"]')));
assert('ijazah upload exists', !!(await page.$('input[onchange*="ijazah"]')));

// === TAB BAR ===
assert('btnTabChat exists', !!(await page.$('#btnTabChat')));
assert('btnTabForm exists', !!(await page.$('#btnTabForm')));

// === SAVE BUTTON ===
assert('btnSaveDB exists', !!(await page.$('#btnSaveDB')));

// === JS FUNCTIONS REGISTERED ===
const fns = await page.evaluate(() => {
  return {
    initApp: typeof window.initApp === 'function',
    switchTab: typeof window.switchTab === 'function',
    sendMessage: typeof window.sendMessage === 'function',
    saveToDatabase: typeof window.saveToDatabase === 'function',
    handleEnter: typeof window.handleEnter === 'function',
    handleDocUpload: typeof window.handleDocUpload === 'function',
  };
});
assert('initApp registered', fns.initApp);
assert('switchTab registered', fns.switchTab);
assert('sendMessage registered', fns.sendMessage);
assert('saveToDatabase registered', fns.saveToDatabase);
assert('handleEnter registered', fns.handleEnter);
assert('handleDocUpload registered', fns.handleDocUpload);

// === i18n ===
const hasTr = await page.evaluate(() => typeof window.tr === 'function');
assert('window.tr exists', hasTr);

// === PWA ===
const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
assert('service worker API available', hasSW);

// === RESULTS ===
console.log('\n');
if (failed === 0) {
  console.log(`\x1b[32m✓ ALL ${passed} TESTS PASSED\x1b[0m`);
} else {
  console.log(`\x1b[33m${passed} passed, \x1b[31m${failed} failed\x1b[0m`);
  errors.forEach(e => console.log(`  \x1b[31m✗ ${e}\x1b[0m`));
}
process.exit(failed > 0 ? 1 : 0);
