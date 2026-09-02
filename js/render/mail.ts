import { esc } from '../../api-client.ts';
import { tr } from '../../i18n.ts';
import { ALL_FORM, mailFilterStatus, mailSearchText } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// 7. FUNGSI RENDER — DOMAIN MAIL INBOX (tabel lamaran admin)
// ==========================================
// js/render/{public,admin,candidate,share,mail}.js (global scope TETAP).
// File ini: seleksi massal MAIL_SELECTED, status/bucket mail, filter UI &

// Seleksi baris Mail Inbox untuk hapus massal (key = rowIndex di window.ALL_FORM).
export var MAIL_SELECTED: Record<string, any> = {};

// Perbarui highlight tombol filter status Mail Inbox + hitungan per status.
// Status baru (konsisten dgn config list_status_lamaran): MENUNGGU,
// REVIEW ADMIN, LULUS, GAGAL — legacy APPROVED/REJECTED tetap dihitung
// ke LULUS/GAGAL biar data lama tidak hilang dari daftar.
var MAIL_STATUS_KEYS = ['MENUNGGU', 'UPDATE', 'REVIEW', 'LULUS', 'GAGAL', 'ALL'];
var MAIL_STATUS_LABEL = {
  MENUNGGU: 'MENUNGGU',
  UPDATE: 'UPDATE',
  REVIEW: 'REVIEW ADMIN',
  LULUS: 'LULUS',
  GAGAL: 'GAGAL',
  ALL: 'SEMUA',
};
var MAIL_STATE_OF = function (x) {
  var st = (x.status || 'MENUNGGU').toUpperCase();
  // Normalize legacy status 'UMUM' → 'UPDATE' supaya badge & filter konsisten.
  if (st === 'UMUM') return 'UPDATE';
  return st;
};
// Kelompokkan status (baru + legacy) ke bucket filter.
var MAIL_BUCKET = function (st) {
  if (st === 'MENUNGGU' || st === 'MAIL' || st === 'BARU' || st === 'PENDING') return 'MENUNGGU';
  if (st === 'UPDATE' || st === 'UPDATED' || st === 'DATA DIUBAH' || st === 'UMUM') return 'UPDATE';
  if (st === 'REVIEW ADMIN' || st === 'REVIEW') return 'REVIEW';
  if (st === 'LULUS' || st === 'LOLOS' || st === 'APPROVED' || st === 'APPROVE') return 'LULUS';
  if (st === 'GAGAL' || st === 'TOLAK' || st === 'REJECTED' || st === 'REJECT') return 'GAGAL';
  return st; // status lain → bucket = dirinya sendiri
};
export function renderMailFilterUI() {
  MAIL_STATUS_KEYS.forEach(function (s) {
    var b = document.getElementById('mail-f-' + s);
    if (b)
      b.className =
        mailFilterStatus === s
          ? 'px-3 py-2 text-[10px] font-bold bg-sky-600 text-white transition'
          : 'px-3 py-2 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition';
  });
  var el = document.getElementById('mail-status-counts');
  if (el) {
    // Hitungan konsisten dengan filter: MENUNGGU = MENUNGGU+MAIL+BARU+PENDING,
    // LULUS = LULUS+LOLOS+APPROVED+APPROVE, GAGAL = GAGAL+TOLAK+REJECTED+REJECT.
    var count = function (st) {
      if (st === 'ALL') return ALL_FORM.length;
      return ALL_FORM.filter(function (x) {
        return MAIL_BUCKET(MAIL_STATE_OF(x)) === st;
      }).length;
    };
    el.innerHTML =
      '<span class="text-sky-400">' +
      tr('ui.waiting_label') +
      count('MENUNGGU') +
      '</span> &nbsp;|&nbsp; ' +
      '<span class="text-violet-400">' +
      tr('ui.update_label') +
      count('UPDATE') +
      '</span> &nbsp;|&nbsp; ' +
      '<span class="text-amber-400">' +
      tr('ui.review_label') +
      count('REVIEW') +
      '</span> &nbsp;|&nbsp; ' +
      '<span class="text-emerald-400">' +
      tr('ui.lulus_label') +
      count('LULUS') +
      '</span> &nbsp;|&nbsp; ' +
      '<span class="text-red-400">' +
      tr('ui.gagal_label') +
      count('GAGAL') +
      '</span> &nbsp;|&nbsp; ' +
      '<span class="text-slate-300">' +
      tr('ui.total_label') +
      count('ALL') +
      '</span>';
  }
}

