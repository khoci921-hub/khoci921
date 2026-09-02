#!/usr/bin/env node
// =============================================================================
// module-map.mjs — Audit dependensi GLOBAL pada classic scripts (ASJ Portal)
// -----------------------------------------------------------------------------
//   1. Petakan fungsi global per file ("function xxx(", "const xxx = () =>",
//      "window.xxx =") tanpa menebak.
//   2. Cari siapa yang memanggil fungsi lintas file → batas modul yang aman.
//   3. Tandai kandidat dead code (didefinisikan tapi tidak pernah dipanggil).
//
// Mode:
//   node scripts/module-map.mjs              → frontend (js/*, api-client, i18n, pwa)
//   node scripts/module-map.mjs --backend    → backend (netlify/functions/_lib/*)
//   node scripts/module-map.mjs --json       → output penuh JSON (dipakai skrip/CI)
//
// Heuristik sederhana (regex), bukan parser: cukup akurat untuk keputusan
// refactor, tidak menjamin 100% — hasilnya diverifikasi dengan node --check
// + lint + test sebelum dianggap benar.
// =============================================================================

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// Daftar halaman untuk deteksi pemanggil HTML — satu sumber kebenaran:
// scripts/module-registry.mjs.
import { ALL_PAGES, MODAL_PARTIAL } from './module-registry.mts';

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const MODE = ARGS.has('--backend') ? 'backend' : 'frontend';
const WANT_JSON = ARGS.has('--json');

