// ==========================================
// BOOT — urutan inisialisasi saat DOM siap + listener global
// ==========================================

import { callAPI } from '../../api-client.ts';
import { getSavedTheme } from './theme.ts';
import { initPosthog } from '../core/posthog.ts';

document.addEventListener('DOMContentLoaded', async function () {
  // PostHog: init session replay + analytics (~30KB CDN, async non-blocking)
  initPosthog();

  window.injectModalWaPintar();

  // PEMULIHAN SESI ADMIN DIAM-DIAM (fitur "selama tidak logout, selalu
  // login walau buka besok"): kalau flag login hilang (mis. localStorage
  // terhapus sebagian) tapi refresh token masih ada, tukar refresh token
  // dengan sessionToken baru TANPA modal login. Refresh token hanya
  // diberikan saat login berhasil dan dicabut saat logout — jadi kalau
  // masih ada, admin memang belum logout.
  if (window.IS_ADMIN_PORTAL && localStorage.getItem('asj_admin_login') !== 'sukses') {
    var refreshToken = null;
    try {
      refreshToken = localStorage.getItem('asj_admin_refresh');
    } catch (e) {
      /* localStorage tidak tersedia */
    }
    if (refreshToken) {
      var rr = await callAPI('refreshAdminSession', [refreshToken]).catch(function () {
        return null;
      });
      if (rr && rr.success) {
        localStorage.setItem('asj_admin_login', 'sukses');
        if (rr.name) localStorage.setItem('asj_admin_name', rr.name);
        localStorage.setItem('asj_admin_session', rr.sessionToken || '');
      } else {
        // Refresh token basi/ditolak → cabut supaya tidak dicoba tiap buka.
        try {
          localStorage.removeItem('asj_admin_refresh');
        } catch (e) {
          /* abaikan */
        }
      }
    }
  }

  // PEMULIHAN SESI KANDIDAT DIAM-DIAM — sama seperti admin di atas:
  // kalau flag login kandidat hilang tapi refresh token masih ada, tukar
  // refresh token dengan sessionToken baru TANPA modal login. Berlaku di
  // semua halaman bundel (index.html — tempat kandidat login). Refresh
  // token hanya diberikan saat login berhasil dan dicabut saat logout.
  if (localStorage.getItem('asj_kandidat_login') !== 'sukses') {
    var refreshKandidat = null;
    try {
      refreshKandidat = localStorage.getItem('asj_kandidat_refresh');
    } catch (e) {
      /* localStorage tidak tersedia */
    }
    if (refreshKandidat) {
      var rr = await callAPI('refreshKandidatSession', [refreshKandidat]).catch(function () {
        return null;
      });
      if (rr && rr.success) {
        localStorage.setItem('asj_kandidat_login', 'sukses');
        if (rr.nama) localStorage.setItem('asj_kandidat_name', rr.nama);
        if (rr.wa) localStorage.setItem('asj_kandidat_wa', rr.wa);
        localStorage.setItem('asj_kandidat_session', rr.sessionToken || '');
      } else {
        // Refresh token basi/ditolak → cabut supaya tidak dicoba tiap buka.
        try {
          localStorage.removeItem('asj_kandidat_refresh');
        } catch (e) {
          /* abaikan */
        }
      }
    }
  }

  // Terapkan tema SEKARANG — per identitas aktif (admin/kandidat/guest),
  // lihat getSavedTheme di theme.js. Banner/footer/panel sinkron sejak
  // awal, tidak menunggu respons backend yang bisa lambat/gagal; initApp
  // akan memanggil applyTheme lagi dengan data backend kalau berhasil dimuat.
  var savedTheme = null;
  try {
    savedTheme = getSavedTheme();
  } catch (e) {}
  window.applyTheme(savedTheme || 'TOKYO');
  window.refreshDataDinamis(false);

  // admin.html (window.IS_ADMIN_PORTAL) = portal admin khusus.
  // Kalau masih belum login admin SETELAH percobaan pemulihan refresh
  // token di atas, buka modal login admin supaya halaman benar-benar
  // berfungsi sebagai gerbang panel admin. Kalau sudah login (sesi utuh
  // atau berhasil dipulihkan), initApp() otomatis masuk mode admin.
  if (window.IS_ADMIN_PORTAL && localStorage.getItem('asj_admin_login') !== 'sukses') {
    setTimeout(function () {
      if (typeof window.showLoginAdminMaster === 'function') window.showLoginAdminMaster();
    }, 500);
  }
});

document.addEventListener('click', function (e) {
  // @ts-expect-error JS→TS migration
  if (e.target.classList.contains('fixed') && e.target.classList.contains('inset-0')) {
    // @ts-expect-error JS→TS migration
    e.target.classList.add('hidden');
  }
});
