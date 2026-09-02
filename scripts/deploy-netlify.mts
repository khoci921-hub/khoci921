// @ts-nocheck
// =============================================================
// scripts/deploy-netlify.mjs — DEPLOY NETLIFY SATU PERINTAH 🚀
// -------------------------------------------------------------
// Otomatis menjalankan seluruh pipeline deploy ke Netlify:
//   1. clean install  (rm -rf node_modules && bun install)
//   2. build lengkap  (bun run build = check:globals + css + html + js)
//   3. patch nodejs-compile-cache  (bug Bun: module.enableCompileCache()
//      mengembalikan null → destructure { directory } crash di netlify-cli)
//   4. deploy prod    (netlify-cli deploy --prod --dir . --site <id>)
//   5. verifikasi live (homepage 200 + getAppData jobs + bundle terbaru)
//
// Pemakaian:
//   NETLIFY_AUTH_TOKEN=<token> bun scripts/deploy-netlify.mjs
//
// Override opsional (env):
//   NETLIFY_SITE_ID    (default: id site asjportal-379)
//   NETLIFY_SITE_URL   (default: https://asjportal-379.netlify.app)
//   SKIP_INSTALL=1     (lewati clean install)
//   SKIP_BUILD=1       (lewati build)
//   SKIP_VERIFY=1      (lewati verifikasi live)
//
// Wajib: NETLIFY_AUTH_TOKEN (DEPLOY.md §2 — izin eksplisit pemilik).
// =============================================================
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SITE_ID = process.env.NETLIFY_SITE_ID || '7e433a31-82cd-4afb-8d1b-f0391cabdd3e';
const SITE_URL = (process.env.NETLIFY_SITE_URL || 'https://asjportal.netlify.app').replace(
  /\/$/,
  '',
);
const TOKEN = process.env.NETLIFY_AUTH_TOKEN || '';

const step = (msg) => console.log(`\n── ${msg} ──`);

// -------------------------------------------------------------
// 0. Prasyarat
// -------------------------------------------------------------
if (!TOKEN) {
  console.error('❌ NETLIFY_AUTH_TOKEN wajib diisi (DEPLOY.md §2 — izin pemilik).');
  process.exit(1);
}

// -------------------------------------------------------------
// 1. Clean install
// -------------------------------------------------------------
if (!process.env.SKIP_INSTALL) {
  step('1/5 Clean install (rm -rf node_modules && bun install)');
  if (existsSync(resolve(ROOT, 'node_modules')))
    rmSync(resolve(ROOT, 'node_modules'), { recursive: true, force: true });
  execSync('bun install', { cwd: ROOT, stdio: 'inherit', shell: true });
} else {
  console.log('  (SKIP_INSTALL=1 — lewati clean install)');
}

// -------------------------------------------------------------
// 2. Build lengkap
// -------------------------------------------------------------
if (!process.env.SKIP_BUILD) {
  step('2/5 Build (bun run build = globals + css + html + js)');
  execSync('bun run build', { cwd: ROOT, stdio: 'inherit', shell: true });
} else {
  console.log('  (SKIP_BUILD=1 — lewati build)');
}

// -------------------------------------------------------------
// 3. Patch nodejs-compile-cache (bug Bun di netlify-cli)
// -------------------------------------------------------------
{
  step('3/5 Patch nodejs-compile-cache.js (Bun: enableCompileCache() null)');
  const file = resolve(ROOT, 'node_modules/netlify-cli/dist/utils/nodejs-compile-cache.js');
  if (!existsSync(file)) {
    console.error('  ❌ netlify-cli belum terpasang — jalankan bun install dulu.');
    process.exit(1);
  }
  const src = readFileSync(file, 'utf8');
  const oldLine = 'const { directory } = module.enableCompileCache();';
  const newLine =
    'const compileCache = module.enableCompileCache();\n        const directory = compileCache && compileCache.directory;';
  if (src.includes(oldLine)) {
    writeFileSync(file, src.replace(oldLine, newLine));
    console.log('  ✅ patch diterapkan');
  } else if (src.includes(newLine)) {
    console.log('  ⏭  sudah ter-patch');
  } else {
    console.warn(
      '  ⚠ pola compile-cache tidak ditemukan (versi netlify-cli berubah?) — lanjut, deploy mungkin tetap jalan.',
    );
  }
}

// -------------------------------------------------------------
// 4. Deploy prod
// -------------------------------------------------------------
{
  step(`4/5 Deploy prod → site ${SITE_ID}`);
  try {
    execSync(`bun run netlify deploy --prod --dir . --site ${SITE_ID}`, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NETLIFY_AUTH_TOKEN: TOKEN },
      timeout: 600_000, // 10 menit — upload repo besar butuh waktu
    });
  } catch (e) {
    // CLI bisa ke-kill oleh timeout padahal upload sudah selesai (lihat deploy 2026-08-17).
    console.warn(
      '  ⚠ perintah deploy exit non-0. Lanjut verifikasi live — kalau sudah terbaru, deploy sukses.',
    );
  }
}

// -------------------------------------------------------------
// 5. Verifikasi live
// -------------------------------------------------------------
if (!process.env.SKIP_VERIFY) {
  step(`5/5 Verifikasi live → ${SITE_URL}`);
  const ok = [];
  const fail = [];

  // 5a. Homepage 200
  try {
    const r = await fetch(SITE_URL + '/');
    if (r.status === 200) ok.push('homepage 200');
    else fail.push(`homepage ${r.status}`);
  } catch (e) {
    fail.push('homepage: ' + e.message);
  }

  // 5b. Bundle terbaru (dari index.html di repo) sudah live
  try {
    const local = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const m = local.match(/assets\/(app-[a-z0-9]+\.js)/);
    const bundle = m ? m[1] : null;
    if (bundle) {
      const r = await fetch(SITE_URL + '/assets/' + bundle);
      if (r.status === 200) ok.push(`bundle ${bundle} live`);
      else fail.push(`bundle ${bundle} → ${r.status}`);
    }
  } catch (e) {
    fail.push('bundle check: ' + e.message);
  }

  // 5c. getAppData → jobs ada
  try {
    const r = await fetch(SITE_URL + '/.netlify/functions/get-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAppData', payload: [] }),
    });
    const j = await r.json();
    if (j.success === true && Array.isArray(j.jobs) && j.jobs.length > 0)
      ok.push(`getAppData jobs=${j.jobs.length}`);
    else fail.push('getAppData tidak return jobs');
  } catch (e) {
    fail.push('getAppData: ' + e.message);
  }

  console.log('\nHasil verifikasi:');
  ok.forEach((s) => console.log('  ✅ ' + s));
  fail.forEach((s) => console.log('  ❌ ' + s));

  if (fail.length > 0) {
    console.error(
      '\n❌ VERIFIKASI GAGAL — deploy mungkin belum sempurna. Cek manual di dashboard Netlify.',
    );
    process.exit(1);
  }
} else {
  console.log('  (SKIP_VERIFY=1 — lewati verifikasi)');
}

console.log('\n🎉 Deploy selesai! Jangan lupa catat di DEPLOY.md §4 (tanggal + izin + catatan).');
