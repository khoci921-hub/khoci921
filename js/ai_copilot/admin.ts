import { currentAdminName, isAdmin } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';

// Retry helper (same as ai_form.ts)
async function withRetry(fn, maxAttempts, delayMs) {
  maxAttempts = maxAttempts || 2;
  delayMs = delayMs || 2000;
  var lastErr;
  for (var i = 0; i < maxAttempts; i++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ==========================================
// AI HR COPILOT (QWEEN JEKLIN) — chat admin + auto-fill form kandidat
// ==========================================
export let adminAiHistory = [];
export let currentAiCandidateId = null;
export const urlFotoJeklin =
  'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/jeklin.png';

export function bukaAdminAiCopilot(candidateId) {
  if (!isAdmin) {
    window.showToast(window.tr('ui.toast_admin_login_first'), 'error');
    return;
  }
  currentAiCandidateId = candidateId || null;
  var modalAi = document.getElementById('modal-admin-ai');
  if (modalAi) modalAi.classList.remove('hidden');
  window.pastikanBarParseAdminAi();
  const chatBox = document.getElementById('admin-ai-chat');
  if (!chatBox) return;

  chatBox.innerHTML = `
        <div class="flex items-start gap-3 mt-4">
            <img src="https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/jeklin.png" class="w-8 h-8 rounded-full object-cover shadow-sm border border-amber-400 flex-shrink-0" alt="Jeklin">
            <div class="bg-slate-800 text-slate-200 text-sm p-3.5 rounded-2xl rounded-tl-none shadow-md border border-amber-500/20" style="max-width: 85%; width: fit-content;">
                <p class="whitespace-pre-wrap m-0 leading-relaxed">${window.tr('ui.ai_welcome')}</p>
            </div>
        </div>`;

  adminAiHistory = [];
  tampilkanSaranAdminAi([
    window.tr('ui.ai_sug1'),
    window.tr('ui.ai_sug2'),
    window.tr('ui.ai_sug3'),
  ]);
}

export function tutupAdminAi() {
  var modalClose = document.getElementById('modal-admin-ai');
  if (modalClose) modalClose.classList.add('hidden');
}

export async function kirimPesanAdminAi(event?: any) {
  if (event && event.type === 'keypress' && event.key !== 'Enter') return;
  const input = document.getElementById('admin-ai-input');
  const msg = input.value.trim();
  if (!msg) return;

  tambahPesanAdminAi(msg, 'user');
  input.value = '';
  input.disabled = true;
  var sugEl = document.getElementById('admin-ai-suggestions');
  if (sugEl) sugEl.innerHTML = '';

  const typingId = 'typing-' + Date.now();
  const chatBox = document.getElementById('admin-ai-chat');

  chatBox.insertAdjacentHTML(
    'beforeend',
    '<div id="' +
      typingId +
      '" class="flex items-start gap-3 mt-4 fade-in">' +
      '<img src="' +
      urlFotoJeklin +
      '" class="w-8 h-8 rounded-full object-cover shadow-sm border border-amber-400 flex-shrink-0" alt="Jeklin" onerror="this.style.display=\'none\'">' +
      '<div class="bg-slate-800 p-3.5 rounded-2xl rounded-tl-none shadow-md border border-amber-500/20 flex gap-1.5 items-center h-10" style="width: fit-content;">' +
      '<div class="w-2 h-2 bg-amber-500/80 rounded-full animate-bounce"></div>' +
      '<div class="w-2 h-2 bg-amber-500/80 rounded-full animate-bounce" style="animation-delay: 0.15s"></div>' +
      '<div class="w-2 h-2 bg-amber-500/80 rounded-full animate-bounce" style="animation-delay: 0.3s"></div>' +
      '</div>' +
      '</div>',
  );
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

  try {
    // Trim history to last 20 messages to avoid Gemini token overflow
    var trimmedHistory = adminAiHistory.slice(-20);
    const res = await withRetry(function() {
      return window.callAPI('processAdminAIChat', [
        {
          adminName: currentAdminName,
          message: msg,
          history: trimmedHistory,
          candidateId: currentAiCandidateId,
        },
      ]);
    }, 2, 2000);
    let typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    if (res && res.success === false && res.error) {
      console.error('[AI] processAdminAIChat:', res.error);
      tambahPesanAdminAi('Waduh sistem Jeklin lagi sibuk kak, coba beberapa saat lagi ya!', 'ai');
      return;
    }
    var inputEl = document.getElementById('admin-ai-input');
    if (inputEl) inputEl.disabled = false;
    let replyText =
      res.reply ||
      (res.data ? JSON.stringify(res.data) : 'Jeklin bingung nih kak, coba tanya lagi ya!');
    tambahPesanAdminAi(replyText, 'ai');
    if (res.suggestedActions && res.suggestedActions.length > 0) {
      tampilkanSaranAdminAi(res.suggestedActions);
    }

    // AUTO-FILL LOGIC: Update right panel if analysis data is present
    if (res.analysis) {
      autoFillFormDariAi(res.analysis);
    }

    adminAiHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: replyText });
  } catch (err) {
    console.error('[AI] admin chat error:', err);
    let typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    var inputEl2 = document.getElementById('admin-ai-input');
    if (inputEl2) inputEl2.disabled = false;
    tambahPesanAdminAi('Waduh Jeklin lagi sibuk nih, coba beberapa saat lagi ya!', 'ai');
  }
}

