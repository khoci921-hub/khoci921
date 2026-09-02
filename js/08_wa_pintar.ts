import {
  ALL_CANDIDATES,
  ALL_RIWAYAT_KANDIDAT,
  ALL_WA_TEMPLATES,
  CURRENT_WA_KANDIDAT,
  currentAdminName,
} from './init/state.ts';
import { ensureAllCandidates } from './api/candidates.ts';
import { registerSeamAliases } from './core/bridge.ts';
// ESM (Fase 3 langkah 12): modul ES — alias window.* di bridge bawah utk
// HTML onclick (submitWaTemplate/batalEditWa/tutupPamflet), onclick string
// render/admin.js + render/candidate.js + render/mail.js (renderWaTemplates,
// bukaModalWaPintar, bukaFotoPreview, bukaPamflet), init/boot.js
// (injectModalWaPintar), engine/init.js (renderRiwayatKandidat) & onclick
// string internal file ini (editWaTemplate, prosesHapusWa, terapkanTemplateWa,
// kirimWaPintar, pilihLokerRiwayat, tutupFotoPreview).

// 10. FITUR BARU: WA PINTAR & TEMPLATE CRUD
// ==========================================
export function renderWaTemplates() {
  var list = document.getElementById('wa-template-list');
  if (!list) return;
  var html = '';
  ALL_WA_TEMPLATES.forEach((t) => {
    html +=
      '<div class="bg-black/40 border border-slate-700 p-4 rounded-xl flex flex-col justify-between hover:border-emerald-500/50 transition">' +
      '<div>' +
      '<h4 class="text-xs font-bold text-emerald-400 uppercase mb-2"><i class="fas fa-tag mr-1"></i> ' +
      window.esc(t.nama) +
      '</h4>' +
      '<p class="text-[10px] text-slate-400 line-clamp-3 mb-4 whitespace-pre-wrap">' +
      window.esc(t.isi) +
      '</p>' +
      '</div>' +
      '<div class="flex gap-2 border-t border-slate-700 pt-3">' +
      '<button onclick="kirimTemplateKelas(\'' +
      t.id +
      '\')" class="flex-1 py-1.5 bg-emerald-900/50 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded text-[10px] font-bold transition"><i class="fas fa-paper-plane"></i> ' +
      window.tr('ui.template_send') +
      '</button>' +
      '<button onclick="editWaTemplate(\'' +
      t.id +
      '\')" class="flex-1 py-1.5 bg-sky-900/50 hover:bg-sky-600 text-sky-400 hover:text-white rounded text-[10px] font-bold transition"><i class="fas fa-edit"></i> ' +
      window.tr('ui.template_edit') +
      '</button>' +
      '<button onclick="prosesHapusWa(\'' +
      t.id +
      '\')" class="flex-1 py-1.5 bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white rounded text-[10px] font-bold transition"><i class="fas fa-trash"></i> ' +
      window.tr('ui.template_delete') +
      '</button>' +
      '</div>' +
      '</div>';
  });
  if (ALL_WA_TEMPLATES.length === 0)
    html =
      '<div class="col-span-2 text-center text-slate-500 py-6 text-xs font-bold border border-dashed border-slate-700 rounded-xl bg-black/20">' +
      window.tr('ui.template_empty') +
      '</div>';
  list.innerHTML = html;
}

export async function submitWaTemplate(e) {
  e.preventDefault();
  var btn = document.getElementById('btn-submit-wa');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> ' + window.tr('ui.saving') + '';
  btn.disabled = true;
  document.getElementById('global-loader').style.display = 'flex';

  var id = document.getElementById('wa-id').value;
  var nama = document.getElementById('wa-nama').value;
  var isi = document.getElementById('wa-isi').value;

  try {
    const res = await window.callAPI('simpanWaTemplate', [id, nama, isi, currentAdminName]);
    if (res.success) {
      window.showToast(window.tr('ui.toast_wa_template_saved'), 'success');
      batalEditWa();
      window.refreshDataDinamis('wa');
    } else {
      window.showToast(window.tr('ui.toast_error_prefix') + res.error, 'error');
    }
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  } finally {
    btn.innerHTML = '<i class="fas fa-save mr-1"></i> ' + window.tr('ui.save_template') + '';
    btn.disabled = false;
    document.getElementById('global-loader').style.display = 'none';
  }
}

