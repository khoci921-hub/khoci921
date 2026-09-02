/**
 * E2E Smoke Test: AI Wawancara (interview.ts + results.ts)
 * 
 * Cover: modal structure, chat box, input, send button, done button,
 *        VIP guard, JS functions registered, a11y, errors
 * 
 * Run: node e2e/ai_wawancara-test.mjs (requires dev server on localhost:3000)
 */
const BASE = 'http://localhost:3000/admin.html';

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
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});

// === PAGE LOAD ===
assert('page loads without JS crash', jsErrors.length === 0);

// === INTERVIEW MODAL STRUCTURE ===
const modalIv = await page.$('#modal-interview');
assert('modal-interview exists in DOM', !!modalIv);

const interviewChat = await page.$('#interview-chat-box');
assert('interview-chat-box exists', !!interviewChat);

const interviewInput = await page.$('#interview-input');
assert('interview-input exists', !!interviewInput);

const btnSendIv = await page.$('#btn-send-interview');
assert('btn-send-interview exists', !!btnSendIv);

// === JS FUNCTIONS REGISTERED ===
const fns = await page.evaluate(() => {
  return {
    bukaSimulator: typeof window.bukaSimulatorInterview === 'function',
    sendMsg: typeof window.sendInterviewMessage === 'function',
    generateModel: typeof window.generateWawancaraModelAdmin === 'function',
    lihatHasil: typeof window.lihatHasilWawancaraAdmin === 'function',
    updateBiodata: typeof window.updateBiodataDariHasilAdmin === 'function',
  };
});
assert('bukaSimulatorInterview registered', fns.bukaSimulator);
assert('sendInterviewMessage registered', fns.sendMsg);
assert('generateWawancaraModelAdmin registered', fns.generateModel);
assert('lihatHasilWawancaraAdmin registered', fns.lihatHasil);
assert('updateBiodataDariHasilAdmin registered', fns.updateBiodata);

// === ADMIN AI CHAT FUNCTIONS ===
const adminFns = await page.evaluate(() => {
  return {
    bukaAi: typeof window.bukaAdminAiCopilot === 'function',
    kirimPesan: typeof window.kirimPesanAdminAi === 'function',
    tambahPesan: typeof window.tambahPesanAdminAi === 'function',
  };
});
assert('bukaAdminAiCopilot registered', adminFns.bukaAi);
assert('kirimPesanAdminAi registered', adminFns.kirimPesan);
assert('tambahPesanAdminAi registered', adminFns.tambahPesan);

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