export function renderFormInbox() {
  var tb = document.getElementById('admin-mail-body');
  if (!tb) return;
  var html = '';

  // Escape teks bebas (alasan reject dari admin / nama dokumen tambahan)
  // supaya tidak bisa menyisipkan HTML/script saat dirender. WAJIB di sini
  // (di atas forEach docs): var esc LOKAL men-shadow window.esc — hoisting
  // membuat `esc` = undefined sampai baris ini dijalankan, jadi pemakaian
  // lebih awal (extraDocBtns) akan TypeError "f is not a function".
  var esc = function (s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  // Filter status (default MENUNGGU/MAIL/BARU utk daftar review; bisa
  // diubah lewat tombol APPROVED/REJECTED/ALL) + pencarian nama/WA/job.
  var arr = ALL_FORM.filter(function (f) {
    var st = MAIL_STATE_OF(f);
    var bucket = MAIL_BUCKET(st);
    var ok = false;
    if (mailFilterStatus === 'ALL') ok = true;
    // Tab MENUNGGU menampilkan lamaran baru + yang di-update kandidat
    // (UPDATE) — keduanya butuh perhatian admin.
    else if (mailFilterStatus === 'MENUNGGU') ok = bucket === 'MENUNGGU' || bucket === 'UPDATE';
    else if (mailFilterStatus === 'REVIEW') ok = bucket === 'REVIEW';
    else if (mailFilterStatus === 'LULUS') ok = bucket === 'LULUS';
    else if (mailFilterStatus === 'GAGAL') ok = bucket === 'GAGAL';
    else ok = st === mailFilterStatus;
    if (!ok) return false;
    if (mailSearchText) {
      var q = mailSearchText.toLowerCase();
      return (
        (f.nama || '').toLowerCase().includes(q) ||
        (f.wa || '').includes(q) ||
        (f.code || '').toLowerCase().includes(q)
      );
    }
    return true;
  });
  renderMailFilterUI();
  for (var i = 0; i < arr.length; i++) {
    var f = arr[i];

    var btnPhoto =
      f.photo && f.photo !== '-' && f.photo.toLowerCase().startsWith('http')
        ? '<button onclick="bukaFotoPreview(\'' +
          window.escJs(f.photo) +
          '\')" class="px-2 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded text-[9px] font-bold shadow transition">Foto</button>'
        : '';
    var btnJft =
      f.jft && f.jft !== '-' && f.jft.toLowerCase().startsWith('http')
        ? '<button onclick="bukaPdfPreview(\'' +
          window.escJs(f.jft) +
          '\')" class="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-bold shadow transition">JFT</button>'
        : '';
    var btnSsw =
      f.ssw && f.ssw !== '-' && f.ssw.toLowerCase().startsWith('http')
        ? '<button onclick="bukaPdfPreview(\'' +
          window.escJs(f.ssw) +
          '\')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[9px] font-bold shadow transition">SSW</button>'
        : '';
    var btnCv =
      f.cv && f.cv !== '-' && f.cv.toLowerCase().startsWith('http')
        ? '<button onclick="bukaPdfPreview(\'' +
          window.escJs(f.cv) +
          '\')" class="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[9px] font-bold shadow transition">CV</button>'
        : '';

    // Dokumen tambahan dari keterangan ("NAMA:URL;...") — tampilkan semua
    // yang di-upload kandidat beserta preview (gambar → foto, lainnya → pdf).
    // Dedup by URL supaya upload ganda tidak render tombol berulang.
    var extraDocBtns = '';
    var seenDocUrls: Record<string, boolean> = {};
    (Array.isArray(f.docs) ? f.docs : []).forEach(function (dc) {
      if (seenDocUrls[dc.url]) return;
      seenDocUrls[dc.url] = true;
      var isImg =
        /\.(jpe?g|png|webp|gif|bmp|svg)(\?|$)/i.test(dc.url) || /^data:image\//i.test(dc.url);
      // Guard defensif: kalau `esc` lokal undefined (mis. deklarasi var
      // dipindah ke bawah lagi oleh refactor → hoisting bikin undefined),
      // fallback ke window.esc supaya inbox tidak mati total.
      var escNama = (typeof esc === 'function' ? esc : window.esc)(dc.nama || 'DOKUMEN');
      var escUrl = window.escJs(dc.url || '');
      extraDocBtns +=
        '<button onclick="' +
        (isImg ? 'bukaFotoPreview' : 'bukaPdfPreview') +
        "('" +
        escUrl +
        '\')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[9px] font-bold shadow transition" title="' +
        escNama +
        '"><i class="' +
        (isImg ? 'fas fa-image' : 'fas fa-file-alt') +
        ' text-amber-400 mr-1"></i>' +
        escNama +
        '</button> ';
    });

    var st = MAIL_STATE_OF(f);
    var isProcessed = MAIL_BUCKET(st) === 'LULUS' || MAIL_BUCKET(st) === 'GAGAL';
    var badgeClass =
      MAIL_BUCKET(st) === 'LULUS'
        ? 'bg-emerald-900/50 border-emerald-500/40 text-emerald-300'
        : MAIL_BUCKET(st) === 'GAGAL'
          ? 'bg-red-900/50 border-red-500/40 text-red-300'
          : MAIL_BUCKET(st) === 'UPDATE'
            ? 'bg-violet-900/50 border-violet-500/40 text-violet-300'
            : MAIL_BUCKET(st) === 'REVIEW'
              ? 'bg-sky-900/40 border-sky-500/30 text-sky-400'
              : 'bg-amber-900/40 border-amber-500/30 text-amber-300';
    // Normalisasi teks badge: 'UMUM' → 'UPDATE' supaya admin tidak bingung
    var displayStatus = f.status === 'UMUM' ? 'UPDATE' : f.status;
    // Row yang sudah diproses: tampilkan keterangan feedback, tanpa tombol review.
    var actionCell = '';
    // FIX #6 (audit 2026-09-02): Kirim f.id (primary key) bukan f.rowIndex
    // (posisi array) — menghilangkan non-deterministic mutation saat timestamp
    // collate.
    var deleteBtn =
      '<button onclick="hapusFormMail(\'' +
      window.escJs(String(f.id)) +
      '\')" class="px-2 py-1.5 bg-slate-700 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold shadow transition" title="' +
      tr('ui.delete_mail') +
      '"><i class="fas fa-trash-alt"></i></button>';
    if (MAIL_BUCKET(st) === 'UPDATE') {
      // Baris UPDATE: tampilkan ringkasan apa yang berubah + tombol
      // "Tandai Dibaca" (kembali ke status LULUS/GAGAL/REVIEW aslinya).
      actionCell =
        '<div class="flex items-center gap-2 justify-center flex-wrap">' +
        '<div class="text-[10px] text-violet-300 max-w-[180px] truncate" title="' +
        esc(f.feedback) +
        '">' +
        esc(f.feedback) +
        '</div>' +
        '<button onclick="tandaiDibacaForm(\'' +
        window.escJs(String(f.id)) +
        '\')" class="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold shadow transition" title="' +
        tr('ui.mark_read_label') +
        '"><i class="fas fa-check-double mr-1"></i>' +
        tr('ui.mark_read_label') +
        '</button> ' +
        deleteBtn +
        '</div>';
    } else if (isProcessed) {
      actionCell =
        '<div class="flex items-center gap-2 justify-center"><div class="text-[10px] text-slate-400">' +
        esc(
          f.feedback ||
            f.keterangan ||
            (MAIL_BUCKET(st) === 'GAGAL' ? tr('ui.lamaran_ditolak') : tr('ui.lamaran_disetujui')),
        ) +
        '</div>' +
        deleteBtn +
        '</div>';
    } else {
      // Tombol Tandai Review hanya untuk yang masih MENUNGGU/BARU (belum
      // ditandai review). Yang sudah REVIEW ADMIN langsung Lulus/Gagal.
      var reviewBtn =
        MAIL_BUCKET(st) !== 'REVIEW'
          ? '<button onclick="prosesReviewForm(\'' +
            window.escJs(String(f.id)) +
            '\')" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-bold shadow transition" title="' +
            tr('ui.set_review') +
            '">' +
            tr('form.txt_review_admin') +
            '</button> '
          : '';
      actionCell =
        '<div class="flex gap-2 justify-center flex-wrap">' +
        reviewBtn +
        '<button onclick="prosesApproveForm(\'' +
        window.escJs(String(f.id)) +
        '\')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow transition" title="' +
        tr('ui.set_pass') +
        '">' +
        tr('form.txt_lulus') +
        '</button> ' +
        '<button onclick="prosesRejectForm(\'' +
        window.escJs(String(f.id)) +
        '\')" class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold shadow transition" title="' +
        tr('ui.set_fail') +
        '">' +
        tr('form.txt_gagal') +
        '</button> ' +
        deleteBtn +
        '</div>';
    }

    // Checkbox pilih (fitur hapus massal): simpan id baris di MAIL_SELECTED
    // supaya hapus massal tetap benar walau daftar ter-filter.
    // FIX #6: Pakai f.id bukan f.rowIndex.
    var ck = MAIL_SELECTED[String(f.id)] ? ' checked' : '';
    html +=
      '<tr class="rt-row border-b border-slate-800 hover:bg-white/5">' +
      '<td class="p-4 text-center"><input type="checkbox" class="mail-check w-4 h-4 accent-rose-500 cursor-pointer" data-idx="' +
      window.escJs(String(f.id)) +
      '" onclick="toggleMailSelect(this)" ' +
      ck +
      ' aria-label="Pilih"></td>' +
      '<td data-label="' +
      tr('table.timestamp') +
      '" class="p-4 text-[10px] text-slate-400 whitespace-nowrap">' +
      (f.timestamp ? String(f.timestamp).substring(0, 10) : '-') +
      '</td>' +
      '<td data-label="' +
      tr('table.job_code') +
      '" class="p-4 font-mono text-sky-300 font-bold text-xs">' +
      esc(f.code) +
      '</td>' +
      '<td data-label="' +
      tr('table.category') +
      '" class="p-4 text-[10px] font-bold text-amber-300 uppercase">' +
      esc(window.trOption(f.kategori || '-')) +
      '</td>' +
      '<td data-label="' +
      tr('table.applicant_name') +
      '" class="p-4 font-bold text-white text-xs whitespace-nowrap">' +
      esc(f.nama) +
      '</td>' +
      '<td data-label="' +
      tr('table.wa_num') +
      '" class="p-4 text-xs text-emerald-400">' +
      esc(f.wa) +
      '</td>' +
      '<td data-label="' +
      tr('table.status') +
      '" class="p-4 text-center"><span class="px-2 py-1 rounded text-[9px] font-bold ' +
      badgeClass +
      '">' +
      esc(window.trOption(displayStatus)) +
      '</span>' +
      (f.feedback
        ? '<div class="text-[9px] text-violet-300/70 mt-1 max-w-[150px] break-words" title="' +
          esc(f.feedback) +
          '">' +
          esc(f.feedback) +
          '</div>'
        : '') +
      '</td>' +
      '<td data-label="' +
      tr('table.doc_folder') +
      '" class="rt-full p-4 text-center">' +
      '<div class="flex flex-wrap gap-1 justify-center max-h-[80px] overflow-auto">' +
      (f.folderUrl && f.folderUrl !== '-'
        ? '<a href="' +
          esc(f.folderUrl) +
          '" target="_blank" aria-label="' +
          tr('table.doc_folder') +
          '" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[9px] font-bold shadow transition"><i class="fas fa-folder text-amber-400"></i></a>'
        : '') +
      btnPhoto +
      btnJft +
      btnSsw +
      btnCv +
      extraDocBtns +
      '</div>' +
      '</td>' +
      '<td data-label="' +
      tr('table.action_review') +
      '" class="rt-full p-4 text-center">' +
      actionCell +
      '</td>' +
      '</tr>';
  }
  if (arr.length === 0) {
    var emptyMsg =
      mailFilterStatus === 'ALL'
        ? tr('admin.report_empty_mail')
        : tr('admin.report_empty_mail_status') +
          ' ' +
          (MAIL_STATUS_LABEL[mailFilterStatus] || mailFilterStatus);
    html =
      '<tr><td colspan="9" class="p-4 text-center text-slate-500 font-bold">' +
      emptyMsg +
      '</td></tr>';
  }
  tb.innerHTML = html;
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (window.renderFormInbox, renderMailFilterUI).
// MAIL_SELECTED memakai ACCESSOR get/set (bukan alias biasa): api/forms.js
// (classic) melakukan REASSIGNMENT bare `MAIL_SELECTED = {}` — accessor
// mendelegasikan ke binding modul supaya tidak basi (pola state.js §3.2).
Object.defineProperty(window, 'MAIL_SELECTED', {
  configurable: true,
  get() {
    return MAIL_SELECTED;
  },
  set(v) {
    MAIL_SELECTED = v;
  },
});
registerSeamAliases({
  renderMailFilterUI,
  renderFormInbox,
});
