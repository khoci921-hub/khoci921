// =============================================================================
// migrate-filecv-drive.mjs — Sambungkan kolom file_cv kandidat ke URL file
// CV yang benar-benar ada di Supabase Storage master/<NAMA>/. Mencakup
// kandidat yang file_cv-nya masih link Google Drive (data legacy era GAS)
// ATAU masih kosong — dua-duanya bikin tombol CV tidak menampilkan file.
//   bun run scripts/migrate-filecv-drive.mjs           # dry-run (default)
//   bun run scripts/migrate-filecv-drive.mjs --apply   # backup JSON + PATCH
//
// Sumber URL baru (prioritas):
//   1. master_database_candidate.file_cv — kalau sudah URL Storage yang ada
//   2. file CV TERBARU di folder master/<NAMA>/ (CVFILE_…, "1. NAMA_CV.xlsx",
//      RIREKI…, dst.) — terbaru = updated_at storage, fallback timestamp di
//      nama file.
// Kandidat tanpa file CV di Storage → ditandai "TANPA CV" (tidak diubah).
// =============================================================================
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { supabaseKey, supabaseUrl } = require('../netlify/functions/_lib/db/client');

const APPLY = process.argv.includes('--apply');
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'asj-files';
const BASE = supabaseUrl().replace(/\/$/, '');
const KEY = supabaseKey();
if (!BASE || !KEY) {
  console.error('Supabase belum dikonfigurasi (cek .env.local / Keys).');
  process.exit(1);
}

const normWa = (w) => String(w || '').replace(/\D/g, '');
const isDrive = (u) => /drive\.google\.com|docs\.google\.com/i.test(String(u || ''));
const isEmptyCv = (u) => !u || String(u).trim() === '' || String(u).trim() === '-';
const pubUrl = (storagePath) =>
  BASE +
  '/storage/v1/object/public/' +
  BUCKET +
  '/' +
  storagePath.split('/').map(encodeURIComponent).join('/');