export function autoFillFormDariAi(data) {
  if (!data) return;

  // Fill text fields
  var elNama = document.getElementById('ai-k-nama');
  var elWa = document.getElementById('ai-k-wa');
  var elLoker = document.getElementById('ai-k-loker');
  var elUsia = document.getElementById('ai-k-usia');
  if (data.nama_lengkap && elNama) elNama.value = data.nama_lengkap;
  if (data.no_whatsapp && elWa) elWa.value = data.no_whatsapp;
  if (data.job_dilamar && elLoker) elLoker.value = data.job_dilamar;
  if (data.usia && elUsia) elUsia.value = data.usia;

  // Fill dual-language fields
  if (data.gender) {
    var elGId = document.getElementById('ai-k-gender-id');
    var elGJp = document.getElementById('ai-k-gender-jp');
    if (data.gender.id_indonesia && elGId) elGId.value = data.gender.id_indonesia;
    if (data.gender.id_jepang && elGJp) elGJp.value = data.gender.id_jepang;
  }

  if (data.status_nikah) {
    var elNId = document.getElementById('ai-k-nikah-id');
    var elNJp = document.getElementById('ai-k-nikah-jp');
    if (data.status_nikah.id_indonesia && elNId) elNId.value = data.status_nikah.id_indonesia;
    if (data.status_nikah.id_jepang && elNJp) elNJp.value = data.status_nikah.id_jepang;
  }

  // Flash the form to show it updated
  const formPanel = document.getElementById('form-ai-autofill');
  if (formPanel) {
    formPanel.classList.add('ring-2', 'ring-sky-400', 'bg-sky-900/20');
    setTimeout(() => {
      formPanel.classList.remove('ring-2', 'ring-sky-400', 'bg-sky-900/20');
    }, 800);
  }
}

export function simpanKandidatDariAi() {
  const nama = document.getElementById('ai-k-nama').value;
  const wa = document.getElementById('ai-k-wa').value;
  const loker = document.getElementById('ai-k-loker').value;

  if (!nama || !wa) {
    if (typeof window.showToast !== 'undefined')
      window.showToast(window.tr('ui.toast_name_wa_required'), 'error');
    return;
  }

  // Transfer to the main upload modal for final file attachments
  var elKNama = document.getElementById('k-nama');
  var elKWa = document.getElementById('k-wa');
  var elKLoker = document.getElementById('k-loker');
  if (elKNama) (elKNama as HTMLInputElement).value = nama;
  if (elKWa) elKWa.value = wa;
  if (elKLoker) elKLoker.value = loker;

  tutupAdminAi();
  document.getElementById('modal-tambah-kandidat').classList.remove('hidden');
  if (typeof window.showToast !== 'undefined')
    window.showToast(window.tr('ui.toast_data_transferred'), 'success');
}

export function tambahPesanAdminAi(text, sender) {
  const chatBox = document.getElementById('admin-ai-chat');
  if (!chatBox) return;
  const isUser = sender === 'user';

  let cleanText = window.esc(text);
  cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  let htmlStr = '';
  if (isUser) {
    htmlStr =
      '<div class="flex justify-end gap-3 mt-4 fade-in">' +
      '<div class="bg-sky-600 text-white text-sm p-3.5 rounded-2xl rounded-tr-none shadow-md" style="max-width: 85%; width: fit-content;">' +
      '<p class="whitespace-pre-wrap m-0 leading-relaxed">' +
      cleanText +
      '</p>' +
      '</div>' +
      '</div>';
  } else {
    htmlStr =
      '<div class="flex items-start gap-3 mt-4 fade-in">' +
      '<img src="' +
      urlFotoJeklin +
      '" class="w-8 h-8 rounded-full object-cover shadow-sm border border-amber-400 flex-shrink-0" alt="Jeklin" onerror="this.style.display=\'none\'">' +
      '<div class="bg-slate-800 text-slate-200 text-sm p-3.5 rounded-2xl rounded-tl-none shadow-md border border-amber-500/20" style="max-width: 85%; width: fit-content;">' +
      '<p class="whitespace-pre-wrap m-0 leading-relaxed">' +
      cleanText +
      '</p>' +
      '</div>' +
      '</div>';
  }

  chatBox.insertAdjacentHTML('beforeend', htmlStr);
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}

export function tampilkanSaranAdminAi(actions) {
  const cont = document.getElementById('admin-ai-suggestions');
  if (!cont) return;
  cont.innerHTML = '';
  actions.forEach((act) => {
    const btn = document.createElement('button');
    btn.className =
      'whitespace-nowrap px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs rounded-full transition-colors font-medium border border-slate-700 flex-shrink-0 shadow-sm';
    btn.innerText = act;
    btn.onclick = () => {
      document.getElementById('admin-ai-input').value = act;
      kirimPesanAdminAi();
    };
    cont.appendChild(btn);
  });
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (admin/index bukaAdminAiCopilot, partials tutupAdminAi /
// kirimPesanAdminAi / simpanKandidatDariAi). currentAiCandidateId memakai
// ACCESSOR get/set (di-reassign bare di bukaAdminAiCopilot; dibaca
// parse.js & results.js) — pola state.js §3.2. urlFotoJeklin const → alias
// biasa (dibaca interview.js). tambahPesanAdminAi dipakai parse.js & results.js.
Object.defineProperty(window, 'currentAiCandidateId', {
  configurable: true,
  get() {
    return currentAiCandidateId;
  },
  set(v) {
    currentAiCandidateId = v;
  },
});
registerSeamAliases(
  {
    bukaAdminAiCopilot,
    tutupAdminAi,
    kirimPesanAdminAi,
    simpanKandidatDariAi,
    tambahPesanAdminAi,
    urlFotoJeklin, // const string → data eksplisit (allowNonFunction)
  },
  { allowNonFunction: true, source: 'js/ai_copilot/admin.js' },
);
