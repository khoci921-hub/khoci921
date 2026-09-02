import { callAPI } from '../../api-client.ts';
import { tr } from '../../i18n.ts';
import { showToast } from '../init/util.ts';
import { ALL_DB_JOBS, ALL_JOBS } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// 7. FUNGSI RENDER — DOMAIN SHARE LOKER (modal share + template WA)
// ==========================================
// js/render/{public,admin,candidate,share,mail}.js (global scope TETAP).
// File ini: modal share view loker (link, checkbox dokumen, template copas

// Chip dokumen share di modal Share Loker. SUMBER KEBENARAN frontend:
// backend normalizeDokumenShare (netlify/functions/jobs.ts) HARUS menerima
// semua chip ini — dijaga test scripts/__tests__/share-docs-sync.test.js.
// 'ALL' = "Semua file folder": menampilkan SELURUH berkas folder kandidat
// (SIM/KTP/ijazah dll) di share view, bukan hanya 3 berkas utama.
var SHARE_DOC_CHIPS = [
  'CV',
  'JFT',
  'SSW',
  'SIM A',
  'KTP',
  'KK',
  'AKTE',
  'IJAZAH',
  'IJAZAH SD',
  'IJAZAH SMP',
  'IJAZAH SMA',
  'UNIVERSITAS',
  'ALL',
];

export function shareLinkFor(jobCode) {
  // Strip semua halaman .html dari pathname — admin.html, index.html, dll.
  // Hasil: origin + '/' (atau origin + '/subdir/' kalau deploy di subfolder).
  var path = window.location.pathname.replace(/\/[^\/]*\.html$/, '/');
  var domain = window.location.origin + path;
  return domain + 'share.html?job=' + encodeURIComponent(jobCode);
}

// ===== MODAL SHARE LOKER (upgrade dari inline expand) =====
// Isi: (1) link share view utk TSK, (2) konfigurasi dokumen yang di-share,
// (3) template copas WA GAYA LAMA (era GAS) — URL menyesuaikan loker
// (link share view), bukan link Google Drive.

export function getJobByCode(jobCode) {
  var arr =
    typeof ALL_DB_JOBS !== 'undefined' && ALL_DB_JOBS.length
      ? ALL_DB_JOBS
      : typeof ALL_JOBS !== 'undefined'
        ? ALL_JOBS
        : [];
  for (var i = 0; i < arr.length; i++) if (arr[i].code === jobCode) return arr[i];
  return null;
}

// Buka modal share untuk 1 loker: isi semua seksi + tampilkan.
export function bukaModalShare(jobCode) {
  var modal = document.getElementById('modal-share-loker');
  if (!modal) return;
  window.__shareJobCode = jobCode;
  var db = getJobByCode(jobCode);
  var pekerjaan = db && db.pekerjaan ? db.pekerjaan : '';
  var sub = document.getElementById('share-modal-sub');
  if (sub) sub.textContent = (db && db.tsk ? db.tsk : '-') + ' | ' + jobCode + ' — ' + pekerjaan;

  var linkInput = document.getElementById('share-link-view');
  if (linkInput) linkInput.value = shareLinkFor(jobCode);
  // Tombol "Buka Share View" — buka tampilan TSK (share.html?job=KODE) di
  // tab baru supaya admin bisa cek dokumen yang tampil sebelum kirim template.
  var openBtn = document.getElementById('share-open-view');
  if (openBtn) openBtn.href = shareLinkFor(jobCode);

  renderShareCheckboxes(jobCode, db);

  updateSharePreview(jobCode);
  // Mulai bersih tiap buka: preview share view disembunyikan + iframe
  // dikosongkan supaya tidak memuat loker lama saat modal dibuka lagi.
  var prevBox = document.getElementById('share-preview-box');
  var prevFrame = document.getElementById('share-preview-frame');
  if (prevBox) prevBox.classList.add('hidden');
  if (prevFrame) prevFrame.src = '';
  modal.classList.remove('hidden');
}

// Tutup modal share (X / backdrop) + reset preview supaya tidak nyangkut.
export function tutupModalShare() {
  var modal = document.getElementById('modal-share-loker');
  if (!modal) return;
  modal.classList.add('hidden');
  var prevBox = document.getElementById('share-preview-box');
  var prevFrame = document.getElementById('share-preview-frame');
  if (prevBox) prevBox.classList.add('hidden');
  if (prevFrame) prevFrame.src = '';
}

// Toggle pratinjau share view DI DALAM modal (iframe same-origin) — admin
// bisa cek tampilan TSK loker ini tanpa menutup modal / pindah tab.
export function toggleSharePreview(jobCode) {
  var prevBox = document.getElementById('share-preview-box');
  if (!prevBox) return;
  var prevFrame = document.getElementById('share-preview-frame');
  var opening = prevBox.classList.contains('hidden');
  if (opening) {
    if (prevFrame) prevFrame.src = shareLinkFor(jobCode);
    prevBox.classList.remove('hidden');
  } else {
    prevBox.classList.add('hidden');
    if (prevFrame) prevFrame.src = '';
  }
}

// Label chip dokumen share (dwi-bahasa via tr()); token tanpa kunci
// (SIM A, KTP, dll) tampil apa adanya.
export function shareDocLabel(key) {
  var kunci = {
    CV: 'ui.share_doc_cv',
    JFT: 'ui.share_doc_jft',
    SSW: 'ui.share_doc_ssw',
    'IJAZAH SD': 'admin.doc_ijazah_sd',
    'IJAZAH SMP': 'admin.doc_ijazah_smp',
    'IJAZAH SMA': 'admin.doc_ijazah_sma',
    UNIVERSITAS: 'admin.doc_univ',
    ALL: 'ui.share_doc_all',
  }[key];
  return kunci ? tr(kunci) : key;
}

