/* ASJ Portal - PWA helper
   - Registrasi service worker
   - Tangkap beforeinstallprompt (Chrome Android/Desktop) agar tombol "Install App" bisa memicu prompt asli browser
   - Fallback ke modal panduan manual (iOS Safari / browser yang tidak support prompt)

   ESM (Fase 3 langkah 13): modul ES — cobaInstallApp/bersihkanDraftLamaBase64
   di-export + alias window.* (pemakai classic/bundel & HTML onclick).
   Listener top-level tetap terdaftar saat modul dievaluasi (bundel: IIFE per
   file; standalone: <script type="module"> yang dieksekusi setelah parse,
   sebelum DOMContentLoaded/onload).
*/
// Alias window.* (cobaInstallApp/bersihkanDraftLamaBase64) dipasang via
// registry seam terpusat (Fase 3.5 L6) — pwa.js hanya dimuat lewat main.js
// (bundel admin/index), tempat bridge.js sudah dievaluasi lebih dulu.
import { registerSeamAliases } from './js/core/bridge';

// 0. MODE DEV (localhost) & PREVIEW Freebuff — preview SELALU fresh, tanpa
// chance versi lama.
// Service worker memakai strategi stale-while-revalidate: di production VERSION
// SW naik tiap deploy (bump-cache-versions) jadi cache dibuang otomatis, tapi
// di dev VERSION TIDAK berubah saat kita mengedit file -> aset JS lama bisa
// terus disajikan dari cache SW walau kode sumber sudah berubah. Solusinya:
// jangan daftarkan SW di localhost SAMA SEKALI, dan unregister + bersihkan
// cache SW lama (dari sesi dev sebelumnya) supaya tidak ada yang ikut campur.
//
// Host PREVIEW Freebuff (mis. https://3000-<id>.daytonaproxy01.net) juga
// BUKAN production, tapi bukan localhost pula — tanpa pengecualian ini HP user
// mendaftarkan SW beneran di domain preview dan cache-nya nyangkut (reload
// berulang tetap versi lama, kasus 2026-08-17). Perlakukan sama seperti
// localhost: unregister SW lama + bersihkan cache + JANGAN daftar. (Server
// preview serve-static.mjs juga melayani sw.js no-op sebagai jaring pengaman —
// lihat NOOP_SW di sana.)
var IS_DEV_HOST =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '[::1]');
var IS_PREVIEW_HOST =
  typeof location !== 'undefined' &&
  (location.hostname.indexOf('daytonaproxy') > -1 ||
    location.hostname.indexOf('.freebuff') > -1 ||
    location.hostname.indexOf('freebuff.app') > -1);
