// =============================================================================
// fcm-client.ts — Frontend Firebase Cloud Messaging & Service Worker
// =============================================================================
// Firebase SDK di-load dari CDN (lazy) — tidak masuk bundle utama.
// Service worker (sw.js) sudah import Firebase SDK via importScripts().
import { callAPI } from '../api-client.ts';

let messaging: any = null;

// Konfigurasi Firebase dari akun
const firebaseConfig = {
  apiKey: 'AIzaSyDQVyjXmiF1M5bnwJciIptZTWn8RcnyViE',
  projectId: 'khoci-7a81c',
  messagingSenderId: '1090676733378',
  appId: '1:1090676733378:web:3c0aa57a7ef133fc34925b',
};

/**
 * Inisialisasi Firebase App & Messaging.
 * Dipanggil secara asinkron saat PWA dimuat.
 */
export async function initFCM(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[FCM] Browser tidak mendukung Push Notification.');
    return;
  }

  try {
    // Load Firebase SDK dari CDN jika belum dimuat
    const w = window as any;
    if (!w.firebase) {
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');
    }

    if (!w.firebase.apps.length) {
      w.firebase.initializeApp(firebaseConfig);
    }

    messaging = w.firebase.messaging();

    // Tangkap notifikasi saat aplikasi sedang terbuka (foreground)
    messaging.onMessage((payload: any) => {
      console.log('[FCM] Pesan diterima (foreground):', payload);
      const data = payload.data || {};
      const notif = payload.notification || {};
      const title = data.title || notif.title || 'Notifikasi Baru';
      const body = data.body || notif.body || '';
      if (window.showToast) {
        window.showToast(title + ': ' + body, 'info');
      }
    });

    console.log('[FCM] Firebase Messaging berhasil diinisialisasi.');
  } catch (error) {
    console.error('[FCM] Gagal inisialisasi:', error);
  }
}

/**
 * Meminta izin ke pengguna untuk menampilkan notifikasi.
 * Jika disetujui, ambil FCM token dan kirim ke backend (Supabase).
 * @param {string} userWa - Nomor WA (ID unik user/admin yang login)
 */
export async function requestNotificationPermission(userWa: string): Promise<void> {
  if (!messaging) {
    await initFCM();
  }
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('[FCM] Izin notifikasi diberikan.');

      // Tunggu SW terdaftar (max 5 detik) — kadang masih register saat init
      let swRegistration = await navigator.serviceWorker.getRegistration();
      if (!swRegistration) {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 500));
          swRegistration = await navigator.serviceWorker.getRegistration();
          if (swRegistration) break;
        }
      }
      if (!swRegistration) {
        console.warn('[FCM] Service Worker belum terdaftar — skip token.');
        return;
      }

      const token = await messaging.getToken({
        serviceWorkerRegistration: swRegistration,
      });

      if (token) {
        console.log('[FCM] Token didapatkan:', token);
        await saveTokenToDatabase(userWa, token);
      } else {
        console.warn('[FCM] Gagal mendapatkan token registrasi FCM.');
      }
    } else {
      console.warn('[FCM] Izin notifikasi ditolak oleh pengguna.');
    }
  } catch (error) {
    console.error('[FCM] Error meminta izin notifikasi:', error);
  }
}

/**
 * Cek apakah user sudah memberikan izin notifikasi.
 */
export function isNotificationGranted(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Cek apakah browser mendukung push notification.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function saveTokenToDatabase(wa: string, token: string): Promise<void> {
  try {
    const res = await callAPI('registerFcmToken', [wa, token, navigator.userAgent]);
    if (res && (res as any).success) {
      console.log('[FCM] Token berhasil disimpan di database.');
    }
  } catch (err) {
    console.error('[FCM] Gagal menyimpan token:', err);
  }
}
