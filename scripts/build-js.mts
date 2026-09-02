// =============================================================================
// build-js.mjs — Bundel JS aplikasi (ASJ Portal)
// -----------------------------------------------------------------------------
// admin.html & index.html memuat bundel 1 file dari ENTRY js/main.ts yang
// meng-import SEMUA modul domain (daftar modul = bundleModules di
// module-registry — diturunkan dari import js/main.ts, Fase 6). Skrip ini:
//   1. Bundle + minify (esbuild, entry js/main.ts → IIFE) jadi assets/app-<hash>.js
//   2. Mengganti tag <script> bundel di admin.html & index.html (atau mengganti
//      bundel lama kalau hash berubah)
//   3. Menghapus stub Vite mati (assets/*-DONYcaRI.js) dari SEMUA halaman
//   4. Memperbarui sw.js (SHELL + VERSION) supaya service worker ikut bundel
//   5. Membersihkan assets/app-*.js lama (hanya bundel terbaru yang bertahan)
//
// Idempotent: aman dijalankan berkali-kali.
// Jalankan: bun run build:js   (wajib setelah mengubah file di js/, api-client,
// i18n, atau pwa — lihat WORKFLOW.md)
// =============================================================================

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  existsSync,
  statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
// Struktur modul (daftar modul bundel + daftar halaman) — satu sumber
// kebenaran: scripts/module-registry.mjs. Fase 6: daftar modul bundel
// diturunkan dari import eksplisit js/main.ts (bundleModules), bukan STACK
// concat yang bisa melenceng dari entry asli.
import { bundleModules, STANDALONE_PAGES } from './module-registry.mts';
import { buildServiceWorkerFcmHandlers } from '../src/sw-fcm-notification.js';

const ROOT = process.cwd();

const PAGES = STANDALONE_PAGES;

// 1. Bundle semua modul via entry js/main.ts (esbuild bundle mode → IIFE).
//    - treeShaking:false — import side-effect + alias window.* wajib dipertahankan
//      (bundle mode dengan tree-shake RENAME/membuang simbol & mematahkan
//      referensi global — eksperimen Fase 3 langkah 1).
//    - minify:true — hasil tetap 1 file terkompres seperti era concat.
//    - Semua file sudah ESM (Fase 3 tuntas langkah 13): tidak ada lagi concat
//      classic / ESM_CORE — entry meng-import modul, esbuild menjaga scope tiap
//      modul tetap privat, alias window.* dijalankan oleh modul itu sendiri.
// Validasi dulu: semua modul yang di-import js/main.ts harus ada.
const MODULES = bundleModules();
for (const src of MODULES) {
  if (!existsSync(ROOT + src)) {
    console.error(`[build-js] File tidak ada: ${src}`);
    process.exit(1);
  }
}
// Pass 1 — kode + hash (write:false, tanpa sourcemap — perilaku lama).
const result = await build({
  entryPoints: [`${ROOT}/js/main.ts`],
  bundle: true,
  format: 'iife',
  treeShaking: false,
  minify: true,
  logLevel: 'silent',
  write: false,
  loader: { '.ts': 'ts' },
});
const code = result.outputFiles[0].text;
const hash = createHash('sha1').update(code).digest('hex').slice(0, 10);
const bundleName = `app-${hash}.js`;
const bundlePath = `${ROOT}/assets/${bundleName}`;

// Pass 2 — tulis bundel + sourcemap EXTERNAL (Fase 6 2026-08-18). sourcemap
// 'linked' butuh output path (esbuild menolak external map dengan write:false),
// jadi pass 2 memakai write:true + outfile; esbuild menyisipkan komentar
// sourceMappingURL sendiri. .map tidak di-precache SW — hanya untuk DevTools.
await build({
  entryPoints: [`${ROOT}/js/main.ts`],
  bundle: true,
  format: 'iife',
  treeShaking: false,
  minify: true,
  sourcemap: 'linked',
  outfile: bundlePath,
  logLevel: 'silent',
  loader: { '.ts': 'ts' },
});
const writtenSize = statSync(bundlePath).size;
const mapSize = existsSync(`${bundlePath}.map`) ? statSync(`${bundlePath}.map`).size : 0;
console.log(
  `[build-js] Bundel: assets/${bundleName} (${(writtenSize / 1024).toFixed(1)} KB, ${MODULES.length} modul via js/main.ts)` +
    (mapSize ? ` · sourcemap ${(mapSize / 1024).toFixed(1)} KB` : ''),
);