if (IS_PREVIEW_HOST && 'serviceWorker' in navigator) {
  // Hapus SW lama + cache-nya (aman: hanya di localhost, production tidak
  // tersentuh). Dipanggil sekali di awal, sebelum registrasi apa pun.
  navigator.serviceWorker
    .getRegistrations()
    .then(function (regs) {
      regs.forEach(function (reg) {
        reg.unregister().catch(function () {});
      });
    })
    .catch(function () {});
  if (window.caches && caches.keys) {
    caches
      .keys()
      .then(function (keys) {
        keys.forEach(function (k) {
          caches.delete(k).catch(function () {});
        });
      })
      .catch(function () {});
  }
} else if ('serviceWorker' in navigator) {
  // 1. Registrasi service worker (HANYA production / non-localhost)
  var refreshing = false;
  var userInteracted = false;
  // Tandai interaksi user pertama (klik/touch/keydown) supaya auto-reload
  // tidak pernah memotong gestur install/prompt yang sedang berjalan.
  window.addEventListener(
    'pointerdown',
    function () {
      userInteracted = true;
    },
    { once: true, passive: true },
  );
  window.addEventListener(
    'keydown',
    function () {
      userInteracted = true;
    },
    { once: true },
  );

  window.addEventListener('load', function () {
    // COOLDOWN LOCK: cegah multiple reload dari berbagai mekanisme anti-cache
    // yang race condition (cekVersiSw + ASJ_FORCE_RELOAD + controllerchange).
    // Kalau sudah pernah reload < 30 detik yang lalu, SKIP semua mekanisme.
    // MAX RELOAD: maksimal 2 auto-reload per sesi browser (sessionStorage)
    // — cegah loop 5-10x yang terjadi karena 3 mekanisme fire bergantian
    // dan `refreshing` local variable reset tiap page load.
    var MAX_AUTO_RELOADS = 2;
    var RELOAD_COOLDOWN_MS = 30000;
    function getReloadCount() {
      if (!window.sessionStorage) return 0;
      return parseInt(sessionStorage.getItem('asj_reload_count') || '0', 10);
    }
    function isReloadCooldownActive() {
      if (!window.sessionStorage) return false;
      var lastReload = parseInt(sessionStorage.getItem('asj_last_reload') || '0', 10);
      var now = Date.now();
      if (lastReload && now - lastReload < RELOAD_COOLDOWN_MS) return true;
      // MAX RELOAD CAP: jika sudah reload MAX_AUTO_RELOADS kali, STOP permanen
      if (getReloadCount() >= MAX_AUTO_RELOADS) return true;
      return false;
    }
    function markReloaded() {
      if (!window.sessionStorage) return;
      sessionStorage.setItem('asj_last_reload', String(Date.now()));
      var count = getReloadCount() + 1;
      sessionStorage.setItem('asj_reload_count', String(count));
    }
    // Persist `refreshing` flag across page loads (anti-loop akar masalah).
    // Local variable reset tiap reload → mekanisme lain bisa fire lagi.
    // Bersihkan lock kalau cooldown sudah expired (reload selesai aman).
    if (sessionStorage.getItem('asj_refreshing_lock') === '1') {
      if (isReloadCooldownActive()) {
        refreshing = true; // masih dalam cooldown → tetap lock
      } else {
        sessionStorage.removeItem('asj_refreshing_lock'); // sudah aman
      }
    }
    function lockRefreshing() {
      refreshing = true;
      if (window.sessionStorage) sessionStorage.setItem('asj_refreshing_lock', '1');
    }

    // SELF-CHECK ANTI-BASI: bandingkan VERSION sw.js di server dengan yang terakhir
    // dilihat. Kalau berubah (deploy baru), reload sekali — halaman basi dari
    // cache langsung dilempar ke versi terbaru.
    (function cekVersiSw() {
      try {
        if (!window.sessionStorage) return;
        if (isReloadCooldownActive()) return; // sudah baru saja reload, skip
        fetch('/sw.js?v=' + Date.now(), { cache: 'no-store' })
          .then(function (r) {
            return r.text();
          })
          .then(function (t) {
            var m = t.match(/const VERSION = '([^']+)'/);
            if (!m) return;
            var ver = m[1];
            var swHash = (ver.match(/app-([a-f0-9]+)/) || [])[1];

            // Hash bundel yang BENAR-BENAR TERMUAT di halaman ini (bukan
            // yang di-sw.js). HANYA untuk halaman bundel (/assets/app-<hash>.js).
            // Halaman standalone (ai_form/master-full/apply-full/dll) memuat
            // modul ESM langsung dengan cache-buster ?v=esm<rev> — query itu
            // BUKAN hash bundel, jadi membandingkannya dengan swHash selalu
            // beda → purge+reload palsu tiap buka (bug 2026-08-18).
            var loadedHash = '';
            var app = document.querySelector('script[src*="/assets/app-"]');
            if (app) {
              var am = app.getAttribute('src').match(/app-([a-f0-9]+)\.js/);
              if (am) loadedHash = am[1];
            }
            if (loadedHash && swHash && loadedHash !== swHash && !refreshing) {
              var purged = sessionStorage.getItem('asj_sw_purged');
              if (purged !== ver) {
                sessionStorage.setItem('asj_sw_purged', ver);
                lockRefreshing();
                markReloaded();
                // Hapus semua cache + unregister SW lama
                if (window.caches && caches.keys) {
                  caches
                    .keys()
                    .then(function (keys) {
                      keys.forEach(function (k) {
                        caches.delete(k).catch(function () {});
                      });
                    })
                    .catch(function () {});
                }
                if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                  navigator.serviceWorker
                    .getRegistrations()
                    .then(function (regs) {
                      regs.forEach(function (reg) {
                        reg.unregister().catch(function () {});
                      });
                    })
                    .catch(function () {});
                }
                window.location.reload();
                return;
              }
            }

            var last = sessionStorage.getItem('asj_sw_ver');
            sessionStorage.setItem('asj_sw_ver', ver);
            if (last && last !== ver && !refreshing && !isReloadCooldownActive()) {
              lockRefreshing();
              markReloaded();
              window.location.reload();
            }
          })
          .catch(function () {});
      } catch (e) {
        /* non-blokir */
      }
    })();

    // updateViaCache:'none' -> browser SELALU mengecek sw.js ke jaringan
    // (tidak memakai HTTP cache) setiap kali update dicek. Tanpa ini browser
    // bisa memakai sw.js lama berhari-hari dan versi lama terus disajikan.
    // Cache-busting: paksa browser fetch sw.js TERBARU dari server
    // (beberapa HP cache sw.js di HTTP level meski updateViaCache:'none')
    var swUrl = '/sw.js?v=' + Date.now();
    navigator.serviceWorker
      .register(swUrl, { updateViaCache: 'none' })
      .then(function (reg) {
        if (!reg) return;

        // Cek update: segera, tiap 60 dtk, dan saat tab kembali fokus.
        // reg.update() memaksa browser membandingkan sw.js dengan server —
        // versi baru langsung terdeteksi walau halaman sudah lama terbuka
        // (tanpa perlu reload manual).
        function cekUpdate() {
          if (!navigator.onLine) return;
          reg.update().catch(function () {});
        }
        cekUpdate();
        window.setInterval(cekUpdate, 60 * 1000);
        window.addEventListener('focus', cekUpdate);
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') cekUpdate();
        });

        // SW baru terpasang -> minta aktif segera via SKIP_WAITING (diterima
        // listener di sw.js). Tanpa ini SW baru menunggu sampai semua tab
        // ditutup sebelum mengambil alih — versi baru bisa tertunda.
        reg.addEventListener('updatefound', function () {
          var swBaru = reg.installing;
          if (!swBaru) return;
          swBaru.addEventListener('statechange', function () {
            if (swBaru.state === 'installed' && navigator.serviceWorker.controller) {
              swBaru.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('[PWA] Registrasi service worker gagal:', err);
      });

    // Auto-reload saat Service Worker baru aktif (mencegah cache nyangkut).
    // COOLDOWN: kalau baru saja reload (<10s), SKIP — cegah auto-loop.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      if (userInteracted) return;
      if (isReloadCooldownActive()) return; // sudah baru saja reload
      lockRefreshing();
      markReloaded();
      try {
        if (window.showToast) {
          window.showToast('Versi terbaru tersedia — memuat ulang…', 'info');
        }
      } catch (e) {
        /* toast opsional */
      }
      window.setTimeout(function () {
        window.location.reload();
      }, 1200);
    });

    // Pesan dari Service Worker: versi baru SUDAH aktif (ASJ_FORCE_RELOAD
    // dikirim sw.js saat activate). COOLDOWN guard mencegah loop.
    navigator.serviceWorker.addEventListener('message', function (ev) {
      if (!ev.data || ev.data.type !== 'ASJ_FORCE_RELOAD') return;
      if (refreshing) return;
      if (userInteracted) return;
      if (isReloadCooldownActive()) return; // sudah baru saja reload
      lockRefreshing();
      markReloaded();
      try {
        if (window.showToast) {
          window.showToast('Versi terbaru tersedia — memuat ulang…', 'info');
        }
      } catch (e) {
        /* toast opsional */
      }
      window.setTimeout(function () {
        window.location.reload();
      }, 1200);
    });
  });

  // Fallback: if document already loaded when this module ran, the load listener
  // above never fired. Register SW immediately.
  if (document.readyState === 'complete') {
    var swUrl2 = '/sw.js?v=' + Date.now();
    navigator.serviceWorker.register(swUrl2, { updateViaCache: 'none' }).catch(function () {});
  }
}

