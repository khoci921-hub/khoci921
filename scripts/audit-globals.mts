#!/usr/bin/env node
// =============================================================================
// audit-globals.mjs — Audit Global Pollution & Collision Risk (Fase 3 ESM)
// -----------------------------------------------------------------------------
// Pendamping module-map.mjs: selain memetakan siapa deklarasi di mana, skrip
// ini menilai RISIKO setiap identifier global yang masih bocor ke scope:
//   1. SHADOWING — nama yang menimpa API bawaan browser (window.name,
//      window.status, window.close, window.open, window.length, ...).
//   2. KOLISI — nama yang dideklarasikan di 2+ file (guard check-globals
//      juga memastikan ini = 0 sebelum build).
//   3. NAMA UMUM — identifier pendek/kata umum yang gampang bentrok dengan
//      library pihak ketiga atau kode lain (risk High/Medium/Low).
//
// Nilai risk (heuristik, didokumentasikan di ESM_BRIDGE.md):
//   HIGH   = shadowing API browser ATAU kolisi lintas file ATAU nama umum
//            pendek (<=3 huruf / kata umum) dengan >=3 file pemakai.
//   MEDIUM = nama umum (1 kata, bukan prefiks domain) dengan 2-4 pemakai,
//            ATAU identifier spesifik dengan >=5 pemakai lintas file.
//   LOW    = identifier spesifik, pemakai <=1 file (kandidat privat/module).
//
// Jalankan:
//   node scripts/audit-globals.mjs            → tabel ringkas
//   node scripts/audit-globals.mjs --json     → output penuh (utk dok/CI)
//   node scripts/audit-globals.mjs --high     → hanya risk HIGH
// =============================================================================

import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const WANT_JSON = ARGS.has('--json');
const ONLY_HIGH = ARGS.has('--high');
const OUT = '.freebuff/audit-globals.json';

// ---------------------------------------------------------------------------
// Daftar file frontend (sama dengan module-map.mjs)
// ---------------------------------------------------------------------------
function frontendFiles() {
  const jsDir = join(ROOT, 'js');
  const jsFiles = [];
  const walk = (d, prefix) => {
    for (const f of readdirSync(d).sort((a, b) => a.localeCompare(b))) {
      const abs = join(d, f);
      if (f.endsWith('.js') && !f.includes('.test.')) jsFiles.push(`/js/${prefix}${f}`);
      else if (!f.includes('.') && f !== 'node_modules') walk(abs, prefix + f + '/');
    }
  };
  walk(jsDir, '');
  const stack = [
    '/api-client.js',
    '/i18n.js',
    '/pwa.js',
    ...jsFiles.sort((a, b) => a.localeCompare(b)),
  ];
  return stack
    .map((p) => {
      const abs = join(ROOT, p);
      return existsSync(abs) ? { rel: p, abs } : null;
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Ekstraksi deklarasi top-level + referensi (heuristik regex — cukup akurat
// untuk audit; verifikasi akhir tetap node --check + lint + test)
// ---------------------------------------------------------------------------
const DECL_RE =
  /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b|^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)|^window\.([A-Za-z_$][\w$]*)\s*=/gm;

function extractDecls(src) {
  const out = new Set();
  let m;
  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(src)) !== null) {
    const name = m[1] || m[2] || m[3] || m[4];
    if (name && !name.startsWith('window')) out.add(name);
  }
  return out;
}

// Nama window property bawaan browser — shadowing di sini = berisiko tinggi.
const WINDOW_PROPS = new Set(
  `name status close open length top parent self frames window document location history
   navigator screen innerHeight innerWidth outerHeight outerWidth pageXOffset pageYOffset
   screenX screenY screenLeft screenTop scrollX scrollY scrollbars menubar toolbar statusbar
   personalbar locationbar event closed defaultStatus opener customElements devicePixelRatio
   visualViewport styleMedia external chrome origin isSecureContext crossOriginIsolated
   crypto performance console localStorage sessionStorage indexedDB caches
   addEventListener removeEventListener dispatchEvent getComputedStyle matchMedia
   requestAnimationFrame cancelAnimationFrame fetch XMLHttpRequest WebSocket atob btoa
   setTimeout setInterval clearTimeout clearInterval queueMicrotask structuredClone
   alert confirm prompt print stop focus blur open close find
   onload onunload onerror onbeforeunload onhashchange onpopstate onresize onscroll onmessage
   ononline onoffline onstorage onpagehide onpageshow onfocus onblur onmouseenter onmouseleave`
    .split(/\s+/)
    .filter(Boolean),
);

// Kata umum (Bahasa Indonesia / Inggris / pendek) yang gampang bentrok.
const COMMON_NAMES = new Set(
  `all any api auth back base data edit end file filter find form get go hide id is job js key
   list load main map menu name next now old open page post print reset row run save set show
   start status stop tab table time toggle top url view wa
   open close status all filter set render submit show hide toggle add update delete clear
   get set init load build create remove check test value total index code text title error
   data form job name type size color style width height top left right center save cancel
   admin login user pass wa mail chat cv pdf doc file image upload download`
    .split(/\s+/)
    .filter(Boolean),
);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
const files = frontendFiles();
const sources = new Map(files.map((f) => [f.rel, readFileSync(f.abs, 'utf8')]));

// name -> { declaredIn: [file], refs: Set<file> }
const declByFile = new Map(); // file -> Set(name)
for (const f of files) declByFile.set(f.rel, extractDecls(sources.get(f.rel)));

const decls = new Map(); // name -> [file...]
for (const [rel, names] of declByFile) {
  for (const name of names) {
    if (!decls.has(name)) decls.set(name, []);
    decls.get(name).push(rel);
  }
}

// Referensi bare identifier per file (count kejadian `\bname\b` minus deklarasi).
function countRefs(name) {
  const re = new RegExp(`\\b${name}\\b`, 'g');
  const out = [];
  for (const f of files) {
    const src = sources.get(f.rel);
    let n = 0;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src)) !== null) n++;
    if (n > 0 && !declByFile.get(f.rel).has(name)) out.push(f.rel);
  }
  return out;
}

