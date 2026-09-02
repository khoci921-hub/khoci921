// =============================================================================
// js/core/bridge.js — Bridge ESM → legacy (Fase 3 ESM migration)
// -----------------------------------------------------------------------------
// Memuat core ESM (i18n.js + api-client.js) lewat `import`, lalu mengekspos
// namespace TUNGGAL `window.PortalBridge` untuk kode legacy:
//   - HTML inline `onclick="PortalBridge.xxx(...)"` / `onclick="xxx(...)"`
//   - file classic js/*.js yang belum di-ESM (bundel admin/index)
//   - halaman standalone (ai_form, apply-full, master-full, share, siswa-baru)
//
// Efek samping import: api-client.js & i18n.js kini MURNI ESM (tidak lagi
// menulis window.* sendiri) — alias classic (window.tr, window.LANG,
// window.CURRENT_LANG, window.callAPI, window.esc, window.escJs,
// window.resolveSelfUrl, ...) dipasang DI SINI lewat registerSeamAliases
// (lihat bagian registrasi core di bawah), jadi SEMUA pemakai lama tetap
// jalan tanpa perubahan. window.PortalBridge adalah namespace tambahan yang
// rapi untuk kode baru / migrasi bertahap.
//
// CARA LOAD:
//   - Halaman standalone: js/pages/* adalah ENTRY ESM — tiap halaman
//     meng-import modul ini sendiri (`import { registerSeamAliases } from
//     '../core/bridge.js'`), jadi TIDAK perlu lagi tag <script> core terpisah.
//   - Bundel admin/index: bridge.js masuk STACK + di-import js/main.js
//     (hanya core — api-client/i18n, di-dedupe esbuild) → window.PortalBridge
//     tersedia di SEMUA halaman.
// (module = deferred → jalan setelah parse, SEBELUM DOMContentLoaded; kode
// classic yang butuh callAPI/tr dipanggil runtime/event, bukan saat parse.)
//
// PEMANGGILAN AMAN dari kode legacy (kalau urutan muat tidak dijamin):
//   function callApiAman(action, payload) {
//     const fn = (window.PortalBridge && window.PortalBridge.callAPI) || window.callAPI;
//     if (typeof fn !== 'function') {
//       console.error('[portal] core belum dimuat');
//       return Promise.reject(new Error('PortalBridge belum siap'));
//     }
//     return fn(action, payload);
//   }
//
// DISPATCHER DELEGASI `data-action` (Fase 3.5 Langkah 6 lanjutan):
//   Handler HTML inline yang POLOS (panggilan fungsi tunggal dengan argumen
//   literal) bisa dipindah dari `onclick="fn('x')"` ke atribut
//   `data-action="fn"` (+ `data-action-arg='["x"]'` JSON untuk argumen).
//   Satu listener delegasi di document (click/change) yang dipasang di bawah
//   menangkap event, resolve nama dari registry seam (SEAM_ALIASES → fallback
//   window), lalu memanggilnya. Dengan begitu halaman TIDAK bergantung pada
//   `window.fn` untuk handler itu — alias cukup terdaftar di registry.
//   Handler yang masih EKSPRESI (ternary, multi-statement, `this`, template
//   literal) TETAP pakai onclick inline — tidak bisa didelegasikan tanpa
//   mengubah markup (lihat ESM_BRIDGE.md §3.5).
// =============================================================================
import * as api from '../../api-client.ts';
import * as i18n from '../../i18n.ts';
import * as fcmClient from '../fcm-client.ts';
import { initWebVitals } from './web-vitals.ts';
import { initSentry } from './sentry.ts';

// Namespace tunggal untuk kode legacy. Property CURRENT_LANG memakai getter
// supaya SELALU membaca nilai terbaru (toggleFormLanguage me-reassign
// binding modul — snapshot value di awal akan basi).
export const PortalBridge = {
  // --- API backend (api-client.js) ---
  callAPI: api.callAPI,
  esc: api.esc,
  escJs: api.escJs,
  resolveSelfUrl: api.resolveSelfUrl,

  // --- i18n (i18n.js) ---
  LANG: i18n.LANG,
  get CURRENT_LANG() {
    return i18n.CURRENT_LANG;
  },
  tr: i18n.tr,
  trOption: i18n.trOption,
  trOptionId: i18n.trOptionId,
  renderLanguageLight: i18n.renderLanguageLight,
  toggleFormLanguage: i18n.toggleFormLanguage,

  // Pemanggilan aman: fallback ke alias classic kalau PortalBridge belum ada.
  safeCallAPI(action, payload) {
    const fn = (window.PortalBridge && window.PortalBridge.callAPI) || window.callAPI;
    if (typeof fn !== 'function') {
      console.error('[portal] callAPI belum dimuat');
      return Promise.reject(new Error('PortalBridge belum siap'));
    }
    return fn(action, payload);
  },

  // --- Registrasi alias seam HTML↔JS (sentralisasi, Fase 3.5 Langkah 6) ---
  registerSeamAliases,
  getSeamAliases,

  // --- Dispatcher delegasi data-action (Fase 3.5 Langkah 6 lanjutan) ---
  dispatchSeamAction,

  // --- Guard runtime handler inline (dev/preview, lihat bagian bawah) ---
  checkInlineHandlers,
  flushGuardWarnings,
};