// 2. Tangkap beforeinstallprompt (Chrome Android/Desktop)
var deferredPrompt = null;
var pendingInstallEvent = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  deferredPrompt = e;
});
// Chrome 117+: event `install` baru menggantikan peran beforeinstallprompt
// (yang mulai di-deprecate). Simpan juga supaya tombol tetap bisa memicu
// prompt native di browser yang hanya support API baru.
window.addEventListener('install', function (e) {
  e.preventDefault();
  pendingInstallEvent = e;
});

// 3. Fungsi global untuk tombol "Install App"
export function cobaInstallApp() {
  var modal = document.getElementById('modal-install');
  var evt = deferredPrompt || pendingInstallEvent;
  if (evt) {
    try {
      // beforeinstallprompt klasik: evt.prompt() + evt.userChoice Promise.
      // Event `install` (Chrome 117+): evt.prompt() juga async, tapi hasilnya
      // lewat return Promise, bukan properti userChoice.
      var result = evt.prompt();
      var settle = evt.userChoice || result || Promise.resolve(null);
      Promise.resolve(settle)
        .then(function (choice) {
          var dismissed = choice && choice.outcome === 'dismissed';
          if (dismissed && modal) {
            // User batal di prompt browser -> tampilkan panduan manual
            modal.classList.remove('hidden');
          }
        })
        .catch(function () {
          /* userChoice bisa tidak tersedia */
        });
    } catch (err) {
      console.warn('[PWA] Gagal memicu prompt install:', err);
      if (modal) modal.classList.remove('hidden');
    }
    deferredPrompt = null;
    pendingInstallEvent = null;
    return;
  }
  // Fallback: tampilkan modal panduan manual (iOS Safari, atau prompt tidak
  // tersedia karena belum memenuhi kriteria installable)
  if (modal) modal.classList.remove('hidden');
}

