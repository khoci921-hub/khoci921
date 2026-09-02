// =============================================================================
// module-registry.mjs — SATU-SATUNYA sumber kebenaran struktur modul build.
// -----------------------------------------------------------------------------
// Dipakai oleh:
//   - scripts/build-js.mjs   (daftar modul bundel + halaman standalone)
//   - scripts/check-globals.mjs (daftar modul bundel)
//   - scripts/build-html.mjs (halaman bundel + partial modal + partial HTML)
//   - scripts/module-map.mjs (daftar halaman untuk deteksi pemanggil HTML)
// Tambah/ubah struktur modul DI SINI, bukan di tiap skrip.
//
// Fase 6 (2026-08-18): STACK concat DIHAPUS — daftar modul bundel kini
// diturunkan dari import eksplisit di js/main.js (bundleModules), jadi tidak
// ada lagi dua daftar yang bisa melenceng (STACK lama tertinggal tidak
// memuat js/cloudinary.js).
// =============================================================================

import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

// Daftar modul bundel = import eksplisit di js/main.js (satu-satunya sumber
// kebenaran daftar entry/modul — bukan daftar concat duplikat). Resolusi
// relatif dari direktori js/ → path root (format '/js/x.js' / '/api-client.js').
// Cakup side-effect import (import './x.js') DAN named import (import { a }
// from './x.js'); skip import dinamis (bukan pola import ... from).
export function bundleModules() {
  const src = readFileSync(new URL('../js/main.ts', import.meta.url), 'utf8');
  const re = /^import\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  const list = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const p = m[1];
    if (p.startsWith('.')) {
      list.push(posix.resolve('/js', p));
    } else {
      list.push(p.startsWith('/') ? p : '/' + p);
    }
  }
  return [...new Set(list)];
}

// Halaman yang memuat bundel (loader modal shared + tag <script> bundel).
export const BUNDLE_PAGES = ['admin.html', 'index.html'];

// Halaman standalone (type=module, tanpa bundel).
export const STANDALONE_PAGES = [
  'ai_form.html',
  'apply-full.html',
  'master-full.html',
  'share.html',
  'siswa-baru.html',
];

// Semua halaman (untuk deteksi pemanggil HTML di module-map / audit).
export const ALL_PAGES = [...BUNDLE_PAGES, ...STANDALONE_PAGES];

// Partial modal bersama (satu-satunya sumber semua modal).
export const MODAL_PARTIAL = 'partials/modals-shared.html';

// =============================================================================
// Fase 5 — partial HTML bersama (head/header/footer/social/bottom-nav/scripts)
// =============================================================================

// Lokasi partial (satu sumber kebenaran region halaman).
export const PARTIALS = {
  head: 'partials/head.html',
  header: 'partials/header.html',
  footer: 'partials/footer.html',
  social: 'partials/social.html',
  bottomNav: 'partials/bottom-nav.html',
  scriptsShared: 'partials/scripts-shared.html',
  // Fase 5 lanjutan (2026-08-18): duplikat di 5 halaman standalone
  headShared: 'partials/head-shared.html',
  themeInit: 'partials/theme-init.html',
};

// Region marker per halaman bundel (index/admin): region dibungkus marker ini
// di halaman source; build:html mengganti isi region dari partial tiap build
// (idempotent).
export const BUNDLE_REGIONS = {
  head: { start: '<!--HEAD_START-->', end: '<!--HEAD_END-->' },
  header: { start: '<!--HEADER_START-->', end: '<!--HEADER_END-->' },
  footer: { start: '<!--FOOTER_START-->', end: '<!--FOOTER_END-->' },
  bottomNav: { start: '<!--BOTTOM_NAV_START-->', end: '<!--BOTTOM_NAV_END-->' },
};

// Region marker halaman standalone — tiga region per halaman:
//  - scripts-shared : stack <script> akhir body
//  - head-shared    : fonts trio di <head> (font-awesome + fonts.css + preload)
//  - theme-init     : script inisialisasi tema tepat setelah <body>
export const STANDALONE_REGION = {
  start: '<!--SCRIPTS_SHARED_START-->',
  end: '<!--SCRIPTS_SHARED_END-->',
};
export const STANDALONE_HEAD_REGION = {
  start: '<!--HEAD_SHARED_START-->',
  end: '<!--HEAD_SHARED_END-->',
};
export const STANDALONE_THEME_INIT_REGION = {
  start: '<!--THEME_INIT_START-->',
  end: '<!--THEME_INIT_END-->',
};

