// i18n.js — AGREGAT re-export (Fase 4). Logika: i18n/core.js, data bahasa:
// i18n/locales/{id,jp}/ (per-domain). Alias window.* (tr/LANG/dst) TIDAK lagi
// ditulis di sini — diregistrasikan lewat registry seam di js/core/bridge.js
// (Fase 3.5 L6). Satu-satunya pengecualian: accessor window.CURRENT_LANG ada
// di i18n/core.js (harus men-assign binding modul).
export * from './i18n/core.js';