// 4. Saat app ter-install, tutup modal jika masih terbuka
window.addEventListener('appinstalled', function () {
  deferredPrompt = null;
  pendingInstallEvent = null;
  var modal = document.getElementById('modal-install');
  if (modal) modal.classList.add('hidden');
});

// 5. MIGRASI SATU KALI (terpusat): bersihkan draft lama ai_form yang masih
// menyimpan base64 JFT/SSW di localStorage.
//
// Kenapa di pwa.js, bukan di service worker: SW TIDAK punya akses ke
// localStorage (batasan spesifikasi — localStorage hanya ada di window
// context, SW cuma punya Cache API/IndexedDB/fetch). pwa.js dimuat di SEMUA
// halaman, jadi begitu user membuka halaman mana pun setelah deploy ini,
// draft lama langsung dibersihkan — tanpa perlu membuka ai_form dulu.
//
// Format lama (pra-fix): { currentJftBase64, currentSswBase64,
// currentJftFile, currentSswFile } berisi base64 PDF bisa puluhan MB -> quota
// localStorage 5MB penuh -> data "nyangkut"/gagal simpan. Rewrite (bukan
// hapus total): data teks (chatHistory/latestCandidateData) & foto kecil
// dipertahankan, hanya field base64/file yang dibuang. Idempotent: format
// baru tidak mengandung field itu, jadi aman dipanggil tiap load.
export function bersihkanDraftLamaBase64() {
  try {
    var prefix = 'asj_qween_cv_data_';
    // Kumpulkan dulu SEMUA key ber-prefix (jangan iterasi sambil menghapus:
    // indeks localStorage bergeser dan key bisa terlewat).
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) keys.push(k);
    }
    keys.forEach(function (key) {
      var raw = localStorage.getItem(key);
      if (!raw) return;
      var parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        /* rusak */
      }
      if (!parsed || typeof parsed !== 'object') {
        localStorage.removeItem(key); // JSON rusak -> hapus, bukan dibiarkan
        return;
      }
      // Format lama = ada base64/file JFT/SSW ber-data (bukan kosong/null).
      var jftB = parsed.currentJftBase64,
        sswB = parsed.currentSswBase64;
      var jftF = parsed.currentJftFile,
        sswF = parsed.currentSswFile;
      var isOldFormat =
        (typeof jftB === 'string' && jftB.length > 0) ||
        (typeof sswB === 'string' && sswB.length > 0) ||
        (jftF && typeof jftF === 'object' && jftF.data) ||
        (sswF && typeof sswF === 'object' && sswF.data);
      if (isOldFormat) {
        // Rewrite ke format baru: buang field base64/file, simpan ulang.
        var bersih = {
          chatHistory: parsed.chatHistory || [],
          latestCandidateData: parsed.latestCandidateData || {},
          currentPhotoBase64: parsed.currentPhotoBase64 || '',
        };
        localStorage.setItem(key, JSON.stringify(bersih));
      }
    });
  } catch (e) {
    console.warn('[PWA] Gagal membersihkan draft lama:', e);
  }
}

// BRIDGE ESM → classic/bundel & HTML onclick: alias window.* dipasang via
// registry seam (Fase 3.5 L6). Jalankan migrasi begitu pwa.js termuat
// (semua halaman, sebelum onload/initApp halaman mana pun).
registerSeamAliases({ cobaInstallApp, bersihkanDraftLamaBase64 }, { source: 'pwa' });
bersihkanDraftLamaBase64();

