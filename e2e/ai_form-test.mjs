/**
 * E2E Smoke Test: ai_form.html
 * 
 * Cover: page load, back button, split view, chat, form, file upload,
 *        i18n, PWA, a11y, typing indicator, save button, theme
 * 
 * Run: node e2e/ai_form-test.mjs (requires dev server on localhost:3000)
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
await page.waitForTimeout(2000);

// === PAGE LOAD ===
assert('page loads without JS crash', jsErrors.length === 0);
assert('title', (await page.title()).includes('ASJ'));

// === BACK BUTTON ===
const backBtn = await page.$('a[href="/"]');
assert('back button exists', !!backBtn);
assert('back button aria-label', backBtn ? (await backBtn.getAttribute('aria-label')) === 'Kembali ke Portal' : false);
assert('back button visible', backBtn ? await backBtn.isVisible() : false);

// === SPLIT VIEW ===
assert('chatPanel exists', !!(await page.$('#chatPanel')));
assert('formPanel exists', !!(await page.$('#formPanel')));

// === CHAT BOX ===
const chatBox = await page.$('#chatBox');
assert('chatBox exists', !!chatBox);
assert('chatBox has aria-live', chatBox ? (await chatBox.getAttribute('aria-live')) === 'polite' : false);

// === CHAT INPUT ===
const userInput = await page.$('#userInput');
assert('userInput exists', !!userInput);
assert('userInput aria-label', userInput ? (await userInput.getAttribute('aria-label')) === 'Ketik pesan' : false);
assert('sendBtn exists', !!(await page.$('#sendBtn')));

// === FORM INPUTS (check key inputs exist) ===
const keyInputs = ['f_nama', 'f_hp', 'f_gender', 'f_tb', 'f_bb', 'f_promo_id', 'f_lebih_id', 'f_moti_id', 'f_alasan_id'];
let inputCount = 0;
for (const id of keyInputs) {
  if (await page.$('#' + id)) inputCount++;
}
assert('at least 7 key form inputs exist', inputCount >= 7);

// === FILE UPLOAD INPUTS ===
const uploadInput = await page.$('input[onchange*="compressImage"]');
assert('foto input exists', !!uploadInput);

// === TAB BAR ===
const tabChat = await page.$('#btnTabChat');
const tabForm = await page.$('#btnTabForm');
assert('tabChat exists', !!tabChat);
assert('tabForm exists', !!tabForm);
assert('tabChat aria-label', tabChat ? (await tabChat.getAttribute('aria-label')) === 'Tab Chat' : false);

// === AI TYPING INDICATOR ===
assert('aiTypingStatus exists', !!(await page.$('#aiTypingStatus')));
assert('aiTypingStatus hidden by default', await page.$eval('#aiTypingStatus', el => el.classList.contains('hidden')));

// === SAVE BUTTON ===
const btnSave = await page.$('#btnSaveDB');
assert('btnSaveDB exists', !!btnSave);
assert('btnSaveDB aria-label', btnSave ? (await btnSave.getAttribute('aria-label')) === 'Simpan ke database' : false);

// === JEKLIN AVATAR ===
const jeklinImg = await page.$('#chatPanel img');
assert('jeklin avatar in chat header', !!jeklinImg);

// === I18N ===
assert('window.tr exists', (await page.evaluate(() => typeof window.tr)) === 'function');
assert('tr returns string', typeof await page.evaluate(() => window.tr('form.chat_welcome_nameless')) === 'string');

// === PWA ===
assert('SW API exists', (await page.evaluate(() => 'serviceWorker' in navigator)) === true);
assert('manifest link exists', !!(await page.$('link[rel="manifest"]')));

// === THEME ===
assert('body has theme class', await page.evaluate(() => document.body.classList.contains('theme-dark') || document.body.classList.contains('theme-light')));

// === JS ERRORS AFTER ALL ===
assert('no JS errors during test', jsErrors.length === 0);

await browser.close();

console.log(`\n\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (errors.length) console.log('Failed:', errors.join(', '));
process.exit(failed > 0 ? 1 : 0);