// 1a-extra. Pre-build shared modules (bridge.js, cloudinary.js) as standalone ESM.
//     Standalone pages + upload-guard + apply-docs + pwa all bundle bridge+api-client+i18n
//     independently, causing ~90KB duplication per page. By pre-building bridge.js and
//     cloudinary.js as self-contained ESM files, we can mark them as external in standalone
//     builds — the browser loads them once (cached by URL), saving ~30KB per page load.
const SHARED_MODULES = [
  { entry: `${ROOT}/js/core/bridge.ts`, out: `${ROOT}/js/core/bridge.js` },
  { entry: `${ROOT}/js/cloudinary.ts`, out: `${ROOT}/js/cloudinary.js` },
];
for (const { entry, out } of SHARED_MODULES) {
  if (!existsSync(entry)) {
    console.warn(`[build-js] Shared module not found: ${entry}, skip`);
    continue;
  }
  try {
    await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      minify: true,
      outfile: out,
      logLevel: 'error',
      loader: { '.ts': 'ts' },
    });
  } catch (err) {
    console.error(`[build-js] Shared module gagal: ${entry} — ${err.message}`);
    process.exit(1);
  }
}
console.log(`[build-js] Shared modules (bridge.js + cloudinary.js): pre-built ✅`);

// esbuild plugin: rewrite .ts imports → .js + mark as external.
// Standalone pages import bridge.ts/cloudinary.ts with relative paths.
// The browser can resolve .js natively but not .ts, so we rewrite the
// extension AND mark them external so esbuild doesn't inline them.
const externalizeSharedDeps = {
  name: 'externalize-shared-deps',
  setup(buildPlugin) {
    // Track entry points so we don't mark them external
    const entryAbsPaths = new Set();
    buildPlugin.onResolve({ filter: /^$/, namespace: 'file' }, (args) => {
      if (args.path) entryAbsPaths.add(args.path);
      return undefined;
    });
    buildPlugin.onResolve({ filter: /.ts$/ }, (args) => {
      // Don't externalize entry points
      if (entryAbsPaths.has(args.path) || args.kind === 'entry-point') return undefined;
      // Only externalize specific shared modules
      if (args.path.endsWith('/bridge.ts') || args.path.endsWith('/cloudinary.ts')) {
        return { path: args.path.replace(/\.ts$/, '.js'), external: true };
      }
      return undefined;
    });
    // Handle extensionless imports (pwa.ts uses './js/core/bridge' without .ts)
    buildPlugin.onResolve({ filter: /bridge$/ }, (args) => {
      if (!args.path.endsWith('.ts') && !args.path.endsWith('.js')) {
        return { path: args.path + '.js', external: true };
      }
      return null;
    });
  },
};

// 1b. Compile standalone page .ts → .js (ai_form, master_full, share, apply_full, siswa_baru).
//     Standalone pages load <script type="module" src="/js/pages/xxx.js"> tapi
//     hanya .ts yang ada di disk (rename TS migration). Dev server (serve-static)
//     transpile on-the-fly, tapi Netlify serve static langsung → 404 tanpa step ini.
//     esbuild bundle + transpile: resolve semua import (bridge, cloudinary, api-client, i18n)
//     jadi 1 file .js per halaman (ESM, karena type=module).
const STANDALONE_TS_MAP = {
  'ai_form.html': `${ROOT}/js/pages/ai_form.ts`,
  'master-full.html': `${ROOT}/js/pages/master_full.ts`,
  'share.html': `${ROOT}/js/pages/share.ts`,
  'apply-full.html': `${ROOT}/js/pages/apply_full.ts`,
  'siswa-baru.html': `${ROOT}/js/pages/siswa_baru.ts`,
};
let standaloneCount = 0;
for (const [htmlPage, tsEntry] of Object.entries(STANDALONE_TS_MAP)) {
  const outJs = tsEntry.replace(/\.ts$/, '.js');
  if (!existsSync(tsEntry)) {
    console.warn(`[build-js] Standalone: ${tsEntry} tidak ditemukan, skip`);
    continue;
  }
  try {
    await build({
      entryPoints: [tsEntry],
      bundle: true,
      format: 'esm',
      minify: true,
      outfile: outJs,
      logLevel: 'error',
      loader: { '.ts': 'ts' },
      plugins: [externalizeSharedDeps],
    });
    standaloneCount++;
  } catch (err) {
    console.error(`[build-js] Standalone gagal: ${htmlPage} — ${err.message}`);
    process.exit(1);
  }
}
console.log(`[build-js] Standalone pages: ${standaloneCount} file .ts → .js ✅`);