// 6. PENANDA VERSI (verifikasi cepat): tempel versi bundel ke baris
// copyright di footer, mis. "…ALL RIGHTS RESERVED. · v2a72296550".
// User bisa langsung melihat versi mana yang tampil di layar — kalau tidak
// sama dengan versi terbaru, berarti browser masih pakai cache/SW lama
// (bukan masalah server). Membaca hash dari src script bundel
// (/assets/app-<hash>.js); halaman standalone fallback ke ?v= pwa.js.
// Aman: tidak mengubah layout & tidak muncul kalau footer tidak ada.
(function pasangPenandaVersi() {
  try {
    // Hitung dulu hash bundel dari <script src="/assets/app-<hash>.js">
    // (fallback: query ?v= di pwa.js untuk halaman standalone).
    var ver = '';
    var app = document.querySelector('script[src*="/assets/app-"]');
    if (app) {
      var m = app.getAttribute('src').match(/app-([a-f0-9]+)\.js/);
      if (m) ver = m[1];
    }
    if (!ver) {
      var pw = document.querySelector('script[src*="/pwa.js"]');
      if (pw) {
        var q = (pw.getAttribute('src') || '').match(/[?&]v=([^&]+)/);
        if (q) ver = q[1];
      }
    }
    if (!ver) return;
    var title = 'Versi aplikasi. Kalau tidak sama dengan versi terbaru, refresh / clear site data.';
    // Badge versi di footer (kalau elemen footer ada). Chip di header
    // (asj-ver-chip) dihapus 2026-08-17 atas permintaan pemilik — versi
    // tidak perlu tampil di banner, cukup di footer.
    var el = document.querySelector('[data-lang="footer.copyright"]');
    if (!el || el.querySelector('.asj-ver-badge')) return; // idempotent
    var span = document.createElement('span');
    span.className = 'asj-ver-badge ml-2 text-emerald-300/90 font-mono';
    span.textContent = 'v' + ver;
    span.title = title;
    el.appendChild(span);
  } catch (e) {
    /* penanda versi opsional — jangan ganggu halaman */
  }
})();

// 7. DIRECT SW REGISTRATION — ensure SW is registered regardless of load event timing.
// The load listener above may not fire if the module loads after document.readyState='complete'.
// This runs unconditionally (safe: register is idempotent).
if ('serviceWorker' in navigator && !IS_PREVIEW_HOST) {
  var swDirectUrl = '/sw.js?v=' + Date.now();
  navigator.serviceWorker.register(swDirectUrl, { updateViaCache: 'none' }).catch(function () {});
}

// 8. Hapus badge notifikasi PWA saat aplikasi dibuka atau kembali fokus.
function clearPwaBadge() {
  if (navigator.clearAppBadge) {
    navigator.clearAppBadge().catch(function () {});
  }
}
// Panggil saat initial load
clearPwaBadge();
// Panggil saat aplikasi kembali terlihat
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') {
    clearPwaBadge();
  }
});

// 9. OFFLINE INDICATOR — tampilkan toast saat user kehilangan koneksi.
//    Mencegah UX "tiba-tiba gagal" saat user mencoba submit/chat tanpa sadar offline.
var _offlineToastShown = false;
window.addEventListener('offline', function () {
  if (_offlineToastShown) return;
  _offlineToastShown = true;
  try {
    if (typeof window.showToast === 'function') {
      window.showToast('Anda sedang offline — beberapa fitur mungkin tidak berfungsi.', 'error');
    }
  } catch (e) { /* toast opsional */ }
});
window.addEventListener('online', function () {
  _offlineToastShown = false;
  try {
    if (typeof window.showToast === 'function') {
      window.showToast('Koneksi kembali — memuat ulang data…', 'success');
    }
  } catch (e) { /* toast opsional */ }
  // Reload halaman untuk memastikan data fresh setelah offline
  window.setTimeout(function () { window.location.reload(); }, 1500);
});

// 10. GLOBAL ERROR BOUNDARY — tangkap error JS yang tidak terhandle.
//     Tanpa ini, error di satu modul bisa membuat seluruh halaman "mati"
//     tanpa pesan jelas ke user.
window.addEventListener('error', function (event) {
  console.error('[Global Error]', event.message, 'at', event.filename + ':' + event.lineno);
  // Jangan ganggu halaman untuk error minor (font loading, analytics, dll)
  if (event.message && event.message.indexOf('ResizeObserver') !== -1) return;
  try {
    if (typeof window.showToast === 'function') {
      window.showToast('Terjadi kesalahan. Coba muat ulang halaman.', 'error');
    }
  } catch (e) { /* toast opsional */ }
});
window.addEventListener('unhandledrejection', function (event) {
  console.error('[Unhandled Promise]', event.reason);
  // Jangan tampilkan toast untuk network error (sudah ditangani offline indicator)
  if (event.reason && event.reason.message && event.reason.message.indexOf('NetworkError') !== -1) return;
  try {
    if (typeof window.showToast === 'function') {
      window.showToast('Terjadi kesalahan jaringan. Periksa koneksi Anda.', 'error');
    }
  } catch (e) { /* toast opsional */ }
});
