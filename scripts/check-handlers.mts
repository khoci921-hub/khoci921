// =============================================================================
// check-handlers.mjs — Guard: SEMUA handler inline harus terdaftar di window
// -----------------------------------------------------------------------------
// Kelas bug yang sudah beberapa kali terjadi (2026-08-18): fungsi dipanggil
// dari atribut HTML inline (onclick/onkeyup/...) tapi TIDAK terdaftar sebagai
// alias window (regresi refactor ESM Fase 3.5 — dulu global otomatis saat
// STACK concat, sekarang harus lewat registerSeamAliases) -> ReferenceError
// diam-diam tiap interaksi. Lint/tes biasa tidak menangkap: fungsi ada sebagai
// export, hanya alias window-nya yang hilang.
//
// Cara kerja:
//   1. REFERENSI — kumpulkan nama fungsi yang dipanggil dari atribut event
//      (on*="...") dan data-action="...", di HTML statis (semua halaman +
//      partials) dan string HTML yang di-generate JS (template literal).
//   2. SELF-CHECK CAKUPAN — SEMUA atribut onXXX yang dipakai di repo harus ada
//      di daftar EVENT_NAMES. Kalau ada event baru yang belum didaftarkan,
//      skrip GAGAL (bukan diam-diam tidak di-scan — blind spot yang dulu
//      bikin keydown/keypress/error lolos).
//   3. TERDAFTAR — nama yang benar-benar jadi property window: kunci
//      registerSeamAliases({...}) (di-parse tepat key/value, bukan regex kasar)
//      + assignment window.X = dengan lookahead (?!=) supaya `typeof window.X
//      === 'function'` tidak dianggap registrasi.
//   4. DIFF — exit 1 kalau ada referensi yang tidak terdaftar.
//
// Jalankan: bun run check:handlers  (otomatis di `bun run build` + CI)
// =============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ---- Scope file -------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '.git', 'assets', '.freebuff', 'coverage', 'dist']);
const SKIP_FILES = /\.(map|test\.js|test\.ts|spec\.js|spec\.ts)$/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (!SKIP_FILES.test(name) && /\.(html|js|ts|mts)$/.test(name)) out.push(p);
  }
  return out;
}

// ---- Utilitas teks ----------------------------------------------------------

// Strip komentar: /* */, // (baris, hanya kalau diawali spasi/awal-baris —
// aman untuk kode prettier), dan <!-- -->. Contoh kode di komentar jangan
// dianggap referensi nyata.
function stripComments(text) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  text = text.replace(/(^|\s)\/\/[^\n]*/g, '$1 ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  return text;
}

