import { ALL_CANDIDATES, currentKandidatName, currentKandidatWa } from '../init/state.ts';
import { ensureAllCandidates } from '../api/candidates.ts';
import { registerSeamAliases } from '../core/bridge.ts';

// Retry helper
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
// SIMULATOR WAWANCARA VIP — latihan wawancara kandidat dengan AI Jeklin
// ==========================================
export let interviewHistory = [];

export async function bukaSimulatorInterview() {
  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  // Cari data kandidat yang sedang login
  let myData = ALL_CANDIDATES.find(
    (c) => window.normalizePhone(c.wa) === window.normalizePhone(currentKandidatWa),
  );
  if (!myData) return window.showToast(window.tr('ui.toast_session_invalid_relogin'), 'error');

  // Cek status VIP / KELAS dari catatan internal (helper sama dengan AI CV di 03_candidate.js)
  let isVip = window.isVipCatatan(myData.catatanInt);

  if (!isVip) {
    window.showToast(window.tr('ui.toast_feature_locked'), 'info');
    return;
  }

  // Jika VIP, buka modal
  var modalIv = document.getElementById('modal-interview');
  if (modalIv) modalIv.classList.remove('hidden');
  pastikanTombolSelesaiInterview();

  // Reset chat & langsung mulai: AI menanyakan pertanyaan pertama sesuai
  // bidang SSW kandidat (wawancara natural seperti manusia, bukan kuesioner).
  let chatBox = document.getElementById('interview-chat-box');
  chatBox.innerHTML = '';
  interviewHistory = [];
  await mulaiWawancaraInterview();
}

export function pastikanTombolSelesaiInterview() {
  if (document.getElementById('btn-done-interview')) return;
  const sendBtn = document.getElementById('btn-send-interview');
  if (!sendBtn || !sendBtn.parentElement) return;
  const btn = document.createElement('button');
  btn.id = 'btn-done-interview';
  btn.type = 'button';
  btn.onclick = selesaikanWawancaraInterview;
  btn.className =
    'w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex flex-col items-center justify-center shadow-lg transition active:scale-95 flex-shrink-0';
  btn.title = window.tr('ui.ai_interview_done_btn');
  btn.innerHTML =
    '<i class="fas fa-check-double text-lg"></i><span class="text-[7px] font-black leading-none mt-0.5">' +
    window.tr('ui.ai_interview_done_text') +
    '</span>';
  sendBtn.parentElement.appendChild(btn);
}

// Kandidat selesai → rangkum hasil wawancara (Gemini dari transcript) →
// simpan ke admin (ai_form_submissions submitted_via=interview) → admin bisa
// lihat & update biodata dari hasil.
export async function selesaikanWawancaraInterview() {
  const inputEl = document.getElementById('interview-input');
  const btnEl = document.getElementById('btn-send-interview');
  const doneBtn = document.getElementById('btn-done-interview');
  const typingEl = document.getElementById('interview-typing');
  if (interviewHistory.length === 0) {
    window.showToast(window.tr('ui.ai_interview_not_started'), 'info');
    return;
  }
  if (doneBtn) doneBtn.disabled = true;
  if (btnEl) btnEl.disabled = true;
  if (inputEl) inputEl.disabled = true;
  if (typingEl) {
    typingEl.classList.remove('hidden');
    typingEl.textContent = window.tr('ui.ai_interview_summarizing');
  }
  try {
    const res = await withRetry(function() {
      return window.callAPI('selesaikanWawancara', [
        { wa: currentKandidatWa, history: interviewHistory },
      ]);
    }, 2, 2000);
    if (!res || res.success === false) {
      throw new Error((res && res.error) || 'Gagal merangkum hasil');
    }
    await kirimHasilWawancaraKeAdmin(res.hasil);
    if (typeof window.showToast === 'function') {
      window.showToast(window.tr('ui.ai_interview_sent'), 'success');
    }
  } catch (err) {
    console.error('[AI] selesaikan wawancara:', err);
    appendInterviewChat(
      'ai',
      '⚠️ Gagal merangkum hasil: ' + window.esc(err && err.message ? err.message : 'AI sibuk'),
    );
  } finally {
    if (doneBtn) doneBtn.disabled = false;
    if (btnEl) btnEl.disabled = false;
    if (inputEl) inputEl.disabled = false;
    if (typingEl) typingEl.classList.add('hidden');
    if (inputEl) inputEl.focus();
  }
}

