import { tr } from '../../i18n.ts';
import { showToast } from '../init/util.ts';
import { ALL_FORM, PREV_MAIL_COUNT } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// ==========================================
// GUARD AUTO-REFRESH & BADGE MAIL — deteksi modal terbuka / scroll,
// hitung mail pending & perbarui semua badge notifikasi
// ==========================================

// Deteksi apakah ada modal yang sedang terbuka. Modal = elemen dengan id
// berawalan "modal-" yang TIDAK punya class "hidden" (dan tampil di layar).
// Dipakai sebagai guard auto-refresh: kalau admin sedang membaca modal
// (preview CV, form, pemberkasan, dst) refresh ditunda supaya tidak
// menutup/mengganggu modal tersebut.
export function adaModalTerbuka() {
  var els = document.querySelectorAll('[id^="modal-"]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (!el) continue;
    if (el.classList.contains('hidden')) continue;
    // Modal pakai position:fixed sehingga offsetParent selalu null — cek
    // computed display langsung supaya deteksi akurat.
    var disp = window.getComputedStyle(el).display;
    if (disp !== 'none' && disp !== '') return true;
  }
  return false;
}

// Deteksi apakah admin sedang meng-scroll halaman/tabel (mis. Mail Inbox).
// Kalau iya, refresh TIDAK boleh render ulang tabel supaya posisi scroll
// tidak ter-reset — data tetap diperbarui di memori + badge notif tetap jalan.
export function sedangDiscrollTabel() {
  if (window.scrollY > 80) return true;
  var boxes = document.querySelectorAll('.overflow-x-auto, .overflow-y-auto, .custom-scrollbar');
  for (var i = 0; i < boxes.length; i++) {
    var el = boxes[i];
    if (el.scrollTop > 0 || el.scrollLeft > 0) return true;
  }
  return false;
}

// Hitung jumlah mail pending (MENUNGGU/MAIL/BARU) & perbarui SEMUA badge
// mail: badge sidebar, tombol tab Mail Inbox, notif tombol WA bot + sinkron
// window.PREV_MAIL_COUNT (dipakai deteksi mail baru saat auto-refresh). Dipakai
// oleh initApp (auto-refresh) DAN patch-in-place aksi admin (07_api.js)
// supaya angka selalu konsisten tanpa harus tarik ulang semua data.
export function updateMailBadge() {
  let pendingMails = ALL_FORM.filter(
    (f) =>
      f.status.toUpperCase() === 'MENUNGGU' ||
      f.status.toUpperCase() === 'MAIL' ||
      f.status.toUpperCase() === 'BARU',
  ).length;

  let notifBadge = document.getElementById('admin-notif-badge');
  if (notifBadge) {
    if (pendingMails > 0) {
      // @ts-expect-error JS→TS migration
      notifBadge.innerText = pendingMails;
      notifBadge.classList.remove('hidden');
    } else {
      notifBadge.classList.add('hidden');
    }
  }

  let tabMailBtn = document.getElementById('tab-mail');
  if (tabMailBtn) {
    let label =
      '<i class="fas fa-envelope md:mr-1"></i> <span class="hidden md:inline">Mail Inbox</span>';
    if (pendingMails > 0) {
      label +=
        ' <span class="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-black animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]">' +
        pendingMails +
        '</span>';
    }
    tabMailBtn.innerHTML = label;
  }

  let botMailBtn = document.getElementById('nav-bot-notif');
  if (botMailBtn) {
    if (pendingMails > 0) {
      botMailBtn.classList.remove('hidden');
    } else {
      botMailBtn.classList.add('hidden');
    }
  }

  // Toast mail baru hanya terpicu jika pending NAIK dibanding siklus
  // sebelumnya — aksi admin (review/lulus/gagal/hapus) selalu MENURUNKAN
  // pending, jadi aman dipanggil dari patch-in-place tanpa bunyi palsu.
  if (PREV_MAIL_COUNT !== null && pendingMails > PREV_MAIL_COUNT) {
    showToast(
      tr('ui.toast_new_mail').replace('{n}', pendingMails - PREV_MAIL_COUNT) +
        tr('ui.toast_mail_inbox_n'),
      'success',
    );
    try {
      new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();
    } catch (e) {}
  }
  window.PREV_MAIL_COUNT = pendingMails;
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file
// (engine/init.js via window.*, api/*.js patch-in-place).
registerSeamAliases({
  adaModalTerbuka,
  sedangDiscrollTabel,
  updateMailBadge,
});
