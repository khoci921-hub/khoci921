// @ts-nocheck
/* ASJ Portal - Service Worker
   Cache shell + update strategy:
   - Navigasi halaman: network-first (online selalu fresh, offline pakai cache)
   - Aset statis: stale-while-revalidate
   - API (.netlify, /api) & domain luar: selalu jaringan, tidak pernah di-cache

   Strategi update ANTI-CACHE-NYANGKUT (kasus 2026-08-17: HP user terus lihat
   versi lama walau deploy sudah live):
   - self.skipWaiting() dipanggil PALING AWAL di install — SW baru langsung
     aktif tanpa menunggu SKIP_WAITING dari pwa.js maupun semua tab ditutup.
     Sebelumnya skipWaiting dipanggil SETELAH precache selesai; kalau precache
     lambat dan user reload berulang, install di-abort tiap reload -> SW baru
     tidak pernah aktif -> cache lama menempel selamanya.
   - activate: hapus SEMUA cache lama, claim semua tab, lalu broadcast pesan
     ASJ_FORCE_RELOAD -> pwa.js versi baru langsung reload halaman ke versi
     terbaru (tanpa perlu reload manual).
   - SHELL/VERSION di-patch otomatis oleh scripts/build-js.mjs tiap build.
*/

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDQVyjXmiF1M5bnwJciIptZTWn8RcnyViE',
  projectId: 'khoci-7a81c',
  messagingSenderId: '1090676733378',
  appId: '1:1090676733378:web:3c0aa57a7ef133fc34925b',
});

const messaging = firebase.messaging();

// FCM_NOTIFICATION_HANDLER_START
messaging.onBackgroundMessage(function (payload) {
  var data = (payload && payload.data) || {};
  var options = { 
    body: String(data.body || ''), 
    icon: '/icons/icon-192.png',
    badge: '/icons/notification-badge.png', 
    data: { url: String(data.url || '/') },
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    silent: false
  };
  var work = [self.registration.showNotification(String(data.title || 'Notifikasi Baru'), options)];
  if (self.navigator && typeof self.navigator.setAppBadge === 'function') work.push(self.navigator.setAppBadge(1).catch(function () {}));
  return Promise.all(work);
});
// FCM_NOTIFICATION_HANDLER_END

// Notifikasi di-klik → navigasi ke URL yang sesuai
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = '/';
  if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  } else if (
    event.notification.data &&
    event.notification.data.FCM_MSG &&
    event.notification.data.FCM_MSG.data &&
    event.notification.data.FCM_MSG.data.url
  ) {
    url = event.notification.data.FCM_MSG.data.url;
  }
  // Buka/fokus tab yang sesuai URL
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});

const VERSION = 'asj-portal-app-d582601675-m13dccd9f';
const SHELL = [
  '/',
  '/index.html',
  '/admin.html',
  '/ai_form.html',
  '/apply-full.html',
  '/master-full.html',
  '/share.html',
  '/siswa-baru.html',
  '/assets/app-d582601675.js',
  '/assets/modals-shared.html',
  '/assets/jp-locale.js',
  '/manifest.webmanifest?v=8f163ba13c',
  '/icons/icon-192.png?v=39eaab3509',
  '/icons/icon-512.png?v=3a0a6aff80',
  '/icons/icon-maskable-512.png?v=a59481744d',
  '/icons/apple-touch-icon.png?v=b90abf8d0a',
];

self.addEventListener('install', (e) => {
  // 1) AKTIFKAN SEKARANG — jangan pernah biarkan SW baru menunggu.
  self.skipWaiting();
  // 2) Precache best-effort.
  e.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    })(),
  );
});

// SELF-INVALIDATING: check versi dari server tiap 5 menit.
// Kalau sw.js di server beda dari yang terinstall → force reload semua tab.
// Ini menangani kasus HP yang cache sw.js di HTTP level.
setInterval(
  function () {
    fetch('/sw.js?_check=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        return r.text();
      })
      .then(function (serverCode) {
        var serverVersion = serverCode.match(/const VERSION = '([^']+)'/);
        if (serverVersion && serverVersion[1] !== VERSION) {
          console.log('[sw.js] VERSION mismatch! Server:', serverVersion[1], 'Local:', VERSION);
          // Force reload semua tab
          self.clients.matchAll({ type: 'window' }).then(function (clientList) {
            clientList.forEach(function (client) {
              client.postMessage({ type: 'ASJ_FORCE_RELOAD' });
            });
          });
          // Unregister diri sendiri supaya fetch berikutnya dapat sw.js baru
          self.registration.unregister();
        }
      })
      .catch(function () {});
  },
  5 * 60 * 1000,
);

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Hapus SEMUA cache versi lama — tidak ada toleransi cache basi.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Beri tahu semua tab yang terbuka: versi baru sudah aktif, muat ulang.
      // (pwa.js versi baru mendengarkan pesan ASJ_FORCE_RELOAD; tab yang masih
      // menjalankan pwa.js lama otomatis dapat versi baru di navigasi berikutnya.)
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        client.postMessage({ type: 'ASJ_FORCE_RELOAD' });
      });
    })(),
  );
});

// Pesan dari halaman (pwa.js): SW baru sudah terpasang -> aktifkan segera
// (jaring pengaman tambahan, selain skipWaiting di install).
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Hanya tangani aset same-origin; jangan sentuh Supabase/storage eksternal
  if (url.origin !== self.location.origin) return;
  // API Netlify: selalu jaringan (jangan di-cache)
  if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')) return;

  // Navigasi halaman: network-first dengan fallback cache.
  // HANYA respons sukses (200) yang boleh masuk cache — halaman error tidak
  // boleh menimpa cache offline yang masih bagus.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req.url, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((m) => m || caches.match('/index.html'))),
    );
    return;
  }

  // Aset statis: stale-while-revalidate
  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