export async function mulaiWawancaraInterview() {
  const chatBox = document.getElementById('interview-chat-box');
  const typingId = 'iv-typing-' + Date.now();
  chatBox.insertAdjacentHTML(
    'beforeend',
    '<div id="' +
      typingId +
      '" class="flex items-start gap-3 mt-4">' +
      '<img src="' +
      window.urlFotoJeklin +
      '" class="w-8 h-8 rounded-full object-cover shadow-sm border border-violet-400 flex-shrink-0" alt="Jeklin" onerror="this.style.display=\'none\'">' +
      '<div class="bg-slate-800 p-3.5 rounded-2xl rounded-tl-none shadow-md border border-violet-500/30 flex gap-1.5 items-center h-10" style="width: fit-content;">' +
      '<div class="w-2 h-2 bg-violet-400/80 rounded-full animate-bounce"></div>' +
      '<div class="w-2 h-2 bg-violet-400/80 rounded-full animate-bounce" style="animation-delay: 0.15s"></div>' +
      '<div class="w-2 h-2 bg-violet-400/80 rounded-full animate-bounce" style="animation-delay: 0.3s"></div>' +
      '</div>' +
      '</div>',
  );
  chatBox.scrollTop = chatBox.scrollHeight;
  try {
    const res = await withRetry(function() {
      return window.callAPI('processAiInterview', {
        wa: currentKandidatWa,
        candidateName: currentKandidatName,
        history: [],
      });
    }, 2, 2000);
    const el = document.getElementById(typingId);
    if (el) el.remove();
    const reply =
      (res && res.reply) ||
      'Konnichiwa ' + currentKandidatName + '-san! Mari mulai wawancara kita.';
    appendInterviewChat('ai', reply);
    interviewHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    console.error('[AI] mulai wawancara:', err);
    const el = document.getElementById(typingId);
    if (el) el.remove();
    appendInterviewChat(
      'ai',
      `Konnichiwa **${currentKandidatName}**-san! Saya Jeklin-sensei.\nKetik jawabanmu untuk memulai latihan wawancara ya!`,
    );
  }
}

export function appendInterviewChat(sender, text) {
  let chatBox = document.getElementById('interview-chat-box');
  let isUser = sender === 'user';

  let cleanText = window.esc(text);
  cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  cleanText = cleanText.replace(/\n/g, '<br>'); // Mengganti baris baru agar rapi

  let htmlStr = '';
  if (isUser) {
    htmlStr =
      '<div class="flex justify-end gap-3 mt-4 fade-in">' +
      '<div class="bg-violet-600 text-white text-sm p-3.5 rounded-2xl rounded-tr-none shadow-md" style="max-width: 85%; width: fit-content;">' +
      '<p class="whitespace-pre-wrap m-0 leading-relaxed">' +
      cleanText +
      '</p>' +
      '</div>' +
      '</div>';
  } else {
    // Struktur dan styling ini disamakan PERSIS dengan AI HR Copilot
    htmlStr =
      '<div class="flex items-start gap-3 mt-4 fade-in">' +
      '<img src="' +
      window.urlFotoJeklin +
      '" class="w-8 h-8 rounded-full object-cover shadow-sm border border-violet-400 flex-shrink-0" alt="Jeklin" onerror="this.style.display=\'none\'">' +
      '<div class="bg-slate-800 text-slate-200 text-sm p-3.5 rounded-2xl rounded-tl-none shadow-md border border-violet-500/30" style="max-width: 85%; width: fit-content;">' +
      '<p class="whitespace-pre-wrap m-0 leading-relaxed">' +
      cleanText +
      '</p>' +
      '</div>' +
      '</div>';
  }

  chatBox.insertAdjacentHTML('beforeend', htmlStr);
  chatBox.scrollTop = chatBox.scrollHeight;
}

