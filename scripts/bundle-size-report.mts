// =============================================================================
// bundle-size-report.mjs — laporan ukuran per-modul bundel admin/index
// -----------------------------------------------------------------------------
// Jalankan build esbuild yang SAMA dengan build-js.mjs (entry js/main.js,
// bundle, iife, minify, treeShaking:false) dengan metafile:true, lalu:
//   1. Cetak top-N modul terbesar (byte minified per modul, % dari bundel)
//   2. Tulis laporan lengkap ke .freebuff/bundle-size-report.md (gitignored)
//      + ringkasan konsol.
// Kegunaan: menemukan kandidat lazy-load (modul besar yang jarang dipakai,
// mis. ai_copilot, admin_ops, 10_cv_rirekisho, helper vendor).
// Jalankan: bun run bundle:size
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
import { posix } from 'node:path';
import { bundleModules } from './module-registry.mts';

const ROOT = process.cwd();
const MODULES = bundleModules();
for (const src of MODULES) {
  if (!existsSync(ROOT + src)) throw new Error(`File tidak ada: ${src}`);
}

const result = await build({
  entryPoints: [`${ROOT}/js/main.js`],
  bundle: true,
  format: 'iife',
  treeShaking: false,
  minify: true,
  logLevel: 'silent',
  metafile: true,
  write: false,
});

const metafile = result.metafile;
const outName = Object.keys(metafile.outputs)[0];
const out = metafile.outputs[outName];
const total = out.bytes;
const rows = Object.entries(out.inputs)
  .map(([abs, { bytesInOutput }]) => {
    const rel = abs.startsWith(ROOT) ? posix.relative(ROOT, abs).split('\\').join('/') : abs;
    return { rel, bytes: bytesInOutput };
  })
  .sort((a, b) => b.bytes - a.bytes);

const pct = (b) => ((b / total) * 100).toFixed(2) + '%';
const kb = (b) => (b / 1024).toFixed(1) + ' KB';
const topN = Math.min(30, rows.length);

console.log(`\nBundel: ${total.toLocaleString()} B (${kb(total)}) — ${rows.length} modul input\n`);
console.log(`Top ${topN} modul terbesar (minified):`);
console.log('─'.repeat(78));
let acc = 0;
for (const r of rows.slice(0, topN)) {
  acc += r.bytes;
  console.log(`  ${String(pct(r.bytes)).padStart(6)}  ${kb(r.bytes).padStart(10)}  ${r.rel}`);
}
console.log('─'.repeat(78));
console.log(`  ${pct(acc)} dari total dipegang ${topN} modul teratas (${kb(acc)})\n`);

// Laporan lengkap (markdown) ke .freebuff/ — gitignored, regenerable.
const md = [
  '# Laporan ukuran bundel app (per modul)',
  '',
  `- Bundel total: **${kb(total)}** (${total.toLocaleString()} B, minified, iife)`,
  `- Modul input: ${rows.length} (dari import eksplisit \`js/main.js\` — Fase 6)`,
  `- Di-generate: \`bun run bundle:size\` (esbuild metafile)`,
  '',
  '## Top 30 modul terbesar',
  '',
  '| % | Ukuran | Modul |',
  '|---|--------|-------|',
  ...rows.slice(0, 30).map((r) => `| ${pct(r.bytes)} | ${kb(r.bytes)} | \`${r.rel}\` |`),
  '',
  '## Semua modul (urut ukuran)',
  '',
  ...rows.map((r) => `| ${pct(r.bytes)} | ${kb(r.bytes)} | \`${r.rel}\` |`),
  '',
].join('\n');
writeFileSync(`${ROOT}/.freebuff/bundle-size-report.md`, md);
console.log('Laporan lengkap: .freebuff/bundle-size-report.md\n');