// Render checkbox dokumen yang di-share (di dalam modal).
export function renderShareCheckboxes(jobCode, db) {
  var wrap = document.getElementById('share-doc-checks');
  if (!wrap) return;
  var docsStr = String((db && db.dokumenShare) || 'CV,JFT,SSW').toUpperCase();
  // Split HANYA di koma/titik-koma (bukan spasi) — "SIM A" tetap satu item,
  // tidak pecah jadi chip "SIM" + "A".
  var docsArr = docsStr
    .split(/[,;]+/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  var allDocs = SHARE_DOC_CHIPS.slice();
  docsArr.forEach(function (d) {
    if (allDocs.indexOf(d) === -1) allDocs.push(d);
  });
  var chks = '';
  allDocs.forEach(function (key) {
    var isChecked = docsArr.indexOf(key) !== -1 ? 'checked' : '';
    var isAll = key === 'ALL';
    // Chip ALL dibedakan secara visual (aksen pink) supaya jelas ini
    // opsi "Semua file folder" — bukan dokumen biasa.
    var accent = isAll
      ? 'border-pink-500/60 hover:border-pink-400 text-pink-200'
      : 'border-slate-700 hover:border-emerald-500/50 text-slate-200';
    var checkAccent = isAll ? 'accent-pink-500' : 'accent-emerald-500';
    chks +=
      '<label class="inline-flex items-center gap-2 px-3 py-2 bg-slate-950/60 border rounded-lg cursor-pointer text-[11px] font-bold ' +
      accent +
      '">' +
      '<input type="checkbox" id="share-chk-' +
      key.replace(/[^A-Z0-9]/g, '_') +
      '-' +
      jobCode +
      '" data-val="' +
      key +
      '" class="' +
      checkAccent +
      ' w-4 h-4 share-chk-' +
      jobCode +
      '" ' +
      isChecked +
      ' /> ' +
      shareDocLabel(key) +
      '</label>';
  });
  wrap.innerHTML = chks;
}

// Template pesan copas WA (gaya lama, URL MENYESUAIKAN loker):
//  お疲れ様です
//
//   DOKUMEN
//  TG583ASJ - TANI CO NOMADEN HOKKAIDO KUMAMOTO
//
//   KAMI APLOD /UPDATE DI SINI:
//  <share view link loker ini>   <- share.html?job=KODE (bukan link Drive)
//
//  jika ada tambahan kami aplod di sini juga sensei
//  宜しくお願いします.
//
// URL di baris "KAMI APLOD /UPDATE DI SINI" = LINK SHARE VIEW sesuai loker
// (shareLinkFor) — TSK membuka tautan itu untuk melihat/mengunggah berkas
// kandidat loker tersebut. Bukan link Google Drive.
export function templateShareWa(jobCode, pekerjaan) {
  return (
    'お疲れ様です\n\n DOKUMEN\n ' +
    jobCode +
    ' - ' +
    String(pekerjaan || '').toUpperCase() +
    '\n\n KAMI APLOD /UPDATE DI SINI: \n' +
    shareLinkFor(jobCode) +
    '\n\njika ada tambahan kami aplod di sini juga sensei\n宜しくお願いします.'
  );
}

// Live preview template di textarea modal (URL share view otomatis per loker).
export function updateSharePreview(jobCode) {
  var pre = document.getElementById('share-template-preview');
  if (!pre) return;
  var db = getJobByCode(jobCode);
  pre.value = templateShareWa(jobCode, db ? db.pekerjaan : '');
}

// Copas template ke WA.
// Copas template ke WA.
export async function copasShareWa(jobCode) {
  var db = getJobByCode(jobCode);
  var textToCopy = templateShareWa(jobCode, db ? db.pekerjaan : '');
  try {
    await navigator.clipboard.writeText(textToCopy);
    showToast(tr('ui.toast_tsk_copied'), 'success');
  } catch (err) {
    showToast(tr('ui.toast_copy_text_failed'), 'error');
  }
}

// Copas link share view (share.html?job=...) dari modal.
export async function copyShareLink() {
  var linkInput = document.getElementById('share-link-view');
  if (!linkInput || !linkInput.value) return;
  try {
    await navigator.clipboard.writeText(linkInput.value);
    showToast(tr('ui.toast_tsk_copied'), 'success');
  } catch (err) {
    showToast(tr('ui.toast_copy_text_failed'), 'error');
  }
}

export function currentShareDocs(jobCode) {
  var vals = [];
  var els = document.querySelectorAll('.share-chk-' + jobCode);
  els.forEach(function (el) {
    if (el.checked) vals.push(el.getAttribute('data-val'));
  });
  return vals;
}

export async function simpanDokumenShare(jobCode) {
  var joined = currentShareDocs(jobCode).join(',');
  try {
    const res = await callAPI('updateDokumenShare', [jobCode, joined]);
    if (res.success) {
      showToast(tr('ui.toast_share_saved'), 'success');
      window.refreshDataDinamis('dbjob');
    } else {
      showToast(tr('alert.failed') + ' ' + (res.error || ''), 'error');
    }
  } catch (err) {
    showToast(tr('alert.network') + (err && err.message ? err.message : err), 'error');
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (tutupModalShare, copasShareWa, simpanDokumenShare,
// toggleSharePreview, copyShareLink, dll).
registerSeamAliases({
  bukaModalShare,
  tutupModalShare,
  toggleSharePreview,
  copasShareWa,
  copyShareLink,
  simpanDokumenShare,
});