export async function sendInterviewMessage() {
  let inputEl = document.getElementById('interview-input');
  let btnEl = document.getElementById('btn-send-interview');
  let typingEl = document.getElementById('interview-typing');

  let text = inputEl.value.trim();
  if (!text) return;

  appendInterviewChat('user', text);
  interviewHistory.push({ role: 'user', content: text });
  inputEl.value = '';

  inputEl.disabled = true;
  btnEl.disabled = true;
  typingEl.classList.remove('hidden');

  let payload = {
    wa: currentKandidatWa,
    candidateName: currentKandidatName,
    history: interviewHistory.slice(-20), // Kirim 20 chat terakhir agar AI punya konteks cukup
  };

  try {
    const res = await withRetry(function() {
      return window.callAPI('processAiInterview', payload);
    }, 2, 2000);
    if (res && res.reply) {
      const reply = String(res.reply);
      const marker = reply.indexOf('===HASIL===');
      if (marker >= 0) {
        // Wawancara selesai: pisahkan ucapan penutup & JSON hasil.
        const chatPart = reply.slice(0, marker).trim();
        const hasilTxt = reply.slice(marker + '===HASIL==='.length).trim();
        if (chatPart) appendInterviewChat('ai', chatPart);
        const hasil = cobaParseJsonLoose(hasilTxt);
        if (hasil) {
          await kirimHasilWawancaraKeAdmin(hasil);
        } else {
          appendInterviewChat('ai', hasilTxt);
        }
        interviewHistory.push({ role: 'assistant', content: chatPart || reply });
      } else {
        appendInterviewChat('ai', reply);
        interviewHistory.push({ role: 'assistant', content: reply });
      }
    }
  } catch (err) {
    appendInterviewChat('ai', '<i>Koneksi terputus. Silakan kirim ulang jawabanmu.</i>');
  } finally {
    inputEl.disabled = false;
    btnEl.disabled = false;
    inputEl.focus();
    typingEl.classList.add('hidden');
  }
}

export function cobaParseJsonLoose(text) {
  let t = String(text || '').trim();
  t = t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    const s = t.indexOf('{');
    const e2 = t.lastIndexOf('}');
    if (s >= 0 && e2 > s) {
      try {
        return JSON.parse(t.slice(s, e2 + 1));
      } catch (e3) {
        /* gagal */
      }
    }
    return null;
  }
}

// Simpan hasil wawancara (dari penutup AI) → ai_form_submissions (mode
// 'wawancara') supaya admin bisa lihat & update biodata dari hasil wawancara.
export async function kirimHasilWawancaraKeAdmin(hasil) {
  let res = null;
  try {
    res = await withRetry(function() {
      return window.callAPI('simpanHasilWawancara', [{ wa: currentKandidatWa, hasil }]);
    }, 2, 2000);
  } catch (err) {
    console.error('[AI] simpan hasil wawancara:', err);
  }
  const score = hasil.score !== undefined ? hasil.score + '/10' : '-';
  const nilai = hasil.nilai ? ' (' + String(hasil.nilai) + ')' : '';
  const nField = hasil.biodata ? Object.keys(hasil.biodata).length : 0;
  let msg =
    '📊 **Hasil Wawancara**\n⭐ Skor: ' +
    score +
    nilai +
    '\n🧬 Data biodata terekam: ' +
    nField +
    ' field';
  if (hasil.rekomendasi) msg += '\n💡 Rekomendasi: ' + String(hasil.rekomendasi);
  msg +=
    res && res.success
      ? '\n✅ **Hasil terkirim ke admin** — siap di-update ke biodata.'
      : '\n⚠️ Gagal kirim hasil ke admin.';
  appendInterviewChat('ai', msg);
}

registerSeamAliases({
  bukaSimulatorInterview,
  sendInterviewMessage,
});