const report = {
  generatedAt: new Date().toISOString(),
  files: files.length,
  symbols: decls.size,
  items: [],
};
for (const [name, declaredIn] of decls) {
  const refs = countRefs(name);
  const shadowsWindow = WINDOW_PROPS.has(name);
  const collides = declaredIn.length > 1;
  const common = COMMON_NAMES.has(name);
  const nRef = refs.length;

  let risk = 'LOW';
  if (shadowsWindow || collides) risk = 'HIGH';
  else if (common && nRef >= 3) risk = 'HIGH';
  else if (common && nRef >= 1) risk = 'MEDIUM';
  else if (nRef >= 5) risk = 'MEDIUM';

  report.items.push({
    name,
    risk,
    declaredIn,
    refCount: nRef,
    referencedBy: refs.sort(),
    shadowsWindow,
    commonName: common,
  });
}

report.items.sort((a, b) => {
  const w = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  if (w[a.risk] !== w[b.risk]) return w[a.risk] - w[b.risk];
  return b.refCount - a.refCount;
});

if (WANT_JSON) {
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`[audit-globals] ${report.files} file · ${report.symbols} simbol → ${OUT}`);
} else {
  const rows = report.items.filter((i) => !ONLY_HIGH || i.risk === 'HIGH');
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const i of report.items) counts[i.risk]++;
  console.log(`[audit-globals] ${report.files} file · ${report.symbols} simbol global`);
  console.log(`  risk: HIGH=${counts.HIGH} MEDIUM=${counts.MEDIUM} LOW=${counts.LOW}`);
  for (const i of rows) {
    const flags = [
      i.shadowsWindow ? 'SHADOW-window' : null,
      i.declaredIn.length > 1 ? `KOLISI(${i.declaredIn.length})` : null,
      i.commonName ? 'nama-umum' : null,
    ].filter(Boolean);
    console.log(
      `  [${i.risk.padEnd(6)}] ${i.name.padEnd(28)} pemakai=${String(i.refCount).padEnd(3)} ` +
        `di ${i.declaredIn.join(',')}${flags.length ? ' — ' + flags.join(',') : ''}`,
    );
  }
}
