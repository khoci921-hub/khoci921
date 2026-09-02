// Smoke halaman standalone (ai_form, master-full, siswa-baru, apply-full).
// Halaman ini TIDAK dimuat suite lain (login-check hanya index/admin;
// probe-cleanup load apply-full & share tanpa interaksi). Cek: render, alias
// onclick ter-expose, tidak ada error JS.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const WA = process.env.E2E_WA || '6282130442661'; // AGUS KHOCI (format 62xx)
const NAMA = process.env.E2E_NAMA || 'AGUS KHOCI';

const browser = await chromium.launch();
const page = await browser.newPage();

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log('  ✅', label);
  } else {
    fail++;
    console.log('  ❌', label);
  }
};

async function loadAndCollectErrors(url) {
  const jsErrors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (e) => jsErrors.push(String(e)));
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Poll up to 10s for chatBox to be populated (API call is async)
  for (let i = 0; i < 20; i++) {
    const has = await page.evaluate(
      () => (document.getElementById('chatBox')?.textContent || '').length > 0,
    );
    if (has) break;
    await page.waitForTimeout(500);
  }
  return jsErrors;
}

// evaluate yang tahan navigasi (konteks hancur saat halaman reload) — retry.
async function safeEval(fn, label) {
  for (let i = 0; i < 5; i++) {
    try {
      return await page.evaluate(fn);
    } catch (e) {
      if (String(e).includes('Execution context was destroyed')) {
        await page.waitForTimeout(700);
        continue;
      }
      console.log('  ⚠️ eval gagal (' + label + '):', String(e).slice(0, 160));
      return null;
    }
  }
  console.log('  ⚠️ eval tidak stabil (' + label + ')');
  return null;
}

try {
  // ---- ai_form.html ----
  let errs = await loadAndCollectErrors(
    `/ai_form.html?flow=master&wa=${WA}&nama=${encodeURIComponent(NAMA)}&job=TG9ASJ`,
  );
  const aiCtx = (await safeEval(() => window.AI_FORM_CONTEXT || {}, 'ai ctx')) || {};
  ok(aiCtx.wa === WA && aiCtx.nama === NAMA, 'ai_form: AI_FORM_CONTEXT dari URL (wa+nama+job)');
  const aiChat = await safeEval(() => {
    const el = document.getElementById('chatBox');
    return el ? el.textContent.length : 0;
  }, 'chatBox');
  ok(aiChat > 0, 'ai_form: kolom chat terisi (sapaan)', aiChat);
  const aiAliases =
    (await safeEval(
      () =>
        ['switchTab', 'sendMessage', 'saveToDatabase', 'initApp'].filter(
          (f) => typeof window[f] === 'function',
        ),
      'ai aliases',
    )) || [];
  ok(aiAliases.length === 4, 'ai_form: alias onclick ter-expose', aiAliases);
  ok(errs.length === 0, 'ai_form: 0 error JS', errs.slice(0, 2));

  // Pastikan TIDAK ada loop reload (bug lama: reload terus-menerus saat
  // membuka link tanpa sesi kandidat).
  const beforeUrl = page.url();
  await page.waitForTimeout(2500);
  ok(page.url() === beforeUrl, 'ai_form: tidak reload loop (URL stabil)', page.url());

  // ---- master-full.html ----
  errs = await loadAndCollectErrors(`/master-full.html?wa=${WA}&nama=${encodeURIComponent(NAMA)}`);
  const mfNama =
    (await safeEval(() => document.getElementById('nama')?.value || '', 'mf nama')) || '';
  ok(mfNama === NAMA, 'master-full: nama terisi dari URL', mfNama);
  const mfAliases =
    (await safeEval(
      () =>
        ['changeStep', 'submitMaster', 'handleFile', 'toggleImaMade', 'onSswSelect'].filter(
          (f) => typeof window[f] === 'function',
        ),
      'mf aliases',
    )) || [];
  ok(mfAliases.length === 5, 'master-full: alias onclick ter-expose', mfAliases);
  const step2 = await safeEval(() => {
    if (typeof window.changeStep === 'function') {
      window.changeStep(1);
      return true;
    }
    return false;
  }, 'mf step2');
  ok(step2, 'master-full: changeStep bisa dipanggil');
  await page.waitForTimeout(600);
  const step2Visible = await safeEval(
    () => document.getElementById('step-2')?.classList.contains('active'),
    'mf step2 visible',
  );
  ok(step2Visible, 'master-full: step 2 aktif setelah changeStep(1)');
  ok(errs.length === 0, 'master-full: 0 error JS', errs.slice(0, 2));

  // ---- siswa-baru.html ----
  errs = await loadAndCollectErrors('/siswa-baru.html');
  const sbForm = await safeEval(() => {
    const f = document.getElementById('formPanel') || document.querySelector('form');
    return !!f && !!document.getElementById('f_wa_siswa');
  }, 'sb form');
  ok(sbForm, 'siswa-baru: form render (formPanel + f_wa_siswa)');
  ok(errs.length === 0, 'siswa-baru: 0 error JS', errs.slice(0, 2));

  // ---- apply-full.html (dengan param bridge) ----
  errs = await loadAndCollectErrors(
    `/apply-full.html?wa=${WA}&nama=${encodeURIComponent(NAMA)}&job=TG9ASJ`,
  );
  const afWaRaw = (await safeEval(() => document.getElementById('wa')?.value || '', 'af wa')) || '';
  const afWa = afWaRaw.replace(/\D/g, '');
  ok(afWa === WA, 'apply-full: WA terisi dari URL (normalisasi digit)', afWaRaw);
  const afAliases = await safeEval(
    () => typeof window.applyDocsPlan === 'function' && typeof window.submitApply === 'function',
    'af aliases',
  );
  ok(afAliases, 'apply-full: alias ter-expose (applyDocsPlan/submitApply)');
  ok(errs.length === 0, 'apply-full: 0 error JS', errs.slice(0, 2));

  console.log(`\n${fail === 0 ? '🎉 SEMUA LULUS' : '💥 ADA GAGAL'} (pass=${pass} fail=${fail})`);
} finally {
  await browser.close();
}
process.exit(fail ? 1 : 0);