export function editWaTemplate(id) {
  var t = ALL_WA_TEMPLATES.find((x) => x.id === id);
  if (!t) return;
  document.getElementById('wa-id').value = t.id;
  document.getElementById('wa-nama').value = t.nama;
  document.getElementById('wa-isi').value = t.isi;
  document.getElementById('wa-form-title').innerText = window.tr('ui.template_edit_title');
  document.getElementById('wa-nama').focus();
}

export function batalEditWa() {
  var form = document.getElementById('form-wa-template');
  if (form) form.reset();
  document.getElementById('wa-id').value = '';
  document.getElementById('wa-form-title').innerText = 'Buat Template Baru';
}

// Kirim template WA dengan MODEL yang SAMA seperti fitur Undang Grup Kelas
// (paste daftar Nama|WA + link grup + jeda + varian pesan) — seragam, sesuai
// permintaan pemilik 2026-08-18. Reuse modal-undangan-kelas + kirimUndanganKelas
// (kirimTawaranMassal + customMessage); template tinggal di-prefill ke textarea.
export function kirimTemplateKelas(id) {
  var t = ALL_WA_TEMPLATES.find((x) => x.id === id);
  if (!t) return;
  var pesan = document.getElementById('input-pesan-kelas');
  if (pesan) pesan.value = String(t.isi || '');
  // Prefill link grup dari kiriman terakhir (kalau masih kosong).
  var link = document.getElementById('input-link-grup-kelas');
  if (link && !link.value) {
    try {
      link.value = localStorage.getItem('asj_link_grup_kelas') || '';
    } catch (e) {
      /* private mode */
    }
  }
  if (typeof window.previewUndanganKelas === 'function') window.previewUndanganKelas();
  var modal = document.getElementById('modal-undangan-kelas');
  if (modal) modal.classList.remove('hidden');
}