// Token per-halaman untuk partials/head-shared.html — satu-satunya variasi
// fonts trio antar halaman standalone: INDENT (2/4 spasi) & urutan atribut
// link font-awesome (share: href dulu, sisanya rel dulu).
export const HEAD_TOKENS = {
  'apply-full.html': { INDENT: '  ', FA_ATTR: ' rel="stylesheet"', FA_ATTR2: '' },
  'master-full.html': { INDENT: '  ', FA_ATTR: ' rel="stylesheet"', FA_ATTR2: '' },
  'share.html': { INDENT: '    ', FA_ATTR: '', FA_ATTR2: ' rel="stylesheet"' },
  'siswa-baru.html': { INDENT: '    ', FA_ATTR: ' rel="stylesheet"', FA_ATTR2: '' },
  'ai_form.html': { INDENT: '    ', FA_ATTR: ' rel="stylesheet"', FA_ATTR2: '' },
};

// Token per-halaman untuk partial bundle (beda index vs admin — lihat
// partials/head.html & partials/header.html).
export const BUNDLE_TOKENS = {
  'index.html': {
    ADMIN_SCRIPT: '',
    HAMBURGER_COMMENT:
      '             <!-- HAMBURGER MENU (Desktop: inline flow, Mobile: absolute top right) -->\n',
    HAMBURGER_CLASS_EXTRA: ' shadow-lg',
    NAV_ADMIN_MARGIN: ' mt-1',
    NAV_KANDIDAT_MARGIN: ' mt-1',
  },
  'admin.html': {
    ADMIN_SCRIPT: '<script>window.IS_ADMIN_PORTAL = true;</script>\n',
    HAMBURGER_COMMENT: '',
    HAMBURGER_CLASS_EXTRA: '',
    NAV_ADMIN_MARGIN: '',
    NAV_KANDIDAT_MARGIN: '',
  },
};

// Token per-halaman standalone untuk partials/scripts-shared.html
// ({{PAGE_MODULES}} + {{AFTER_PWA}} = modul stack per halaman).
export const SCRIPT_TOKENS = {
  'apply-full.html': {
    PAGE_MODULES:
      '  <!-- Logika murni model dokumen upload (di-unit-test: scripts/__tests__/apply-docs.test.js) -->\n' +
      '  <script type="module" src="/js/apply-docs.js?v=esm13"></script>\n' +
      '  <script type="module" src="/js/upload-guard.js?v=esm13"></script>\n' +
      '  <!-- Fase 2: inline script dipindah ke js/pages/apply_full.js (isi byte-identik) -->\n' +
      '  <script type="module" src="/js/pages/apply_full.js?v=esm14"></script>\n',
    AFTER_PWA: '\n',
  },
  'master-full.html': {
    PAGE_MODULES:
      '  <script type="module" src="/js/upload-guard.js?v=esm13"></script>\n' +
      '    <!-- Fase 2: inline script utama dipindah ke js/pages/master_full.js (isi byte-identik) -->\n' +
      '  <script type="module" src="/js/pages/master_full.js?v=esm14"></script>\n',
    AFTER_PWA: '\n',
  },
  'share.html': {
    PAGE_MODULES:
      '    <!-- Fase 2: inline script dipindah ke js/pages/share.js (isi byte-identik) -->\n' +
      '    <script type="module" src="/js/pages/share.js?v=esm14"></script>\n',
    AFTER_PWA:
      '\n' +
      '  <!-- Renderer dokumen lokal (dibutuhkan saat preview dibuka): Excel -> SheetJS,\n' +
      '       Word -> mammoth, PPT -> pptx-preview. Dimuat terakhir supaya tidak\n' +
      '       memblokir logika aplikasi. -->\n' +
      '  <script src="/vendor/xlsx.full.min.js?v=7f749f81a4"></script>\n' +
      '  <script src="/vendor/mammoth.browser.min.js?v=ba27bf4add"></script>\n' +
      '  <script src="/vendor/pptx-preview.umd.js?v=8d69597cd3"></script>\n',
  },
  'siswa-baru.html': {
    PAGE_MODULES:
      '  <script type="module" src="/js/upload-guard.js?v=esm13"></script>\n' +
      '  <!-- Fase 2: inline script dipindah ke js/pages/siswa_baru.js (isi byte-identik) -->\n' +
      '  <script type="module" src="/js/pages/siswa_baru.js?v=esm14"></script>\n',
    AFTER_PWA: '\n',
  },
  'ai_form.html': {
    PAGE_MODULES:
      '    <!-- Fase 2: inline script utama dipindah ke js/pages/ai_form.js (isi byte-identik) -->\n' +
      '  <script type="module" src="/js/pages/ai_form.js?v=esm14"></script>\n',
    AFTER_PWA: '\n',
  },
};

// File halaman JS standalone (js/pages/*) — dipakai check-globals utk warning.
export const PAGE_JS = [
  '/js/pages/ai_form.ts',
  '/js/pages/master_full.ts',
  '/js/pages/apply_full.ts',
  '/js/pages/share.ts',
  '/js/pages/siswa_baru.ts',
];
