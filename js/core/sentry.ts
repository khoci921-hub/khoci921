// js/core/sentry.ts — Sentry error tracking (frontend).
//
// LAZY LOAD via CDN: @sentry/browser (688KB) di-load dari CDN hanya saat
// initSentry() dipanggil. Bundle utama TIDAK include SDK → hemat 688KB.
// Tanpa DSN → SDK tidak di-load sama sekali.
'use strict';

const DSN =
  'https://1aaacfbbb81ea01e30ba99e7ad953bf0@o4511939170467840.ingest.us.sentry.io/4511939208478720';

// Sentry SDK version — harus match CDN URL di bawah
const SDK_VERSION = '8.55.0';
const CDN_URL = `https://browser.sentry-cdn.com/${SDK_VERSION}/bundle.min.js`;

let _initialized = false;
let _Sentry: any = null;

/**
 * Load Sentry SDK dari CDN secara dinamis.
 * Mengembalikan true jika berhasil, false jika gagal.
 */
function loadSentrySdk(): Promise<boolean> {
  return new Promise((resolve) => {
    // Sudah ada di window (sudah pernah di-load)?
    if (typeof (window as any).Sentry !== 'undefined') {
      _Sentry = (window as any).Sentry;
      resolve(true);
      return;
    }

    // Sudah ada script tag dengan URL yang sama?
    const existing = document.querySelector(`script[src="${CDN_URL}"]`);
    if (existing) {
      // Tunggu sampai script selesai load
      existing.addEventListener('load', () => {
        _Sentry = (window as any).Sentry;
        resolve(!!_Sentry);
      });
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    // Buat script tag baru
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      _Sentry = (window as any).Sentry;
      resolve(!!_Sentry);
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Inisialisasi Sentry error tracking — LAZY LOAD dari CDN.
 * SDK 688KB hanya di-load saat fungsi ini dipanggil.
 * Tanpa DSN → SDK tidak di-load sama sekali (hemat 688KB bundle).
 */
export async function initSentry(): Promise<void> {
  if (_initialized) return;

  // Guard: kalau tidak ada DSN, jangan load SDK sama sekali
  if (!DSN) return;

  try {
    // Load SDK dari CDN (688KB, load async)
    const loaded = await loadSentrySdk();
    if (!loaded || !_Sentry) return;

    _Sentry.init({
      dsn: DSN,
      environment: window.location.hostname.includes('netlify') ? 'production' : 'development',
      tracesSampleRate: 0.1, // 10% performance traces
      replaysSessionSampleRate: 0, // disable replay (hemat quota)
      replaysOnErrorSampleRate: 0.5, // 50% replay saat error
      integrations: [_Sentry.browserTracingIntegration()],
      beforeSend(event: any) {
        // Filter noise: toolbar clicks, resize, scroll yang tidak relevan
        if (event.exception && event.exception.values) {
          const ex = event.exception.values[0];
          if (ex && ex.type === 'ResizeObserver loop') return null;
          if (ex && ex.type === 'Non-Error promise rejection' && !ex.value) return null;
        }
        return event;
      },
    });
    _initialized = true;

    // Global error listeners (fallback untuk error yang tidak di-capture SDK)
    window.addEventListener('error', (e) => {
      if (e.error && _Sentry) _Sentry.captureException(e.error);
    });
    window.addEventListener('unhandledrejection', (e) => {
      if (e.reason && _Sentry) _Sentry.captureException(e.reason);
    });
  } catch {
    // Sentry init gagal → jangan crash app
  }
}

/**
 * Tags user context untuk error tracking.
 * @param {object} ctx - { role: 'admin'|'kandidat', wa: '628...', name: 'SACHOU' }
 */
export function setSentryUser(ctx: { role?: string; wa?: string; name?: string } | null): void {
  if (!_initialized || !_Sentry || !ctx) return;
  _Sentry.setUser({
    id: ctx.wa || ctx.name || 'anonymous',
    role: ctx.role || 'unknown',
  });
}

/**
 * Add breadcrumb untuk debugging.
 * @param {string} category
 * @param {string} message
 * @param {object} [data]
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!_initialized || !_Sentry) return;
  _Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

// Expose untuk test / advanced usage
export function getSentryInstance(): any {
  return _Sentry;
}
