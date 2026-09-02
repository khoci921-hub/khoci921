// js/core/posthog.ts — PostHog session replay + analytics (frontend).
//
// LAZY LOAD via CDN: PostHog array.js (~30KB) di-load dari CDN saat
// initPosthog() dipanggil. Bundle utama TIDAK include SDK.
// Tanpa KEY → SDK tidak di-load sama sekali.
//
// Free tier: 1M events + 5K session recordings/bulan.
// Fitur: session replay (lihat apa yang user lihat), error tracking, analytics.
'use strict';

const POSTHOG_KEY = 'phc_tVeoUDFj4JVqHnTEmWwwNc7VTb7tMPMgnZEebYvEL6d8';
const POSTHOG_HOST = 'https://us.i.posthog.com';
const CDN_URL =
  POSTHOG_HOST.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';

let _initialized = false;

/**
 * Load PostHog SDK dari CDN secara dinamis.
 * Mengembalikan true jika berhasil, false jika gagal.
 */
function loadPosthogSdk(): Promise<boolean> {
  return new Promise((resolve) => {
    // Sudah ada di window (sudah pernah di-load)?
    if (
      typeof (window as any).posthog !== 'undefined' &&
      typeof (window as any).posthog.__SV !== 'undefined'
    ) {
      resolve(true);
      return;
    }

    // Sudah ada script tag dengan URL yang sama?
    const existing = document.querySelector(`script[src="${CDN_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        resolve(typeof (window as any).posthog !== 'undefined');
      });
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    // Load PostHog via official snippet pattern (array.js)
    // PostHog uses window.posthog = [] queue pattern — SDK drains queue on load
    (window as any).posthog = (window as any).posthog || [];
    (window as any).posthog._i = (window as any).posthog._i || [];

    const script = document.createElement('script');
    script.src = CDN_URL;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      resolve(
        typeof (window as any).posthog !== 'undefined' &&
          typeof (window as any).posthog.__SV !== 'undefined',
      );
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Inisialisasi PostHog session replay + analytics.
 * SDK ~30KB di-load dari CDN. Tanpa KEY → SDK tidak di-load.
 *
 * Fitur aktif:
 * - Session replay (mask input values untuk privasi)
 * - Automatic error capture
 * - Page view tracking
 * - Custom event capture via posthog.capture()
 */
export async function initPosthog(): Promise<void> {
  if (_initialized) return;
  if (!POSTHOG_KEY) return;

  try {
    const loaded = await loadPosthogSdk();
    if (!loaded) return;

    const ph = (window as any).posthog;
    if (!ph || typeof ph.init !== 'function') return;

    // Determine environment
    const isProd = window.location.hostname.includes('netlify');
    const env = isProd ? 'production' : 'development';

    ph.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Session replay: record user interactions untuk debugging
      session_recording: {
        maskAllInputs: true, // Mask input values (password, WA, etc.)
        maskTextClass: 'ph-no-capture', // Custom class untuk element yang tidak mau direcord
      },
      // Persistence: localStorage + sessionStorage
      persistence: 'localStorage+sessionStorage',
      // Capture page views otomatis
      capture_pageview: true,
      // Capture clicks otomatis
      capture_clicks: true,
      // Don't capture rage clicks (noise)
      autocapture: {
        dom_event_allowlist: ['click', 'change', 'submit'],
        // Don't capture element attributes (privacy)
        mask_selectors: ['input[type="password"]', '[data-private]'],
      },
      // loaded callback — setelah SDK siap
      loaded: function (posthog: any) {
        // Identify user berdasarkan role
        if (isProd) {
          posthog.opt_out_capturing(); // Default: opt-out, aktifkan per-user
        }
      },
      // Environment tag
      _environment: env,
    });

    _initialized = true;
  } catch {
    // PostHog init gagal → jangan crash app
  }
}

/**
 * Identify user untuk PostHog session tracking.
 * Panggil setelah login berhasil.
 */
export function identifyPosthog(user: { role?: string; wa?: string; name?: string } | null): void {
  if (!_initialized) return;
  const ph = (window as any).posthog;
  if (!ph || typeof ph.identify !== 'function' || !user) return;

  const id = user.wa || user.name || 'anonymous';
  ph.identify(id, {
    role: user.role || 'unknown',
    name: user.name || '',
  });

  // Opt-in capturing setelah user login (hanya production)
  if (window.location.hostname.includes('netlify')) {
    ph.opt_in_capturing();
  }
}

/**
 * Capture custom event.
 * Contoh: capturePosthog('modal_opened', { modal: 'cv-mini' })
 */
export function capturePosthog(event: string, properties?: Record<string, unknown>): void {
  if (!_initialized) return;
  const ph = (window as any).posthog;
  if (!ph || typeof ph.capture !== 'function') return;
  ph.capture(event, properties);
}

/**
 * Reset user identity (saat logout).
 */
export function resetPosthog(): void {
  if (!_initialized) return;
  const ph = (window as any).posthog;
  if (!ph || typeof ph.reset !== 'function') return;
  ph.reset();
}
