import { isAdmin } from '../init/state.ts';
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
// MODEL & HASIL WAWANCARA (admin) — generate model per bidang SSW, lihat
// hasil wawancara kandidat, update biodata dari hasil
// ==========================================

// ==========================================
// MODEL WAWANCARA per bidang SSW (admin): hasilkan dokumen 14 pertanyaan
// (ID + romaji + panduan jawaban) sesuai bidang SSW kandidat — siap disalin
// ke Google Sheet kandidat, gaya dokumen wawancara kaigo yang dibagikan tim.
// ==========================================
export async function generateWawancaraModelAdmin() {
  if (!isAdmin) {
    window.showToast(window.tr('ui.toast_admin_login_first'), 'error');
    return;
  }
  const waInput = document.getElementById('admin-ai-wa');
  const wa = waInput ? waInput.value.trim() : '';
  const bidangInput = document.getElementById('admin-ai-bidang');
  const bidang = bidangInput ? bidangInput.value.trim() : '';
  if (!wa && !window.currentAiCandidateId) {
    window.showToast(window.tr('ui.ai_fill_wa_first'), 'error');
    return;
  }
  const statusEl = document.getElementById('admin-ai-parse-status');
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.textContent = window.tr('ui.ai_generating_model');
  }
  try {
    const res = await withRetry(function() {
      return window.callAPI('generateWawancaraModel', [
        {
          candidateId: window.currentAiCandidateId || undefined,
          wa: wa || undefined,
          bidang: bidang || undefined,
        },
      ]);
    }, 2, 2000);
    if (!res || res.success === false) {
      throw new Error((res && res.error) || 'Gagal membuat model wawancara');
    }
    const chatBox = document.getElementById('admin-ai-chat');
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    window.tambahPesanAdminAi(
      '📋 **Model Wawancara — ' +
        window.esc(res.nama || res.bidang || 'SSW') +
        ' (' +
        window.esc(res.bidang) +
        ')**\n' +
        'Bidang SSW: ' +
        window.esc(res.bidang) +
        '\n\n' +
        window.esc(res.model),
      'ai',
    );
    if (waInput && res.wa) waInput.value = res.wa;
    if (typeof window.showToast === 'function') {
      window.showToast(window.tr('ui.ai_model_ready'), 'success');
    }
    if (statusEl) statusEl.classList.add('hidden');
  } catch (err) {
    console.error('[AI] generateWawancaraModel:', err);
    window.tambahPesanAdminAi(
      '⚠️ Gagal membuat model wawancara: ' +
        window.esc(err && err.message ? err.message : 'AI sibuk'),
      'ai',
    );
    if (statusEl) {
      statusEl.textContent = '❌ ' + (err && err.message ? err.message : 'Gagal');
      setTimeout(() => statusEl.classList.add('hidden'), 8000);
    }
  }
}

// ==========================================
// HASIL WAWANCARA (admin): lihat hasil wawancara AI kandidat + update biodata
// ==========================================
export let lastAdminHasil = null;