async function getTable(name, select, order) {
  const out = [];
  let offset = 0;
  const LIMIT = 1000;
  for (;;) {
    const res = await fetch(
      `${BASE}/rest/v1/${name}?select=${select}&order=${order}&limit=${LIMIT}&offset=${offset}`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
    );
    if (!res.ok)
      throw new Error(name + ' → HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    offset += batch.length;
    if (batch.length < LIMIT) break;
  }
  return out;
}

async function listPrefix(prefix) {
  const out = [];
  let offset = 0;
  const LIMIT = 200;
  for (;;) {
    const res = await fetch(`${BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: LIMIT, offset }),
    });
    if (!res.ok) return [];
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    offset += batch.length;
    if (batch.length < LIMIT) break;
  }
  return out;
}

// Deteksi file CV: nama mengandung CV/RIREKI/履歴/RESUME dan bukan dokumen lain
// (TTD/foto/KK/KTP/ijazah/paspor/SIM).
const isCvLike = (name) =>
  /CV|RIREKI|RIRIKISHO|履歴|RESUME|DAFTAR_RIWAYAT/i.test(name) &&
  !/TTD|SIGN|TANDA|PAS_PHOTO|PHOTOFILE|FOTO|KK_|KTP_|IJAZAH|AKTE|PASSPORT|SIM_|PAS_FOTO/i.test(
    name,
  );

// Usia relatif file: preferensi updated_at storage, fallback timestamp nama.
function fileAge(order) {
  const ts = Number(String(order.name).match(/_(\d{13})\./)?.[1] || 0);
  const up = order.updated_at ? new Date(order.updated_at).getTime() : 0;
  return { ts, up };
}
function isNewer(a, b) {
  const A = fileAge(a);
  const B = fileAge(b);
  if (A.up !== B.up) return A.up > B.up;
  return A.ts > B.ts;
}

console.log('Membaca kandidat & master ...');
const candidates = await getTable(
  'database_candidate',
  'id,id_kandidat,nama_lengkap,no_wa,file_cv',
  'id',
);
const masters = await getTable('master_database_candidate', 'id,id_kandidat,no_wa,file_cv', 'id');
const masterByWa = new Map();
for (const m of masters) {
  const w = normWa(m.no_wa);
  if (w && !masterByWa.has(w)) masterByWa.set(w, m);
}
const masterByIdKand = new Map();
for (const m of masters) {
  if (m.id_kandidat && !masterByIdKand.has(String(m.id_kandidat)))
    masterByIdKand.set(String(m.id_kandidat), m);
}

const targetCands = candidates.filter((c) => isDrive(c.file_cv) || isEmptyCv(c.file_cv));
const nDrive = targetCands.filter((c) => isDrive(c.file_cv)).length;
const nKosong = targetCands.filter((c) => isEmptyCv(c.file_cv)).length;
console.log(
  'Kandidat file_cv link Drive:',
  nDrive,
  '| file_cv kosong:',
  nKosong,
  '| total target:',
  targetCands.length,
  'dari',
  candidates.length,
  '\n',
);

const results = [];
for (const c of targetCands) {
  const nama = String(c.nama_lengkap || '').trim();
  const baseName = nama.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  const folders = [
    ...new Set([
      'master/' + baseName + '/',
      'master/' + nama.toUpperCase().replace(/\s+/g, '_') + '/',
    ]),
  ];
  let names = [];
  for (const f of folders) {
    const items = await listPrefix(f);
    if (items.some((o) => o.id !== null)) {
      names = items.filter((o) => o.id !== null);
      break;
    }
  }
  // Prioritas 1: file_cv master yang sudah URL Storage
  const master = masterByWa.get(normWa(c.no_wa)) || masterByIdKand.get(String(c.id_kandidat || ''));
  let baru = null;
  if (master && master.file_cv && master.file_cv.includes('/object/public/')) baru = master.file_cv;
  // Prioritas 2: file CV terbaru di folder
  if (!baru) {
    const cvFiles = names.filter((o) => isCvLike(o.name)).sort((a, b) => (isNewer(a, b) ? -1 : 1));
    if (cvFiles.length) baru = pubUrl(folders[0].replace(/\/$/, '') + '/' + cvFiles[0].name);
  }
  results.push({
    id: c.id,
    id_kandidat: c.id_kandidat,
    nama: c.nama_lengkap,
    wa: c.no_wa,
    lama: c.file_cv,
    lamaTipe: isDrive(c.file_cv) ? 'DRIVE' : isEmptyCv(c.file_cv) ? 'KOSONG' : '?',
    baru,
    folderFiles: names.map((n) => n.name),
  });
}

const withFix = results.filter((r) => r.baru);
const noFix = results.filter((r) => !r.baru);
console.log('================ HASIL DRY-RUN ================');
console.log('akan dimigrasi :', withFix.length);
console.log('TANPA CV       :', noFix.length);
for (const r of results) {
  if (r.baru) {
    console.log(`  [${r.id}] ${r.nama} (${r.wa}) [${r.lamaTipe}]`);
    console.log(`      lama: ${r.lama ? r.lama.slice(0, 70) : '(kosong)'}`);
    console.log(`      baru: ${r.baru.slice(0, 100)}`);
  } else {
    console.log(
      `  [${r.id}] ${r.nama} (${r.wa}) → TANPA CV (folder: ${r.folderFiles.slice(0, 3).join(', ') || 'kosong'})`,
    );
  }
}

if (APPLY) {
  if (!withFix.length) {
    console.log('\nTidak ada yang perlu dimigrasi.');
    process.exit(0);
  }
  const stamp = new Date().toISOString();
  const backupPath = path.resolve(
    fileURLToPath(import.meta.url),
    '../../.freebuff/filecv-migrate-backup-' + stamp.replace(/[:.]/g, '-') + '.json',
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      withFix.map((r) => ({ id: r.id, nama: r.nama, wa: r.wa, lama: r.lama, baru: r.baru })),
      null,
      2,
    ),
  );
  console.log('\nBackup ->', backupPath);

  let n = 0;
  for (const r of withFix) {
    const res = await fetch(`${BASE}/rest/v1/database_candidate?id=eq.${r.id}`, {
      method: 'PATCH',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ file_cv: r.baru }),
    });
    if (!res.ok) {
      console.error(
        '  GAGAL id=' + r.id + ' → HTTP ' + res.status + ' ' + (await res.text()).slice(0, 150),
      );
      continue;
    }
    n++;
    console.log('  OK id=' + r.id + ' (' + r.nama + ')');
  }
  console.log('\nDimigrasi:', n, 'dari', withFix.length);
} else {
  console.log('\n(dry-run — jalankan dengan --apply untuk migrasi; backup otomatis dibuat dulu)');
}