// 1c. Compile shared standalone modules .ts → .js (upload-guard, apply-docs, pwa).
//     Dipakai sebagai <script type="module"> terpisah oleh halaman standalone.
const SHARED_STANDALONE_MODULES = [
  `${ROOT}/js/upload-guard.ts`,
  `${ROOT}/js/apply-docs.ts`,
  `${ROOT}/pwa.ts`,
];
let sharedCount = 0;
for (const tsFile of SHARED_STANDALONE_MODULES) {
  const outJs = tsFile.replace(/\.ts$/, '.js');
  if (!existsSync(tsFile)) {
    console.warn(`[build-js] Shared module: ${tsFile} tidak ditemukan, skip`);
    continue;
  }
  try {
    await build({
      entryPoints: [tsFile],
      bundle: true,
      format: 'esm',
      minify: true,
      outfile: outJs,
      logLevel: 'error',
      loader: { '.ts': 'ts' },
      plugins: [externalizeSharedDeps],
    });
    sharedCount++;
  } catch (err) {
    console.error(`[build-js] Shared module gagal: ${tsFile} — ${err.message}`);
    process.exit(1);
  }
}
console.log(`[build-js] Shared standalone modules: ${sharedCount} file .ts → .js ✅`);
// 2. admin.html & index.html: stack 20 tag -> 1 tag bundel (idempotent, dan
//    mengganti bundel lama kalau hash berubah).
const stackRe =
  /<script src="\/api-client\.js[^"]*"><\/script>[\s\S]*?<script src="\/pwa\.js[^"]*"><\/script>\s*/;
const bundleTag = `<script src="/assets/${bundleName}"></script>\n`;
const oldBundleRe = /<script src="\/assets\/app-[a-zA-Z0-9]+\.js"><\/script>\s*/;
const stubRe = /<script type="module"[^>]*src="\/assets\/[^"]*DONYcaRI\.js"[^>]*><\/script>\s*/g;
const preloadRe = /<link rel="modulepreload"[^>]*href="\/assets\/main-DEfa6N4x\.js"[^>]*>\s*/g;
for (const page of ['admin.html', 'index.html']) {
  const path = `${ROOT}/${page}`;
  let html = readFileSync(path, 'utf8');
  if (stackRe.test(html)) {
    // Belum pernah di-bundle: ganti stack 20 tag -> 1 bundel.
    html = html.replace(stackRe, bundleTag);
    console.log(`[build-js] ${page}: 20 tag -> 1 bundel`);
  } else if (oldBundleRe.test(html)) {
    // Sudah di-bundle dengan hash lama: ganti ke hash terbaru.
    html = html.replace(oldBundleRe, bundleTag);
    console.log(`[build-js] ${page}: bundel lama -> ${bundleName}`);
  } else if (html.includes(`/assets/${bundleName}`)) {
    console.log(`[build-js] ${page}: sudah pakai bundel ini (idempotent)`);
  } else {
    console.error(`[build-js] Gagal: ${page} tidak punya stack 20-tag maupun bundel.`);
    process.exit(1);
  }
  // 2b. Update anti-cache version in HTML to match bundle name.
  //     Prevents infinite reload loops when bundle hash changes.
  html = html.replace(/var E=\"app-[a-z0-9]+\"/g, 'var E=\"' + bundleName.replace('.js', '') + '\"');

  const cleaned = html.replace(stubRe, '').replace(preloadRe, '');
  if (cleaned !== html) {
    writeFileSync(path, cleaned);
    console.log(`[build-js] ${page}: artefak Vite mati dihapus`);
  } else {
    writeFileSync(path, html);
  }
}

// 3. Hapus stub Vite mati (script + modulepreload) dari halaman lain + bersihkan file-nya.
for (const page of PAGES) {
  const path = `${ROOT}/${page}`;
  const html = readFileSync(path, 'utf8');
  const cleaned = html.replace(stubRe, '').replace(preloadRe, '');
  if (cleaned !== html) {
    writeFileSync(path, cleaned);
    console.log(`[build-js] ${page}: artefak Vite mati dihapus`);
  }
}
for (const f of readdirSync(`${ROOT}/assets`)) {
  if (f.endsWith('-DONYcaRI.js') || f === 'main-DEfa6N4x.js') {
    unlinkSync(`${ROOT}/assets/${f}`);
    console.log(`[build-js] Hapus artefak mati: assets/${f}`);
  }
}

// 4. sw.js: SHELL pakai bundel + VERSION baru + bersihkan path mati (idempotent).
const swPath = `${ROOT}/sw.js`;
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/^\s*'\/(api-client|i18n|js\/)[^']*',\n/gm, '');
sw = sw.replace(/^\s*'\/assets\/app-[a-z0-9]+\.js',\n/gm, '');
sw = sw.replace(/^\s*'\/src\/main\.js',\n/gm, '');
sw = sw.replace(/^\s*'\/src\/styles\/main\.css',\n/gm, '');