export async function lihatHasilWawancaraAdmin() {
  if (!isAdmin) {
    window.showToast(window.tr('ui.toast_admin_login_first'), 'error');
    return;
  }
  const waInput = document.getElementById('admin-ai-wa');
  const wa = waInput ? waInput.value.trim() : '';
  if (!wa && !window.currentAiCandidateId) {
    window.showToast(window.tr('ui.ai_fill_wa_first'), 'error');
    return;
  }
  const statusEl = document.getElementById('admin-ai-parse-status');
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.textContent = window.tr('ui.ai_fetching_results');
  }
  try {
    const res = await withRetry(function() {
      return window.callAPI('getHasilWawancara', [
        { candidateId: window.currentAiCandidateId || undefined, wa: wa || undefined },
      ]);
    }, 2, 2000);
    if (!res || res.success === false) {
      throw new Error((res && res.error) || 'Gagal ambil hasil wawancara');
    }
    if (!res.hasil) {
      window.tambahPesanAdminAi(window.tr('ui.ai_no_results'), 'ai');
      if (statusEl) statusEl.classList.add('hidden');
      return;
    }
    lastAdminHasil = {
      wa: res.wa || wa,
      hasil: res.hasil,
      nama: res.nama || (res.hasil.biodata && res.hasil.biodata.nama) || '',
    };
    const h = res.hasil;
    const bioKeys = h.biodata ? Object.keys(h.biodata) : [];
    window.tambahPesanAdminAi(
      '📊 **Hasil Wawancara — ' +
        window.esc(lastAdminHasil.nama || res.wa) +
        '**' +
        '\n🗓️ ' +
        window.esc(res.updatedAt || '-') +
        '\n⭐ Skor: ' +
        (h.score !== undefined ? window.esc(String(h.score)) + '/10' : '-') +
        (h.nilai ? ' (' + window.esc(String(h.nilai)) + ')' : '') +
        '\n💡 Rekomendasi: ' +
        window.esc(String(h.rekomendasi || '-')) +
        '\n🧬 Biodata terekam: ' +
        bioKeys.length +
        ' field' +
        (bioKeys.length ? '\n👉 Klik **Update Biodata** untuk menerapkan ke master.' : ''),
      'ai',
    );
    if (waInput && res.wa) waInput.value = res.wa;
    if (statusEl) statusEl.classList.add('hidden');
  } catch (err) {
    console.error('[AI] lihat hasil wawancara:', err);
    window.tambahPesanAdminAi(
      '⚠️ Gagal ambil hasil: ' + window.esc(err && err.message ? err.message : 'AI sibuk'),
      'ai',
    );
    if (statusEl) {
      statusEl.textContent = '❌ ' + (err && err.message ? err.message : 'Gagal');
      setTimeout(() => statusEl.classList.add('hidden'), 8000);
    }
  }
}

export async function updateBiodataDariHasilAdmin() {
  if (!isAdmin) {
    window.showToast(window.tr('ui.toast_admin_login_first'), 'error');
    return;
  }
  const bio =
    lastAdminHasil && lastAdminHasil.hasil && lastAdminHasil.hasil.biodata
      ? lastAdminHasil.hasil.biodata
      : null;
  if (!bio || Object.keys(bio).length === 0) {
    window.showToast(window.tr('ui.ai_no_biodata'), 'error');
    return;
  }
  const waInput = document.getElementById('admin-ai-wa');
  const wa = lastAdminHasil.wa || (waInput ? waInput.value.trim() : '');
  if (!wa) {
    window.showToast(window.tr('ui.ai_fill_wa_first'), 'error');
    return;
  }
  const statusEl = document.getElementById('admin-ai-parse-status');
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.textContent = window.tr('ui.ai_updating_biodata');
  }
  try {
    const res = await withRetry(function() {
      return window.callAPI('submitMasterForm', [Object.assign({ wa }, bio)]);
    }, 2, 2000);
    if (!res || res.success === false) {
      throw new Error((res && res.message) || 'Gagal simpan biodata');
    }
    window.tambahPesanAdminAi(
      '✅ **Biodata ' +
        window.esc(lastAdminHasil.nama || wa) +
        ' ter-update dari hasil wawancara** (' +
        Object.keys(bio).length +
        ' field).',
      'ai',
    );
    if (typeof window.showToast === 'function') {
      window.showToast(window.tr('ui.ai_biodata_updated'), 'success');
    }
    if (statusEl) statusEl.classList.add('hidden');
  } catch (err) {
    console.error('[AI] update biodata dari hasil:', err);
    window.tambahPesanAdminAi(
      '⚠️ Gagal update biodata: ' + window.esc(err && err.message ? err.message : 'AI sibuk'),
      'ai',
    );
    if (statusEl) {
      statusEl.textContent = '❌ ' + (err && err.message ? err.message : 'Gagal');
      setTimeout(() => statusEl.classList.add('hidden'), 8000);
    }
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (bar parse di parse.js: generateWawancaraModelAdmin /
// lihatHasilWawancaraAdmin / updateBiodataDariHasilAdmin).
registerSeamAliases({
  generateWawancaraModelAdmin,
  lihatHasilWawancaraAdmin,
  updateBiodataDariHasilAdmin,
});