// =============================================================================
// Registrasi alias seam HTML↔JS — TERPUSAT di sini (Fase 3.5 Langkah 6)
// -----------------------------------------------------------------------------
// Fungsi yang dipanggil dari atribut HTML (onclick/onchange/onload) atau dari
// string onclick yang di-generate runtime DIEVAL di global scope → harus punya
// alias `window.*`. Sebelumnya tiap modul halaman menulis `window.X = X`
// sendiri-sendiri di bagian bawah file. Sekarang diregistrasikan terpusat:
//   - js/pages/* (entry ESM halaman standalone) memanggil
//     `registerSeamAliases({ namaFn, ... })` — peta ekspor handler-nya.
//   - Modul bundel admin/index juga bisa memakai mekanisme ini (bridge.js ada
//     di STACK/main.js) — alias per-simbol lama tetap jalan sampai semua
//     pemakainya pindah ke sini.
// Registry (SEAM_ALIASES) disimpan supaya bisa diaudit via getSeamAliases()
// dan re-registrasi idempotent (nilai sama → tidak ada efek ganda).
// =============================================================================

// Registry pusat: nama alias → nilai (fungsi, atau data eksplisit via
// `{ allowNonFunction: true }`). Private modul (tidak bocor ke window).
const SEAM_ALIASES = new Map();
// Jejak nama → deskripsi modul pendaftar (untuk pesan tabrakan yang jelas).
const SEAM_SOURCES = new Map();

/**
 * Daftarkan peta alias seam HTML↔JS ke window secara terpusat.
 * @param {Record<string, Function|*>} aliases Nama alias → handler (fungsi)
 *   atau nilai data (objek/const — HANYA dengan `opts.allowNonFunction`).
 * @param {{ allowNonFunction?: boolean, source?: string }} [opts]
 *   - `allowNonFunction`: izinkan nilai non-fungsi (objek/const). Hati-hati:
 *     nilai yang MUTABLE lalu di-reassign dari luar modul tidak akan sinkron
 *     (alias data property = snapshot binding) — untuk itu pakai accessor.
 *   - `source`: label modul pendaftar (untuk pesan tabrakan nama).
 * @returns {Record<string, Function|*>} Peta yang sama (untuk chaining/tes).
 */
export function registerSeamAliases(aliases, opts = {}) {
  for (const [name, value] of Object.entries(aliases || {})) {
    const isFn = typeof value === 'function';
    // @ts-expect-error JS→TS migration
    if (!isFn && !opts.allowNonFunction) {
      console.warn(
        `[bridge] registerSeamAliases: "${name}" bukan fungsi — dilewati. ` +
          `Kalau ini data eksplisit (objek/const), daftarkan dengan { allowNonFunction: true }.`,
      );
      continue;
    }
    // Guard tabrakan nama: nama yang sama terdaftar ulang dengan nilai berbeda
    // = indikasi dua modul mendefinisikan seam yang sama → deteksi dini.
    if (SEAM_ALIASES.has(name)) {
      const prev = SEAM_ALIASES.get(name);
      if (prev !== value) {
        console.warn(
          `[bridge] TABRAKAN nama seam "${name}": sudah terdaftar oleh ` +
            `${SEAM_SOURCES.get(name) || 'modul lain'} dengan nilai berbeda — ` +
            `nilai terbaru menang. Periksa duplikat antar modul!`,
        );
      }
    } else {
      // @ts-expect-error JS→TS migration
      SEAM_SOURCES.set(name, opts.source || 'modul lain');
    }
    SEAM_ALIASES.set(name, value);
    window[name] = value;
  }
  return aliases;
}

/**
 * Snapshot registry alias seam (untuk audit/debug).
 * @returns {Record<string, Function|*>}
 */
export function getSeamAliases() {
  return Object.fromEntries(SEAM_ALIASES);
}

// =============================================================================
// Dispatcher delegasi `data-action` — 1 listener di document untuk semua
// elemen `[data-action]` (click/change), resolve dari registry seam.
// -----------------------------------------------------------------------------
// Elemen: `<button data-action="bukaModalKandidat" data-action-arg='["login"]'>`
// atau `<input data-action="filterKandidat">` (change). Nama di-resolve dari
// SEAM_ALIASES (→ fallback window.*), dipanggil dengan argumen JSON
// `data-action-arg` (array). Handler yang butuh ekspresi/this TETAP inline.
// =============================================================================