// Ganti isi string literal '...' dan "..." dengan spasi, sisakan kode di luar
// string. Dipakai pada NILAI handler: string di dalamnya (mis. teks natural
// seperti '... Save as PDF ...') jangan dianggap panggilan fungsi. Backtick
// sengaja TIDAK di-mask — handler yang di-generate JS hidup di template
// literal, jadi justru harus terlihat.
function maskStrings(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
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

// ---- 1. Referensi handler ---------------------------------------------------

// Atribut event handler content attribute yang didukung. Wajib lengkap —
// self-check di bagian bawah GAGAL kalau ada onXXX yang dipakai tapi belum di
// daftar ini. Atribut HTML yang namanya diawali "on" SELALU event handler
// (konvensi HTML), jadi tidak ada pengecualian selain melengkapi daftar ini.
const EVENT_NAMES = [
  'click',
  'dblclick',
  'change',
  'input',
  'keyup',
  'keydown',
  'keypress',
  'blur',
  'focus',
  'submit',
  'reset',
  'load',
  'error',
  'select',
  'search',
  'paste',
  'scroll',
  'mouseenter',
  'mouseleave',
  'mouseover',
  'mouseout',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'contextmenu',
  'dragover',
  'drop',
  'dragstart',
  'dragend',
  'animationend',
  'transitionend',
  'pointerdown',
  'pointerup',
  'pointermove',
  'pointerenter',
  'pointerleave',
];
const EVENT_SET = new Set(EVENT_NAMES);
// Ekstraksi nilai handler. \b mencegah kata seperti `content=` ketarik
// (batas kata gagal di `on` yang ada di tengah kata).
const EVENT_RE = new RegExp(`\\bon(?:${EVENT_NAMES.join('|')})="([^"]*)"`, 'g');
// Self-check cakupan: SEMUA atribut onXXX yang dipakai (nama event apa pun).
const ANY_EVENT_RE = /\bon([a-z]+)="/g;
// data-action="nama" (dispatcher delegasi bridge — kalau missing: console.warn
// + klik tidak melakukan apa-apa).
const ACTION_RE = /data-action="([A-Za-z_$][A-Za-z0-9_$]*)"/g;
// Panggilan fungsi di dalam nilai handler: (window.)?NAME(
const CALL_RE = /(window\.)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;

// Nama yang dipanggil dari handler tapi berasal dari global standard browser/JS
// (encodeURIComponent, scrollTo, open, alert, dsb) — bukan alias seam.
const STD_GLOBALS = new Set([
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',
  'scrollTo',
  'open',
  'close',
  'alert',
  'confirm',
  'prompt',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'JSON',
  'Math',
  'Date',
  'RegExp',
  'Error',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Symbol',
  'BigInt',
  'Infinity',
  'NaN',
  'undefined',
  'globalThis',
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'fetch',
  'console',
  'FormData',
  'Blob',
  'File',
  'FileReader',
  'Image',
  'URL',
  'URLSearchParams',
  'XMLHttpRequest',
  'atob',
  'btoa',
  'crypto',
  'performance',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'matchMedia',
  'getComputedStyle',
  'requestIdleCallback',
  'cancelIdleCallback',
  'queueMicrotask',
  'structuredClone',
  'TextEncoder',
  'TextDecoder',
  'IntersectionObserver',
  'ResizeObserver',
  'MutationObserver',
  'CustomEvent',
  'Event',
]);

// Kata kunci JS yang muncul sebagai `if(...)`, `for(...)` dll di handler
// inline (mis. onkeypress="if(event.key==='Enter'){...}") — bukan panggilan.
const JS_KEYWORDS = new Set([
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

const refs = new Map(); // nama fungsi -> file pertama (untuk laporan)
const eventUsage = new Map(); // nama event -> file pertama (self-check cakupan)

function collect(text, file) {
  let m;
  while ((m = EVENT_RE.exec(text))) {
    // Nilai handler bisa berisi string literal ('...'/ "...") — teks natural
    // di dalamnya jangan dianggap panggilan fungsi.
    const outside = maskStrings(m[1]);
    let c;
    CALL_RE.lastIndex = 0;
    while ((c = CALL_RE.exec(outside))) {
      const prefix = c[1];
      const name = c[2];
      const before = outside[c.index - 1];
      if (!prefix && before === '.') continue; // document./this./event. — property access
      if (STD_GLOBALS.has(name)) continue; // global standard browser/JS
      if (JS_KEYWORDS.has(name)) continue; // if(...)/for(...) — control flow
      if (!refs.has(name)) refs.set(name, file);
    }
  }
  while ((m = ACTION_RE.exec(text))) {
    if (!refs.has(m[1])) refs.set(m[1], file);
  }
  while ((m = ANY_EVENT_RE.exec(text))) {
    if (!eventUsage.has(m[1])) eventUsage.set(m[1], file);
  }
}

const htmlFiles = walk('.').filter((p) => p.endsWith('.html'));
// Modul ESM: seluruh js/ + file JS di root (pwa.js, api-client.js, i18n.js, ...)
const jsFiles = [...walk('js'), ...walk('.').filter((p) => /^[^\\/]+\.(js|ts)$/.test(p))];
const srcFiles = [...htmlFiles, ...jsFiles];

for (const f of srcFiles) collect(stripComments(readFileSync(f, 'utf8')), f);

// ---- 2. Nama terdaftar di window --------------------------------------------

// Temukan '}' penutup objek mulai dari posisi '{' (start). Sadar-string
// (termasuk backtick) — komentar sudah di-strip oleh pemanggil. Tidak lagi
// mengasumsikan nilai objek "flat": nilai boleh berisi {}/[]/()/=>.
function findObjectEnd(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      let j = i + 1;
      while (j < src.length && src[j] !== q) j++;
      i = j;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Kunci objek dari registerSeamAliases({...}) — state machine key/value.
// Parser regex lama salah mendaftarkan NILAI sebagai alias ({ a: b, c } -> 'b'
// ikut terdaftar padahal bukan alias) = false negative di jaring. State
// machine ini hanya mendaftarkan kunci; koma di dalam nilai bersarang
// (objek/array/arrow) tidak dianggap pemisah entri.
function collectSeamKeys(body) {
  const keys = new Set();
  let i = 0;
  let expectKey = true; // posisi key: setelah '{' atau koma level-0
  let depth = 0; // kedalaman ( [ { di posisi value
  while (i < body.length) {
    const ch = body[i];
    if (ch === "'" || ch === '"') {
      const q = ch;
      let j = i + 1;
      while (j < body.length && body[j] !== q) j++;
      if (expectKey) keys.add(body.slice(i + 1, j));
      i = j + 1;
      continue;
    }
    if (expectKey) {
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(body.slice(i));
      if (m) {
        keys.add(m[0]);
        i += m[0].length;
        continue;
      }
      i++;
      continue;
    }
    // posisi value: telusuri sampai koma level-0 / tutup objek
    if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      i++;
      continue;
    }
    if (ch === ',' && depth === 0) {
      expectKey = true;
      i++;
      continue;
    }
    i++;
  }
  return keys;
}

const registered = new Set();
for (const f of jsFiles) {
  // Sisi terdaftar TIDAK di-mask string: regex literal JS bisa memuat tanda
  // kutip (/['"]/) dan masking naif justru menyembunyikan blok registrasi
  // asli (false negative — lebih buruk daripada registrasi palsu). Yang
  // diandalkan untuk presisi: collectSeamKeys (hanya kunci) + lookahead (?!=)
  // (menolak ===/== pada window.X =).
  const src = stripComments(readFileSync(f, 'utf8'));
  // registerSeamAliases({ ... }) — kunci normal (a: b), string ('a': b), atau shorthand (a,)
  const seamRe = /registerSeamAliases\(\s*\{/g;
  let sm;
  while ((sm = seamRe.exec(src))) {
    const start = sm.index + sm[0].length - 1; // posisi '{'
    const end = findObjectEnd(src, start);
    if (end < 0) continue;
    for (const k of collectSeamKeys(src.slice(start + 1, end))) registered.add(k);
  }
  // window.X = ... (assignment global lain). Lookahead (?!=) menolak === dan ==
  // — `typeof window.X === 'function'` bukan registrasi.
  const winRe = /window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)/g;
  let w;
  while ((w = winRe.exec(src))) registered.add(w[1]);
}

// ---- 3. Self-check cakupan event --------------------------------------------

const uncoveredEvents = [...eventUsage.keys()].filter((e) => !EVENT_SET.has(e)).sort();
if (uncoveredEvents.length > 0) {
  console.log(
    '❌ ATRIBUT EVENT DIPAKAI TAPI TIDAK TERDAFTAR DI EVENT_NAMES (' +
      uncoveredEvents.length +
      '):',
  );
  for (const e of uncoveredEvents)
    console.log('  - on' + e + '  (dipakai di: ' + eventUsage.get(e) + ')');
  console.log(
    '\nCara fix: tambahkan nama event tsb ke daftar EVENT_NAMES di scripts/check-handlers.mjs ' +
      '— kalau tidak, handler-nya tidak pernah di-scan.',
  );
  process.exit(1);
}

// ---- 4. Diff -----------------------------------------------------------------

if (refs.size === 0) {
  console.error(
    '❌ check-handlers: tidak ada referensi handler ditemukan — cek scope scan (cwd?).',
  );
  process.exit(1);
}

const missing = [...refs.keys()].filter((n) => !registered.has(n)).sort();

console.log(
  'check-handlers: ' +
    refs.size +
    ' referensi handler unik (' +
    eventUsage.size +
    ' event), ' +
    registered.size +
    ' nama terdaftar di window.',
);
if (missing.length === 0) {
  console.log('✅ SEMUA handler inline terdaftar — tidak ada risiko ReferenceError.');
  process.exit(0);
}
console.log('❌ HANDLER DIPANGGIL TAPI TIDAK TERDAFTAR (' + missing.length + '):');
for (const n of missing) console.log('  - ' + n + '  (dipakai di: ' + (refs.get(n) || '?') + ')');
console.log(
  '\nCara fix: daftarkan fungsi tsb di registerSeamAliases({...}) di modulnya (lihat js/core/bridge.js).',
);
process.exit(1);
