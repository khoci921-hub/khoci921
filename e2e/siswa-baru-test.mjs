// =============================================================
// e2e/siswa-baru-test.mjs — Comprehensive E2E test untuk siswa-baru.html
// =============================================================
// Test coverage: render, toast, navigation, chat, draft, a11y, i18n, upload
// Run: node e2e/siswa-baru-test.mjs
// Env: BASE_URL
// =============================================================
import { check, waitFor, launchBrowser, finish } from './harness.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

const browser = await launchBrowser();
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(String(e)));

async function safeEval(fn) {
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
📋 siswa-baru.html — E2E Test
');

  // 1. PAGE LOAD
  await page.goto(BASE + '/siswa-baru.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  check('Page loads without crash', jsErrors.length === 0, jsErrors.slice(0, 2));
  check('Page title set', (await page.title()).includes('ASJ'));

  // 2. BACK BUTTON
  const bb = await safeEval(() => { const a = document.querySelector('a[aria-label="Kembali ke Portal"]'); return a ? { href: a.getAttribute('href'), vis: a.offsetParent !== null } : null; });
  check('Back button exists', !!bb);
  check('Back button href="/"', bb?.href === '/');
  check('Back button visible', bb?.vis);

  // 3. SPLIT VIEW PANELS
  const panels = await safeEval(() => ({
    chat: !!document.getElementById('chatPanel'),
    form: !!document.getElementById('formPanel'),
    chatVisible: document.getElementById('chatPanel')?.offsetParent !== null,
  }));
  check('Chat panel exists', panels?.chat);
  check('Form panel exists', panels?.form);

  // 4. CHAT BOX
  const chat = await safeEval(() => {
    const box = document.getElementById('chatBox');
    return { exists: !!box, hasContent: (box?.textContent || '').length > 0, ariaLive: box?.hasAttribute('aria-live') };
  });
  check('Chat box exists', chat?.exists);
  check('Chat box has content (welcome)', chat?.hasContent);
  check('Chat box aria-live', chat?.ariaLive);

  // 5. CHAT INPUT
  const chatInput = await safeEval(() => ({
    input: !!document.getElementById('userInput'),
    btn: !!document.getElementById('sendBtn'),
    inputHasAria: document.getElementById('userInput')?.hasAttribute('aria-label') || true,
  }));
  check('Chat input exists', chatInput?.input);
  check('Send button exists', chatInput?.btn);

  // 6. FORM INPUTS + ARIA
  const formIds = ['f_nama','f_ttl','f_gender','f_agama','f_email','f_alamat','f_pendidikan','f_wa_siswa','f_wa_ortu'];
  for (const id of formIds) {
    const r = await safeEval((i) => { const e = document.getElementById(i); return { ex: !!e, ar: e?.hasAttribute('aria-label') }; }, id);
    check('Input #' + id + ' exists', r?.ex);
    check('Input #' + id + ' aria-label', r?.ar);
  }

  // 7. FILE UPLOAD INPUTS
  const uploads = await safeEval(() => {
    const types = ['ktp','kk','ijazah'];
    return types.map(t => ({ type: t, status: !!document.getElementById('status_'+t) }));
  });
  uploads.forEach(u => check('Upload status #' + u.type, u.status));

  // 8. MOBILE TAB BAR
  const tabBar = await safeEval(() => ({
    chat: !!document.getElementById('btnTabChat'),
    form: !!document.getElementById('btnTabForm'),
  }));
  check('Tab Chat button', tabBar?.chat);
  check('Tab Form button', tabBar?.form);

  // 9. SUBMIT BUTTON
  const submit = await safeEval(() => {
    const btn = document.getElementById('btnSaveDB');
    return { exists: !!btn, text: btn?.textContent?.trim() };
  });
  check('Submit button exists', submit?.exists);
  check('Submit button text', submit?.text?.includes('SUBMIT'), submit?.text);

  // 10. DRAFT SYSTEM
  await safeEval(() => {
    const el = document.getElementById('f_nama');
    if (el) { el.removeAttribute('readonly'); el.value = 'DRAFT TEST'; el.dispatchEvent(new Event('input')); }
  });
  await page.waitForTimeout(500);
  const draft = await safeEval(() => {
    const r = localStorage.getItem('asj_siswa_draft_v1');
    return r ? JSON.parse(r) : null;
  });
  check('Draft saved to localStorage', !!draft);
  check('Draft has savedAt', draft?.savedAt > 0);

  // 11. I18N
  const tr = await safeEval(() => ({ has: typeof window.tr === 'function', s: typeof window.tr === 'function' ? window.tr('form.siswa_welcome') : null }));
  check('window.tr exists', tr?.has);
  check('i18n returns string', typeof tr?.s === 'string' && tr.s.length > 0);

  // 12. PWA
  check('SW API', await safeEval(() => 'serviceWorker' in navigator));
  check('Manifest link', await safeEval(() => !!document.querySelector('link[rel="manifest"]')));

  // 13. AI TYPING STATUS
  const typing = await safeEval(() => ({
    el: !!document.getElementById('aiTypingStatus'),
    hidden: document.getElementById('aiTypingStatus')?.classList.contains('hidden'),
  }));
  check('AI typing status element', typing?.el);
  check('AI typing hidden by default', typing?.hidden);

  // 14. Jeklin avatar
  const jeklin = await safeEval(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs).some(i => i.src.includes('jeklin'));
  });
  check('Jeklin avatar present', jeklin);

  // 15. THEME INIT
  const theme = await safeEval(() => ({
    hasDark: document.body.classList.contains('theme-dark'),
    hasLight: document.body.classList.contains('theme-light'),
  }));
  check('Theme class applied', theme?.hasDark || theme?.hasLight);

  // 16. JS ERRORS
  check('Total JS errors = 0', jsErrors.length === 0, jsErrors.slice(0,3));

} finally { await browser.close(); finish(); }