const ACTION_SELECTOR = '[data-action]';
let dispatcherInstalled = false;

function resolveSeam(name) {
  if (SEAM_ALIASES.has(name)) return SEAM_ALIASES.get(name);
  if (typeof window[name] === 'function') return window[name];
  return null;
}

/**
 * Eksekusi satu seam action secara langsung (dipakai dispatcher & tes).
 * @param {string} name Nama action (harus terdaftar / ada di window).
 * @param {Event} [event] Event asli (untuk konteks `currentTarget`).
 * @param {any[]} [args] Argumen tambahan (dari data-action-arg).
 * @returns {*} Nilai balik handler (false → caller boleh preventDefault).
 */
export function dispatchSeamAction(name, event, args) {
  const fn = resolveSeam(name);
  if (typeof fn !== 'function') {
    console.warn(
      `[bridge] data-action "${name}" tidak terdaftar (getSeamAliases()) maupun di window.*`,
    );
    return undefined;
  }
  return fn.apply(event ? event.currentTarget : undefined, args || []);
}

function handleDelegatedAction(event, type) {
  const el = event.target && event.target.closest ? event.target.closest(ACTION_SELECTOR) : null;
  if (!el) return;
  const name = el.getAttribute('data-action');
  if (!name) return;
  let args = [];
  const rawArg = el.getAttribute('data-action-arg');
  if (rawArg) {
    try {
      const parsed = JSON.parse(rawArg);
      if (Array.isArray(parsed)) args = parsed;
      else args = [parsed];
    } catch (err) {
      console.warn(
        `[bridge] data-action-arg "${rawArg}" bukan JSON valid — dipanggil tanpa argumen.`,
        err,
      );
    }
  }
  const result = dispatchSeamAction(name, event, args);
  if (result === false) event.preventDefault();
  void type;
}

/** Pasang listener delegasi document (sekali saja, idempotent). */
export function initSeamDispatcher() {
  if (dispatcherInstalled || typeof document === 'undefined') return;
  dispatcherInstalled = true;
  document.addEventListener('click', (e) => handleDelegatedAction(e, 'click'));
  document.addEventListener('change', (e) => handleDelegatedAction(e, 'change'));
}

// =============================================================================
// Guard runtime handler inline (dev/preview) — pelengkap check-handlers.mjs
// -----------------------------------------------------------------------------
// Scanner statis (CI) membaca teks sumber dan butuh daftar EVENT_NAMES yang
// dirawat manual. Guard ini membaca atribut event APA PUN langsung dari DOM
// (getAttributeNames) — tanpa daftar event, jadi tidak bisa ketinggalan event
// baru, dan juga menangkap handler yang di-generate dinamis.
//
// Temuan penting saat implementasi (2026-08-18): kalau warning dicetak
// langsung saat scan, terjadi FALSE POSITIVE — modul lain (mis. admin) baru
// menjalankan registerSeamAliases SETELAH bridge selesai di-evaluasi, jadi
// window.X belum ada saat scan pertama. Solusi: scan menumpuk temuan ke
// guardPending; flushGuardWarnings() baru mencetak nama yang MASIH hilang
// saat flush (di-load +3 detik) — nama yang terdaftar belakangan otomatis
// lolos, nama yang benar-benar missing di-warn sekali.
//
// Hanya console.warn (tidak mengubah perilaku) dan hanya aktif di host
// non-produksi supaya tidak berisik di domain asli.
// =============================================================================

// Panggilan fungsi di nilai handler: (window.)?NAME(
const INLINE_CALL_RE = /(window\.)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
// Kata kunci yang muncul sebagai if(...)/for(...)/new ... — bukan panggilan.
const INLINE_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'return',
  'typeof',
  'instanceof',
  'new',
  'delete',
  'void',
  'do',
  'else',
  'in',
  'of',
  'function',
  'class',
  'const',
  'let',
  'var',
  'this',
  'super',
  'yield',
  'await',
  'import',
  'export',
  'default',
  'throw',
  'try',
  'catch',
  'finally',
  'case',
  'break',
  'continue',
  'debugger',
]);

function isPreviewHost() {
  if (typeof location === 'undefined') return false;
  const h = location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.local') ||
    h.startsWith('192.168.') ||
    h.startsWith('10.')
  );
}