// Ganti handler onBackgroundMessage
const fcmHandlerStr = buildServiceWorkerFcmHandlers();
const handlerRegionRe =
  /\/\/ FCM_NOTIFICATION_HANDLER_START[\s\S]*?\/\/ FCM_NOTIFICATION_HANDLER_END/;
if (handlerRegionRe.test(sw)) {
  sw = sw.replace(handlerRegionRe, fcmHandlerStr);
} else {
  // Kalau belum ada markernya, ganti block lama
  const oldHandlerRe = /messaging\.onBackgroundMessage\([\s\S]*?\}\);/;
  if (oldHandlerRe.test(sw)) {
    sw = sw.replace(oldHandlerRe, fcmHandlerStr);
  }
}

if (!sw.includes(`'/assets/${bundleName}',`)) {
  sw = sw.replace("  '/siswa-baru.html',\n", `  '/siswa-baru.html',\n  '/assets/${bundleName}',\n`);
  console.log(`[build-js] sw.js: SHELL -> /assets/${bundleName}`);
}
// Modal shared dimuat runtime dari assets/modals-shared.html (lihat build-html).
if (!sw.includes(`'/assets/modals-shared.html',`)) {
  sw = sw.replace(
    `  '/assets/${bundleName}',\n`,
    `  '/assets/${bundleName}',\n  '/assets/modals-shared.html',\n`,
  );
  console.log('[build-js] sw.js: SHELL -> /assets/modals-shared.html');
}
// JP locale lazy-loaded dari assets/jp-locale.js (i18n lazy-load).
if (!sw.includes("'/assets/jp-locale.js',")) {
  sw = sw.replace(
    `  '/assets/modals-shared.html',\n`,
    `  '/assets/modals-shared.html',\n  '/assets/jp-locale.js',\n`,
  );
  console.log('[build-js] sw.js: SHELL -> /assets/jp-locale.js');
}
// VERSION ikut hash modals supaya SW refresh saat partial berubah (tanpa ubah JS).
// Hash dihitung atas konten ternormalisasi LF: dengan core.autocrlf=true (Windows)
// working-tree berbentuk CRLF, sha1 byte mentah beda dari blob LF di repo —
// membuat VERSION (dan git status sw.js) berubah tiap build tanpa perubahan konten.
let modHash = '';
const modPath = `${ROOT}/assets/modals-shared.html`;
if (existsSync(modPath)) {
  const modContent = readFileSync(modPath, 'utf8').replace(/\r\n/g, '\n');
  modHash = '-m' + createHash('sha1').update(modContent).digest('hex').slice(0, 8);
}
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = 'asj-portal-app-${hash}${modHash}';`);
writeFileSync(swPath, sw);
console.log(`[build-js] sw.js: VERSION asj-portal-app-${hash}${modHash}`);

// 5. Hapus bundel lama (assets/app-*.js + sourcemap-nya, selain yang baru).
for (const f of readdirSync(`${ROOT}/assets`)) {
  if (/^app-[a-z0-9]+\.js$/.test(f) && f !== bundleName) {
    unlinkSync(`${ROOT}/assets/${f}`);
    console.log(`[build-js] Hapus bundel lama: assets/${f}`);
  }
  if (/^app-[a-z0-9]+\.js\.map$/.test(f) && f !== `${bundleName}.map`) {
    unlinkSync(`${ROOT}/assets/${f}`);
    console.log(`[build-js] Hapus sourcemap lama: assets/${f}`);
  }
}

console.log('[build-js] Selesai ✅');
