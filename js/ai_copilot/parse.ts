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
// PARSE DOKUMEN BIODATA (admin): upload CV/Excel/PDF → Gemini → update master
// Bar upload di-inject ke modal-admin-ai (partial tidak disentuh supaya
// tetap satu sumber). Alur: pilih file → parse otomatis → update biodata.
// ==========================================
export function pastikanBarParseAdminAi() {
  if (document.getElementById('admin-ai-parse-bar')) return;
  const chatBox = document.getElementById('admin-ai-chat');
  if (!chatBox || !chatBox.parentElement) return;
  // parentElement already checked above
  const div = document.createElement('div');
  div.id = 'admin-ai-parse-bar';
  div.className = 'px-4 py-2.5 bg-slate-900/70 border-t border-slate-800 z-10';
  div.innerHTML =
    '<div class="flex items-center gap-2">' +
    '<input type="file" id="admin-ai-file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" class="hidden" onchange="uploadDokumenBiodataAdmin(this)">' +
    '<label for="admin-ai-file" class="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-dashed border-amber-500/40 rounded-lg text-xs text-slate-200 cursor-pointer transition select-none overflow-hidden" title="Upload CV/Excel/PDF untuk parse biodata">' +
    '<i class="fas fa-file-upload text-amber-400 flex-shrink-0"></i>' +
    '<span id="admin-ai-file-name" class="truncate">Upload CV/Excel/PDF — auto parse &amp; update biodata</span>' +
    '</label>' +
    '<button type="button" onclick="uploadDokumenBiodataAdmin()" class="flex-shrink-0 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-md transition active:scale-95" aria-label="Parse &amp; Update Biodata">' +
    '<i class="fas fa-bolt mr-1"></i><span class="hidden md:inline">Parse &amp; Update</span>' +
    '</button>' +
    '</div>' +
    '<div class="flex items-center gap-2 mt-2">' +
    '<i class="fas fa-mobile-alt text-slate-500 text-xs flex-shrink-0"></i>' +
    '<input type="tel" id="admin-ai-wa" placeholder="WA kandidat (08… atau 628…)" class="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500">' +
    '<input type="text" id="admin-ai-bidang" placeholder="Bidang (mis. Kaigo)" class="w-24 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500" title="Bidang SSW — isi untuk kandidat yang belum terdaftar">' +
    '<button type="button" onclick="generateWawancaraModelAdmin()" class="flex-shrink-0 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow-md transition active:scale-95" title="Buat model wawancara sesuai bidang SSW kandidat (copy ke Google Sheet)">' +
    '<i class="fas fa-clipboard-list mr-1"></i><span class="hidden md:inline">Model Doc</span>' +
    '</button>' +
    '</div>' +
    '<div class="flex items-center gap-2 mt-2">' +
    '<button type="button" onclick="lihatHasilWawancaraAdmin()" class="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold rounded-lg transition active:scale-95" title="Lihat hasil wawancara AI kandidat (dari Simulator Wawancara)">' +
    '<i class="fas fa-file-alt mr-1 text-sky-400"></i>Hasil Wawancara' +
    '</button>' +
    '<button type="button" onclick="updateBiodataDariHasilAdmin()" class="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition active:scale-95" title="Terapkan biodata dari hasil wawancara ke master kandidat">' +
    '<i class="fas fa-database mr-1"></i>Update Biodata' +
    '</button>' +
    '</div>' +
    '<div id="admin-ai-parse-status" class="hidden mt-2 text-[11px] text-sky-300 bg-sky-900/30 border border-sky-700/50 rounded-lg px-3 py-2"></div>';
  chatBox.parentElement.insertBefore(div, chatBox.nextSibling);
}

export function bacaFileBase64Front(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = () => reject(new Error('Gagal membaca file'));
    r.readAsDataURL(file);
  });
}

export async function uploadDokumenBiodataAdmin(input) {
  if (!isAdmin) {
    window.showToast(window.tr('ui.toast_admin_login_first'), 'error');
    return;
  }
  let el = input && input.files && input.files[0] ? input : null;
  if (!el) {
    const fi = document.getElementById('admin-ai-file');
    if (fi && fi.files && fi.files[0]) el = fi;
  }
  if (!el) {
    window.showToast(window.tr('ui.ai_pick_file_first'), 'error');
    return;
  }
  const file = el.files[0];
  const statusEl = document.getElementById('admin-ai-parse-status');
  const nameEl = document.getElementById('admin-ai-file-name');
  if (nameEl) nameEl.textContent = file.name;
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.textContent = '\u23f3 Parsing ' + file.name + ' — AI membaca biodata\u2026';
  }
  try {
    const data = await bacaFileBase64Front(file);
    const waInput = document.getElementById('admin-ai-wa');
    const waTarget = waInput ? waInput.value.trim() : '';
    const res = await withRetry(function() {
      return window.callAPI('parseDokumenBiodata', [
        {
          candidateId: window.currentAiCandidateId || undefined,
          wa: waTarget || undefined,
          file: { name: file.name, mimeType: file.type || 'application/octet-stream', data },
        },
      ]);
    }, 2, 2000);
    if (!res || res.success === false) {
      throw new Error(
        (res && (res.error || res.message)) || window.tr('ui.ai_parse_failed') || 'Gagal parse dokumen',
      );
    }
    // Simpan ke biodata master (backend sudah izinkan admin panggil submitMasterForm).
    const simpan = await withRetry(function() {
      return window.callAPI('submitMasterForm', [
        Object.assign({ wa: res.wa }, res.data),
      ]);
    }, 2, 2000);
    if (!simpan || simpan.success === false) {
      throw new Error((simpan && simpan.message) || 'Gagal simpan biodata');
    }
    const rw = res.riwayat || {};
    window.tambahPesanAdminAi(
      '📄 **Parse berhasil:** ' +
        window.esc(res.fileName) +
        '\n👤 Kandidat: ' +
        window.esc(res.namaSekarang || res.wa) +
        '\n📊 ' +
        res.fieldCount +
        ' field biodata · 🎓 Pendidikan: ' +
        rw.pendidikan +
        ' · 💼 Pekerjaan: ' +
        rw.pekerjaan +
        ' · 👨‍👩‍👧‍👦 Keluarga: ' +
        rw.keluarga +
        '\n✅ **Biodata kandidat sudah di-update.**',
      'ai',
    );
    if (typeof showToast === 'function') {
      window.showToast(
        'Biodata ' + (res.namaSekarang || res.wa) + ' ter-update dari ' + res.fileName,
        'success',
      );
    }
    if (res.wa) {
      const waEl = document.getElementById('admin-ai-wa');
      if (waEl) waEl.value = res.wa;
    }
    el.value = '';
    if (nameEl) nameEl.textContent = 'Upload CV/Excel/PDF — auto parse & update biodata';
    if (statusEl) statusEl.classList.add('hidden');
  } catch (err) {
    console.error('[AI] parseDokumenBiodata error:', err);
    window.tambahPesanAdminAi(
      '⚠️ Gagal parse dokumen: ' + window.esc(err && err.message ? err.message : 'AI sibuk'),
      'ai',
    );
    if (statusEl) {
      statusEl.textContent = '❌ ' + (err && err.message ? err.message : 'Gagal');
      setTimeout(() => statusEl.classList.add('hidden'), 8000);
    }
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (pastikanBarParseAdminAi di-inject ke modal-admin-ai:
// uploadDokumenBiodataAdmin) + admin.js window.pastikanBarParseAdminAi.
registerSeamAliases({
  pastikanBarParseAdminAi,
  uploadDokumenBiodataAdmin,
});