// Mask string '...' dan "..." di nilai handler — teks natural seperti
// 'foo(bar)' jangan dianggap panggilan fungsi.
function maskInlineStrings(src) {
  let out = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) {
        quote = null;
        out += ' ';
        continue;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

function elLabel(el) {
  let label = '<' + el.tagName.toLowerCase();
  if (el.id) label += '#' + el.id;
  const cls = typeof el.className === 'string' && el.className.trim();
  if (cls) label += '.' + cls.split(/\s+/)[0];
  return label + '>';
}

// Temuan sementara: attr|nama|lokasi -> { attr, name, label }. Baru dicetak
// saat flush kalau nama-nya MASIH tidak resolve.
const guardPending = new Map();

/**
 * Periksa SEMUA handler inline di DOM (atribut on* + data-action) — pastikan
 * nama yang dipanggil benar-benar resolve ke fungsi di window. Hasilnya
 * ditumpuk ke guardPending; cetak lewat flushGuardWarnings().
 * @param {ParentNode} [root] Akar DOM yang diperiksa (default: document).
 */
export function checkInlineHandlers(root = document) {
  if (!isPreviewHost()) return;
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (const el of root.querySelectorAll('*')) {
    for (const attr of el.getAttributeNames()) {
      let name = null;
      let label = elLabel(el);
      if (attr === 'data-action') {
        name = el.getAttribute('data-action');
        if (name && typeof window[name] === 'function') continue;
      } else if (attr.startsWith('on')) {
        const src = maskInlineStrings(el.getAttribute(attr) || '');
        INLINE_CALL_RE.lastIndex = 0;
        let m;
        let found = null;
        while ((m = INLINE_CALL_RE.exec(src))) {
          const prefix = m[1];
          const candidate = m[2];
          const before = src[m.index - 1];
          if (!prefix && before === '.') continue; // this./event./document.
          if (INLINE_KEYWORDS.has(candidate)) continue; // if(...)/for(...)
          if (typeof window[candidate] !== 'function') {
            found = candidate;
            break;
          }
        }
        if (!found) continue;
        name = found;
      } else {
        continue;
      }
      const key = attr + '|' + name + '|' + label;
      if (!guardPending.has(key)) {
        guardPending.set(key, { attr, name, label });
      }
    }
  }
}

/**
 * Cetak temuan guard yang MASIH valid (nama masih tidak resolve ke window),
 * sekali per temuan, lalu bersihkan antrean. Dipanggil otomatis di load+3s;
 * bisa juga manual setelah render dinamis (PortalBridge.flushGuardWarnings()).
 */
export function flushGuardWarnings() {
  for (const { attr, name, label } of guardPending.values()) {
    if (typeof window[name] === 'function') continue; // terdaftar belakangan — bukan bug
    if (attr === 'data-action') {
      console.warn(
        `[guard] data-action="${name}" tidak resolve ke window — tombol mati diam-diam (${label})`,
      );
    } else {
      console.warn(`[guard] ${attr} memanggil "${name}" tapi tidak ada di window (${label})`);
    }
  }
  guardPending.clear();
}

// Pasang ke window untuk pemakai classic.
window.PortalBridge = PortalBridge;
initSeamDispatcher();

// Sentry error tracking (lazy load — SDK 688KB di-load async saat init dipanggil)
initSentry().catch(() => {});

// Web Vitals tracking (auto-init saat module dimuat)
initWebVitals();

// Scan bertahap (semua modul sudah registerSeamAliases saat load), lalu flush
// di load+3 detik — menangkap render dinamis yang selesai sebentar setelah
// load, dan memberi waktu modul lain mendaftarkan alias-nya.
checkInlineHandlers();
window.addEventListener('load', () => {
  checkInlineHandlers();
  setTimeout(() => {
    checkInlineHandlers();
    flushGuardWarnings();
  }, 3000);
});

// =============================================================================
// Fase 3.5 L6 lanjutan — alias core ROOT (api-client.js & i18n.js) TIDAK lagi
// menulis window.* sendiri (kini murni ESM); alias dipasang lewat registry
// seam TERPUSAT di sini. Bridge dimuat di SEMUA halaman (bundel admin/index +
// halaman standalone), jadi pemakai classic tetap dapat window.callAPI/tr/
// LANG/dst persis seperti dulu — hanya jalur pemasangannya yang berubah.
// =============================================================================
registerSeamAliases(
  {
    callAPI: api.callAPI,
    esc: api.esc,
    escJs: api.escJs,
    resolveSelfUrl: api.resolveSelfUrl,
    requestNotificationPermission: fcmClient.requestNotificationPermission,
  },
  { source: 'bridge:api-client' },
);
registerSeamAliases(
  {
    tr: i18n.tr,
    trOption: i18n.trOption,
    trOptionId: i18n.trOptionId,
    renderLanguageLight: i18n.renderLanguageLight,
    toggleFormLanguage: i18n.toggleFormLanguage,
    LANG: i18n.LANG,
  },
  { source: 'bridge:i18n', allowNonFunction: true },
);

// ESM-only: modul lain bisa `import { PortalBridge, registerSeamAliases } from './bridge.ts'`.
export default PortalBridge;
