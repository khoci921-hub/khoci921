// =============================================================================
// js/core/web-vitals.js — Web Vitals tracking (CLS, FID, LCP, INP, TTFB)
// -----------------------------------------------------------------------------
// Melaporkan Core Web Vitals ke console (dev) dan backend (production) lewat
// callAPI('reportWebVital', [...]). Backend menyimpan ke log atau Supabase.
//
// Dipanggil dari bridge.js saat load. Tidak mengubah perilaku UI.
// =============================================================================
import { onCLS, onFCP, onLCP, onINP, onTTFB } from '../../vendor/web-vitals.js';

const IS_PREVIEW =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.endsWith('.local'));

/**
 * Format metric ke object ringkas untuk logging.
 */
function formatMetric(metric) {
  return {
    name: metric.name, // CLS, FID, LCP, INP, TTFB
    value: metric.value, // numeric value
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta, // delta since last report
    id: metric.id, // unique id
    navigationType: metric.navigationType,
  };
}

/**
 * Handler untuk setiap metric — log ke console & kirim ke backend.
 */
function handleMetric(metric) {
  const formatted = formatMetric(metric);

  // Console log (selalu, untuk debugging)
  const icon =
    metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
  console.log(
    `[web-vitals] ${icon} ${metric.name}: ` +
      `${metric.value.toFixed(metric.name === 'CLS' ? 4 : 0)}ms (${metric.rating})`,
  );

  // Kirim ke backend (best-effort, jangan block navigasi)
  if (!IS_PREVIEW && typeof window.callAPI === 'function') {
    window.callAPI('reportWebVital', [formatted]).catch(() => {
      // Silent — backend mungkin belum handle action ini
    });
  }
}

/**
 * Inisialisasi Web Vitals tracking. Panggil sekali saat load.
 * Aman dipanggil berkali-kali (web-vitals dedupe otomatis).
 */
export function initWebVitals() {
  try {
    onCLS(handleMetric);
    onFCP(handleMetric);
    onLCP(handleMetric);
    onINP(handleMetric);
    onTTFB(handleMetric);
  } catch (err) {
    // web-vitals tidak tersedia atau browser tidak support — silent
    if (IS_PREVIEW) {
      console.warn('[web-vitals] init gagal:', err.message);
    }
  }
}

// Auto-init saat module dimuat
if (typeof document !== 'undefined') {
  initWebVitals();
}