// ---------------------------------------------------------------------------
// Daftar file yang diaudit
// ---------------------------------------------------------------------------
function frontendFiles() {
  // Pindai js/ rekursif (termasuk subdirektori api/ sejak Fase 2).
  const jsDir = join(ROOT, 'js');
  const jsFiles = [];
  const walk = (d, prefix) => {
    for (const f of readdirSync(d).sort((a, b) => a.localeCompare(b))) {
      const abs = join(d, f);
      if (f.endsWith('.js') && !f.includes('.test.')) {
        jsFiles.push(`/js/${prefix}${f}`);
      } else if (!f.includes('.') && f !== 'node_modules') {
        walk(abs, prefix + f + '/');
      }
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

function backendFiles() {
  // Pindai _lib rekursif (termasuk subdirektori db/ sejak Fase 1.3).
  const dir = join(ROOT, 'netlify/functions/_lib');
  const out = [];
  const walk = (d, prefix) => {
    for (const f of readdirSync(d).sort((a, b) => a.localeCompare(b))) {
      const abs = join(d, f);
      if (f.endsWith('.js') && !f.includes('.test.')) {
        out.push({ rel: `netlify/functions/_lib/${prefix}${f}`, abs });
      } else if (!f.includes('.') && f !== 'node_modules') {
        walk(abs, prefix + f + '/');
      }
    }
  };
  walk(dir, '');
  return out;
}

// ---------------------------------------------------------------------------
// Ekstraksi simbol global (heuristik)
// ---------------------------------------------------------------------------
const RE_FUNC_DECL = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const RE_CONST_ARROW =
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?:=>|\{)/gm;
const RE_CONST_FUNC =
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/gm;
const RE_WINDOW = /window\.([A-Za-z_$][\w$]*)\s*=/g;
const RE_CALL = (name) => new RegExp(`\\b${name}\\s*\\(`, 'g');

function extractSymbols(src) {
  const out = new Set();
  for (const m of src.matchAll(RE_FUNC_DECL)) out.add(m[1]);
  for (const m of src.matchAll(RE_CONST_ARROW)) out.add(m[1]);
  for (const m of src.matchAll(RE_CONST_FUNC)) out.add(m[1]);
  for (const m of src.matchAll(RE_WINDOW)) out.add(m[1]);
  return out;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
const files = MODE === 'frontend' ? frontendFiles() : backendFiles();
const sources = new Map(files.map((f) => [f.rel, readFileSync(f.abs, 'utf8')]));

// Caller tambahan: HTML halaman (onclick="..." / inline script) supaya fungsi
// yang dipanggil dari markup TIDAK salah dianggap dead code.
const PAGES = [...ALL_PAGES, MODAL_PARTIAL];
if (MODE === 'frontend') {
  for (const p of PAGES) {
    const abs = join(ROOT, p);
    if (existsSync(abs)) sources.set(p, readFileSync(abs, 'utf8'));
  }
}

// Hanya file JS yang jadi sumber DEFINISI (HTML hanya untuk deteksi pemanggilan).
const jsFiles = new Set(files.map((f) => f.rel));
const defSources = new Map([...sources].filter(([rel]) => jsFiles.has(rel)));
const defined = new Map(); // name -> Set(file)
const called = new Map(); // name -> Set(file)

for (const [rel, src] of defSources) {
  for (const name of extractSymbols(src)) {
    if (!defined.has(name)) defined.set(name, new Set());
    defined.get(name).add(rel);
  }
}

for (const name of defined.keys()) {
  const re = RE_CALL(name);
  // Baris DEFINISI sebenarnya (bukan pemanggilan):
  //   function name( ...  |  const name = (args) =>  |  const name = function(
  // Jangan men-skip baris seperti `let x = getAi(k)` (itu pemanggilan).
  const defLineFunc = new RegExp(`^\\s*(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const defLineConst = new RegExp(
    `^\\s*(?:export\\s+)?(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>|\\([^)]*\\)\\s*\\{)`,
  );
  const callers = new Set();
  for (const [rel, src] of sources) {
    let found = false;
    re.lastIndex = 0;
    while (re.exec(src)) {
      const lineStart = src.lastIndexOf('\n', re.lastIndex - 1) + 1;
      const line = src.slice(lineStart, re.lastIndex);
      if (defLineFunc.test(line) || defLineConst.test(line)) continue;
      found = true;
      break;
    }
    if (found) callers.add(rel);
  }
  called.set(name, callers);
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
const nameList = [...defined.keys()].sort();
// Perbaiki definisi: fungsi yang didefinisikan DI HTML inline (jarang) — abaikan.
for (const n of nameList) {
  defined.set(n, new Set([...defined.get(n)].filter((f) => !PAGES.includes(f))));
}
const stats = files.map(({ rel }) => {
  const defs = nameList.filter((n) => defined.get(n).has(rel));
  const crossFile = defs.filter((n) => called.get(n).size > 0 && !called.get(n).has(rel));
  const localOnly = defs.filter((n) => called.get(n).size === 0 || called.get(n).has(rel));
  const calledBy = new Map();
  for (const n of defs) {
    for (const c of called.get(n)) {
      if (c === rel) continue;
      calledBy.set(c, (calledBy.get(c) || 0) + 1);
    }
  }
  return {
    file: rel,
    defined: defs.length,
    crossFile: crossFile.length,
    localOnly: localOnly.length,
    topCallers: [...calledBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
});

const crossFileNames = nameList.filter((n) => {
  const c = called.get(n);
  return c.size >= 2 && !c.has([...defined.get(n)][0]); // dipakai ≥2 file lain
});
const deadCandidates = nameList.filter((n) => called.get(n).size === 0);

const report = {
  mode: MODE,
  files: files.length,
  totalSymbols: nameList.length,
  perFile: stats.sort((a, b) => b.crossFile - a.crossFile),
  // "Kontrak global" — fungsi yang dipanggil dari ≥3 file lain (harus di-export saat ESM)
  sharedApi: crossFileNames
    .filter((n) => called.get(n).size >= 3)
    .map((n) => ({
      name: n,
      definedIn: [...defined.get(n)].join(', '),
      calledFrom: [...called.get(n)].sort().join(', '),
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  deadCandidates,
};

if (WANT_JSON) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log(
  `=== MODULE MAP [${MODE}] — ${files.length} file, ${nameList.length} simbol global ===\n`,
);
console.log('--- Per file (terbanyak cross-file dulu) ---');
for (const f of report.perFile) {
  console.log(
    `${f.file}: ${f.defined} definisi | ${f.crossFile} dipakai lintas file | ${f.localOnly} lokal/dead`,
  );
  if (f.topCallers.length) {
    console.log(`    dipanggil dari: ${f.topCallers.map(([f2, n]) => `${f2} (${n})`).join(', ')}`);
  }
}
console.log('\n--- KONTRAK GLOBAL (dipakai ≥3 file lain — wajib di-export saat ESM) ---');
for (const s of report.sharedApi) {
  console.log(`${s.name}  [def: ${s.definedIn}]`);
  console.log(`    -> dipakai: ${s.calledFrom}`);
}
console.log(
  `\n--- Kandidat DEAD CODE (didefinisikan, tidak pernah dipanggil) — ${report.deadCandidates.length} ---`,
);
if (report.deadCandidates.length) console.log(report.deadCandidates.join(', '));
else console.log('(tidak ada)');
console.log('\nCatatan: heuristik regex — verifikasi dengan node --check + lint sebelum refactor.');