export async function prosesHapusWa(id) {
  if (!window.confirm('Yakin ingin menghapus template ini?')) return;
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = 'flex';
  try {
    const res = await window.callAPI('hapusWaTemplate', [id, currentAdminName]);
    if (res.success) window.refreshDataDinamis('wa');
    else {
      window.showToast(window.tr('ui.toast_error_prefix') + res.error, 'error');
    }
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

export function injectModalWaPintar() {
  if (document.getElementById('modal-wa-pintar')) return;
  var html =
    '<div id="modal-wa-pintar" class="hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">' +
    '<div class="glass-panel p-6 md:p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative border-emerald-500/50">' +
    '<button onclick="document.getElementById(\'modal-wa-pintar\').classList.add(\'hidden\')" aria-label="Tutup" class="absolute top-5 right-6 text-slate-400 hover:text-white transition"><i class="fas fa-times text-2xl"></i></button>' +
    '<h3 class="text-xl font-bold text-emerald-400 mb-4 border-b border-emerald-900/50 pb-3"><i class="fab fa-whatsapp mr-2"></i> WA Pintar</h3>' +
    '<div class="space-y-4">' +
    '<input type="hidden" id="wa-pintar-phone">' +
    '<div>' +
    '<label class="block text-[10px] font-bold text-slate-400 mb-1">KANDIDAT TUJUAN</label>' +
    '<input type="text" id="wa-pintar-nama" readonly class="w-full p-2.5 rounded-lg bg-black/40 border border-slate-700 text-emerald-300 text-sm font-bold outline-none cursor-not-allowed">' +
    '</div>' +
    '<div>' +
    '<label class="block text-[10px] font-bold text-slate-400 mb-1">PILIH TEMPLATE PESAN</label>' +
    '<select id="wa-pintar-template" onchange="terapkanTemplateWa()" class="w-full p-2.5 rounded-lg bg-black/60 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500 transition">' +
    '<option value="">' +
    window.tr('ui.manual_or_template') +
    '</option>' +
    '</select>' +
    '</div>' +
    '<div>' +
    '<label class="block text-[10px] font-bold text-slate-400 mb-1">ISI PESAN (Bisa Diedit / Custom)</label>' +
    '<textarea id="wa-pintar-pesan" rows="6" class="w-full p-2.5 rounded-lg bg-black/60 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500 transition leading-relaxed custom-scrollbar"></textarea>' +
    '</div>' +
    '<button onclick="kirimWaPintar()" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg transition text-base mt-2"><i class="fab fa-whatsapp mr-2"></i> ' +
    window.tr('ui.wa_open_send') +
    '</button>' +
    '</div>' +
    '</div>' +
    '</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

export async function bukaModalWaPintar(idKan) {
  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  var c = ALL_CANDIDATES.find((x) => x.idKandidat === idKan);
  if (!c) return window.showToast(window.tr('ui.toast_cand_not_found'), 'error');

  // Tulis via accessor bridge (state.js) — CURRENT_WA_KANDIDAT binding modul
  // state di-update, bukan sekadar window property.
  window.CURRENT_WA_KANDIDAT = c;

  document.getElementById('wa-pintar-nama').value = c.nama + ' (' + (c.idLoker || 'Umum') + ')';
  document.getElementById('wa-pintar-phone').value = window.normalizePhone(c.wa);
  document.getElementById('wa-pintar-pesan').value = '';

  var sel = document.getElementById('wa-pintar-template');
  // DOM OPT: kumpulkan semua <option> ke satu string, injeksikan sekali
  // (dulu innerHTML += per template = tulis DOM berulang dalam loop).
  var optHtml = '<option value="">' + window.tr('ui.manual_or_template') + '</option>';
  ALL_WA_TEMPLATES.forEach((t) => {
    optHtml += '<option value="' + t.id + '">' + t.nama + '</option>';
  });
  sel.innerHTML = optHtml;

  document.getElementById('modal-wa-pintar').classList.remove('hidden');
}

export function terapkanTemplateWa() {
  var val = document.getElementById('wa-pintar-template').value;
  var ta = document.getElementById('wa-pintar-pesan');
  if (!val) {
    ta.value = '';
    return;
  }

  var t = ALL_WA_TEMPLATES.find((x) => x.id === val);
  if (!t || !CURRENT_WA_KANDIDAT) return;

  var msg = t.isi;
  msg = msg.replace(/<<NAMA>>/gi, CURRENT_WA_KANDIDAT.nama);
  msg = msg.replace(/<<JOB>>/gi, CURRENT_WA_KANDIDAT.idLoker || 'Umum');

  ta.value = msg;
}

export function kirimWaPintar() {
  var phone = document.getElementById('wa-pintar-phone').value;
  var msg = document.getElementById('wa-pintar-pesan').value;

  if (!phone) return window.showToast(window.tr('ui.toast_wa_invalid_cand2'), 'error');
  if (!msg) return window.showToast(window.tr('ui.toast_msg_empty'), 'error');

  var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg.trim());
  window.open(url, '_blank');
  document.getElementById('modal-wa-pintar').classList.add('hidden');
}

// Filter loker aktif di card progres "Status Lamaran Terkini". Default: loker
// dengan status LULUS/AKTIF, kalau tidak ada ambil yang pertama (terbaru).
let _riwayatLokerAktif = null;

export function pilihLokerRiwayat(code) {
  _riwayatLokerAktif = code || null;
  renderRiwayatKandidat();
}

export function renderRiwayatKandidat() {
  var container = document.getElementById('k-dash-riwayat');
  if (!container) return;
  var html = '';
  var badge = document.getElementById('badge-notif-kandidat');

  if (!ALL_RIWAYAT_KANDIDAT || ALL_RIWAYAT_KANDIDAT.length === 0) {
    html =
      '<div class="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-700/50 rounded-xl">Anda belum pernah melamar job apapun.</div>';
    if (badge) badge.classList.add('hidden');
  } else {
    // Update Angka Lonceng Notifikasi
    if (badge) {
      badge.classList.remove('hidden');
      // @ts-expect-error JS→TS migration
      badge.innerText = ALL_RIWAYAT_KANDIDAT.length;
      badge.classList.add('animate-bounce'); // Efek mental saat load
      setTimeout(() => badge.classList.remove('animate-bounce'), 2000);
    }

    // Urutkan dari yang terbaru
    let sorted = ALL_RIWAYAT_KANDIDAT.slice().sort(
      // @ts-expect-error JS→TS migration
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    );

    // PILL PILIHAN LOKER — 1 klik = progres tahapan loker itu saja (tidak
    // menumpuk semua lamaran jadi satu). Data per lamaran: code_job -> status.
    var lokerList = [];
    var seen = new Set();
    sorted.forEach((r) => {
      var code = String(r.jobCode || r.kode || r.code || '').trim();
      if (!code || seen.has(code)) return;
      seen.add(code);
      lokerList.push({
        code,
        st: String(r.status || '').toUpperCase(),
      });
    });
    if (lokerList.length > 0 && !lokerList.some((l) => l.code === _riwayatLokerAktif)) {
      // Default: loker LULUS/AKTIF lebih dulu, sisanya terbaru.
      var prev = lokerList.find((l) => l.st === 'LULUS' || l.st === 'AKTIF' || l.st === 'LOLOS');
      _riwayatLokerAktif = (prev ? prev : lokerList[0]).code;
    }
    if (lokerList.length > 1) {
      html +=
        '<div class="flex flex-wrap gap-1.5 mb-3"><span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider self-center">' +
        window.tr('ui.pilih_loker') +
        '</span>';
      lokerList.forEach((l) => {
        var aktif = l.code === _riwayatLokerAktif;
        var cls = aktif
          ? 'bg-emerald-600 text-white border-emerald-400'
          : 'bg-slate-800 text-slate-300 border-slate-600 hover:border-emerald-500/60 hover:text-white';
        html +=
          '<button onclick="pilihLokerRiwayat(\'' +
          window.escJs(l.code) +
          '\')" class="px-2.5 py-1 rounded-full border text-[10px] font-black transition ' +
          cls +
          '">' +
          window.esc(l.code) +
          (l.st === 'LULUS' || l.st === 'AKTIF' || l.st === 'LOLOS'
            ? ' <i class="fas fa-check-circle"></i>'
            : '') +
          '</button>';
      });
      html += '</div>';
    }

    var listShown = _riwayatLokerAktif
      ? sorted.filter(
          (r) => String(r.jobCode || r.kode || r.code || '').trim() === _riwayatLokerAktif,
        )
      : sorted;
    listShown.forEach((r) => {
      let st = String(r.status || '').toUpperCase();
      let badgeClass = '';
      let icon = '';
      let statusText = '';

      if (st === 'MENUNGGU' || st === 'BARU' || st === 'MAIL' || st === 'PENDING') {
        badgeClass = 'bg-amber-900/40 text-amber-400 border-amber-500/30';
        icon = 'fa-clock';
        statusText = window.tr('form.txt_menunggu_review');
      } else if (st === 'REVIEW ADMIN' || st === 'DIBACA' || st === 'PROSES') {
        badgeClass = 'bg-sky-900/40 text-sky-400 border-sky-500/30';
        icon = 'fa-user-check';
        statusText = window.tr('form.txt_review_admin');
      } else if (st === 'LULUS' || st === 'APPROVE' || st === 'APPROVED' || st === 'LOLOS') {
        badgeClass = 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30';
        icon = 'fa-check-circle';
        statusText = window.tr('form.txt_lamaran_lulus');
      } else if (st === 'GAGAL' || st === 'REJECT' || st === 'REJECTED' || st === 'TOLAK') {
        badgeClass = 'bg-red-900/40 text-red-400 border-red-500/30';
        icon = 'fa-times-circle';
        statusText = window.tr('form.txt_lamaran_gagal');
      } else {
        badgeClass = 'bg-slate-800 text-slate-300 border-slate-600';
        icon = 'fa-info-circle';
        statusText = window.trOption(r.status || window.tr('form.txt_diproses'));
      }

      let dateStr = r.timestamp && r.timestamp !== '-' ? String(r.timestamp).substring(0, 10) : '';

      // Step progres DINAMIS dari system config (CHECK KAIWA → FLIGHT).
      // Gunakan tahapan_seleksi dari database_candidate (bukan status mail
      // yang bisa误导 — misal LULUS di mail bukan LOLOS USER di tahapan).
      let tahapan = String(r.tahapan || '').toUpperCase();
      let stepIdx = window.tahapanStepIndex(tahapan || st);
      let stepNames = window.tahapanPipeline();
      let isGagal = stepIdx < 0 && /TOLAK|REJECT|GAGAL/.test(st);
      if (stepIdx < 0) stepIdx = 0; // MENUNGGU/REVIEW ADMIN → posisi awal
      let progressData = window.getTahapanProgress(st);
      // FIX 2026-08-12: baris step pakai flex-wrap + whitespace-nowrap per
      // step — nama step panjang (CHECK KAIWA/MENDAN dll.) sebelumnya
      // MELUBER keluar kartu (scrollWidth 501 vs 281); kini wrap rapi.
      let progressHtml =
        `
                    <div class="mt-3">
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"><i class="fas fa-route mr-1 text-sky-400"></i> ${window.tr('form.txt_tahapan_saat_ini')}</span>
                            <span class="inline-flex items-center gap-1 text-[10px] font-black ${isGagal ? 'text-red-400' : 'text-emerald-400'}"><i class="fas ${isGagal ? 'fa-ban' : 'fa-map-pin'}"></i> ${isGagal ? window.tr('form.txt_proses_dihentikan') : window.esc(window.trOption(stepNames[stepIdx]))}</span>
                        </div>
                        <div class="w-full bg-slate-800 rounded-full h-1.5 border border-slate-700/50">
                            <div class="bg-gradient-to-r ${progressData.color} h-1.5 rounded-full transition-all duration-1000 relative" style="width: ${isGagal ? 100 : progressData.percent}%">
                                <div class="absolute -right-1 -top-1 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] border border-slate-300"></div>
                            </div>
                        </div>
                        <div class="flex flex-wrap justify-between gap-x-2 gap-y-1 mt-1.5">` +
        stepNames
          .map(function (nm, i) {
            let active = i === stepIdx && !isGagal;
            let done = i < stepIdx && !isGagal;
            let cls = done
              ? 'text-emerald-400'
              : active
                ? 'text-amber-400'
                : isGagal
                  ? 'text-red-500'
                  : 'text-slate-500';
            let dot = done ? 'fa-check-circle' : active ? 'fa-circle' : 'fa-circle';
            return (
              '<span class="flex items-center gap-1 text-[9px] font-bold whitespace-nowrap ' +
              cls +
              '"><i class="fas ' +
              dot +
              ' flex-shrink-0"></i> ' +
              window.esc(window.trOption(nm)) +
              '</span>'
            );
          })
          .join('') +
        `</div>
                    </div>`;

      // FIX 2026-08-12: badge status & kolom kiri diberi min-w-0 +
      // badge tidak lagi whitespace-nowrap — status panjang (mis.
      // "REVIEW ADMIN" / terjemahan JP) sebelumnya MELUBER keluar kartu.
      html +=
        '<div class="flex flex-col p-4 rounded-2xl border border-slate-700/50 bg-black/60 hover:bg-black/80 transition-all shadow-lg hover:shadow-cyan-900/20 mb-3 overflow-hidden">' +
        '<div class="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-1">' +
        '<div class="min-w-0">' +
        '<div class="text-sm font-black text-white tracking-wide break-words"><i class="fas fa-building text-slate-500 mr-2"></i>' +
        window.esc(r.jobCode || r.kode || '-') +
        ' <span class="text-[9px] px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded ml-2 font-normal whitespace-nowrap">' +
        dateStr +
        '</span></div>' +
        '<div class="text-[11px] text-slate-400 mt-1 break-words"><i class="fas fa-tag mr-1 text-sky-500/70"></i> ' +
        window.esc(window.trOption(r.kategori || r.jobCode || r.kode || r.code || '-')) +
        '</div>' +
        '</div>' +
        '<div class="text-left sm:text-right min-w-0 max-w-full">' +
        '<span class="inline-flex items-start gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] md:text-xs font-bold max-w-full break-words text-left shadow-sm ' +
        badgeClass +
        '">' +
        '<i class="fas ' +
        icon +
        ' mt-0.5 flex-shrink-0"></i> ' +
        window.esc(statusText) +
        '</span>' +
        '</div>' +
        '</div>' +
        ((st === 'REJECT' || st === 'TOLAK') && r.keterangan
          ? '<div class="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg"><div class="text-xs font-bold text-red-400 mb-1"><i class="fas fa-exclamation-triangle mr-1"></i> Alasan Penolakan:</div><p class="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">' +
            window.esc(r.keterangan) +
            '</p></div>'
          : '') +
        progressHtml +
        '</div>';
    });
  }
  container.innerHTML = html;
}

// ==========================================
// FITUR LIGHTBOX (POP-UP) KHUSUS FOTO
// ==========================================
export function bukaFotoPreview(url) {
  var modal = document.getElementById('foto-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'foto-preview-modal';
    modal.className =
      'fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center hidden opacity-0 transition-opacity duration-300';
    modal.innerHTML =
      '<div class="relative w-full max-w-lg mx-4 flex flex-col items-center">' +
      '<button onclick="tutupFotoPreview()" aria-label="' +
      window.tr('public.close') +
      '" class="absolute -top-12 right-0 text-white hover:text-red-500 text-4xl font-black drop-shadow-md transition transform hover:scale-110">&times;</button>' +
      '<div class="p-2 bg-slate-900 rounded-xl shadow-2xl border border-slate-600/50">' +
      '<img id="foto-preview-img" src="" class="max-w-full max-h-[85vh] object-contain rounded-lg min-w-[200px] min-h-[200px]">' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  // Foto disimpan di Supabase Storage — langsung tampilkan URL-nya.
  var imgUrl = url;
  document.getElementById('foto-preview-img').src = imgUrl;
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
  }, 10);
}

export function tutupFotoPreview() {
  var modal = document.getElementById('foto-preview-modal');
  if (modal) {
    modal.classList.add('opacity-0');
    setTimeout(() => {
      modal.classList.add('hidden');
      document.getElementById('foto-preview-img').src = '';
    }, 300);
  }
}

export function bukaPamflet(urlGambar) {
  if (!urlGambar || urlGambar === '-') return;
  var modal = document.getElementById('pamfletModal');
  var img = document.getElementById('gambarPamfletFull');
  if (modal && img) {
    img.src = urlGambar;
    modal.classList.remove('hidden');
  }
}

export function tutupPamflet() {
  var modal = document.getElementById('pamfletModal');
  if (modal) modal.classList.add('hidden');
  setTimeout(() => {
    document.getElementById('gambarPamfletFull').src = '';
  }, 300);
}

// BRIDGE ESM → classic (bundel): alias window.* utk HTML onclick, onclick
// string lintas file & onclick string internal (string dieval global).
// `_riwayatLokerAktif` sengaja PRIVAT modul (tak ada pemakai luar).
registerSeamAliases({
  submitWaTemplate,
  editWaTemplate,
  batalEditWa,
  prosesHapusWa,
  kirimTemplateKelas,
  injectModalWaPintar,
  bukaModalWaPintar,
  terapkanTemplateWa,
  kirimWaPintar,
  pilihLokerRiwayat,
  bukaFotoPreview,
  tutupFotoPreview,
  bukaPamflet,
  tutupPamflet,
});

// ==========================================
