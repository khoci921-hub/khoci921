import { AUTO_REFRESH_TIMER } from './state.ts';
import { renderPublicFilterUI, renderPublicFiltered } from '../render/public.ts';
import { registerSeamAliases } from '../core/bridge.ts';
import { resetPosthog } from '../core/posthog.ts';
// ==========================================
// NAVIGASI & SESI — pindah halaman (public/admin/kandidat), menu mobile,
// dan logout (cabut sesi server + bersihkan state)
// ==========================================

export function changePage(page) {
  var pPub = document.getElementById('page-public');
  if (pPub) pPub.classList.toggle('hidden', page !== 'public');
  var pAdm = document.getElementById('page-admin');
  if (pAdm) pAdm.classList.toggle('hidden', page !== 'admin');
  var pKan = document.getElementById('page-kandidat');
  if (pKan) pKan.classList.toggle('hidden', page !== 'kandidat');

  // Re-render tabel publik setiap kali halaman publik dibuka
  // agar tabel tidak kosong saat admin/kandidat berpindah halaman.
  if (page === 'public') {
    if (typeof renderPublicFilterUI === 'function') renderPublicFilterUI();
    if (typeof renderPublicFiltered === 'function') renderPublicFiltered();
  }

  // Close mobile nav when changing page
  closeMobileMenu();

  // Logika memunculkan Bottom Nav di HP
  // (ID bottom-nav-* = bar bawah; mobile-nav-* di menu hamburger dipakai
  // login/logout flow, jangan di-toggle di sini — dulu ID duplikat bikin
  // changePage men-toggle seksi menu hamburger sehingga menu jadi kosong
  // saat admin/kandidat melihat halaman publik.)
  var navAdm = document.getElementById('bottom-nav-admin');
  var navKan = document.getElementById('bottom-nav-kandidat');

  if (navAdm) navAdm.classList.toggle('hidden', page !== 'admin');
  if (navKan) navKan.classList.toggle('hidden', page !== 'kandidat');

  // Tambahkan padding bawah ke body agar konten tidak tertutup menu bawah
  if (page === 'admin' || page === 'kandidat') {
    document.body.style.paddingBottom = '70px';
  } else {
    document.body.style.paddingBottom = '0px';
  }
}

export function closeMobileMenu() {
  var menu = document.getElementById('mobile-nav-menu');
  var overlay = document.getElementById('mobile-nav-overlay');
  if (!menu) return;
  if (!menu.classList.contains('translate-x-full')) {
    menu.classList.remove('translate-x-0');
    menu.classList.add('translate-x-full');
  }
  menu.classList.add('hidden');
  if (overlay) overlay.classList.add('hidden');
}

export function toggleMobileMenu() {
  var menu = document.getElementById('mobile-nav-menu');
  var overlay = document.getElementById('mobile-nav-overlay');
  if (!menu) return;
  if (menu.classList.contains('translate-x-full')) {
    menu.classList.remove('hidden');
    overlay.classList.remove('hidden');
    requestAnimationFrame(function () {
      menu.classList.remove('translate-x-full');
      menu.classList.add('translate-x-0');
    });
  } else {
    menu.classList.remove('translate-x-0');
    menu.classList.add('translate-x-full');
    setTimeout(function () {
      menu.classList.add('hidden');
    }, 300);
    overlay.classList.add('hidden');
  }
}

export function logoutApp() {
  // Bersihkan auto-refresh timer (hindari interval jalan tanpa sesi)
  if (window.AUTO_REFRESH_TIMER) {
    // @ts-expect-error JS→TS migration
    clearInterval(window.AUTO_REFRESH_TIMER);
    window.AUTO_REFRESH_TIMER = null;
  }
  // Cabut session di SERVER (hapus row user_sessions) - best-effort, tidak
  // menunda logout: callAPI membaca localStorage secara sinkron saat
  // membangun body, jadi token sudah terambil sebelum clear di bawah.
  window.callAPI('logout', []).catch(function () {});
  // Hapus HANYA key sesi/auth — BUKAN localStorage.clear() (dulu wipe semua
  // termasuk preferensi theme per user & draft CV). Kalau admin tidak logout
  // tapi key sesi utama hilang sebagian, refresh token (asj_admin_refresh)
  // di boot tetap bisa memulihkan sesi diam-diam.
  [
    'asj_admin_login',
    'asj_admin_name',
    'asj_admin_session',
    'asj_admin_refresh',
    'asj_kandidat_login',
    'asj_kandidat_name',
    'asj_kandidat_wa',
    'asj_kandidat_session',
    'asj_kandidat_refresh',
    'asj_session_token',
  ].forEach(function (k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      /* abaikan */
    }
  });
  var nAdm = document.getElementById('nav-admin-mode');
  if (nAdm) nAdm.classList.add('hidden');
  var nKan = document.getElementById('nav-kandidat-mode');
  if (nKan) nKan.classList.add('hidden');
  var nMod = document.getElementById('nav-mode');
  if (nMod) nMod.classList.remove('hidden');
  // Sync menu hamburger: kembalikan ke seksi logged-out (Login/Daftar/Admin Login).
  // Dulu di sini seksi mobile-nav tidak di-reset, jadi setelah logout menu
  // hamburger masih menampilkan seksi admin/kandidat (Dashboard/Keluar) padahal
  // sudah tidak login.
  var mLg = document.getElementById('mobile-nav-logged-out');
  if (mLg) mLg.classList.remove('hidden');
  var mAd = document.getElementById('mobile-nav-admin');
  if (mAd) mAd.classList.add('hidden');
  var mKa = document.getElementById('mobile-nav-kandidat');
  if (mKa) mKa.classList.add('hidden');
  // @ts-expect-error JS→TS migration
  window.isAdmin = false;
  window.isKandidat = false;
  window.currentAdminName = '';
  window.currentKandidatName = '';
  window.currentKandidatWa = '';
  window.currentKandidatId = '';
  resetPosthog();

  if (AUTO_REFRESH_TIMER) {
    clearInterval(AUTO_REFRESH_TIMER);
    window.AUTO_REFRESH_TIMER = null;
    window.PREV_MAIL_COUNT = null;
  }

  // Close mobile nav
  closeMobileMenu();

  changePage('public');
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (index/admin changePage/toggleMobileMenu/logoutApp,
// 04_auth.js & engine/init.js window.changePage).
registerSeamAliases({
  changePage,
  toggleMobileMenu,
  logoutApp,
});
