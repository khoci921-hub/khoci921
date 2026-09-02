// @ts-nocheck
// =============================================================================
// audit-pasphoto.mjs — Audit kolom berkas kandidat (database_candidate) yang
// menunjuk file yang TIDAK ADA di Supabase Storage (mis. PAS_PHOTO.jpg
// terhapus, atau path basi dari alur lama), lalu perbaiki massal ke nilai
// master yang benar.
//   bun run scripts/audit-pasphoto.mjs           # dry-run (default)
//   bun run scripts/audit-pasphoto.mjs --apply   # backup JSON + PATCH
//
// Kolom yang diaudit: pas_photo, file_cv, jft, ssw.
// Aturan perbaikan: kalau nilai kandidat 404, pakai nilai dari baris master
// (master_database_candidate, dicocokkan via no_wa / id_kandidat) untuk kolom
// sejenis (pas_photo→pas_photo, file_cv→file_cv, jft→jft_url, ssw→ssw_url)
// yang file-nya benar-benar ada di Storage. Tanpa pengganti → ditandai
// "TANPA PENGGANTI" (tidak diubah).
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

// Kolom yang diaudit: [kolom kandidat, kolom master sejenis, label].
const COLS = [
  { cand: 'pas_photo', master: 'pas_photo', label: 'PAS FOTO' },
  { cand: 'file_cv', master: 'file_cv', label: 'FILE CV' },
  { cand: 'jft', master: 'jft_url', label: 'JFT' },
  { cand: 'ssw', master: 'ssw_url', label: 'SSW' },
];
const CAND_SELECT = 'id,id_kandidat,nama_lengkap,no_wa,' + COLS.map((c) => c.cand).join(',');
const MASTER_SELECT = 'id,id_kandidat,nama_lengkap,no_wa,' + COLS.map((c) => c.master).join(',');

// ---- 1. List SEMUA file di master/ (paginasi penuh) ------------------------
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
    if (!res.ok) throw new Error('list ' + prefix + ' → HTTP ' + res.status);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    offset += batch.length;
    if (batch.length < LIMIT) break;
  }
  return out;
}

// File di master/ dua level: folder (level 1) + isi folder (level 2).
async function listAllMasterFiles() {
  const top = await listPrefix('master/');
  const folders = top.filter((o) => o.id === null); // folder (metadata null)
  const files = top.filter((o) => o.id !== null);
  const nested = await Promise.all(
    folders.map(async (f) => {
      const prefix = 'master/' + f.name + '/';
      const items = await listPrefix(prefix);
      return items.filter((o) => o.id !== null).map((o) => prefix + o.name);
    }),
  );
  return new Set([...files.map((o) => 'master/' + o.name), ...nested.flat()]);
}

// Ekstrak path storage dari URL publik: .../object/public/<bucket>/<path>
function storagePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/object\/public\/[^/]+\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

// ---- 2. Ambil kandidat & master -------------------------------------------------
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

console.log('Membaca Storage master/ ...');
const existing = await listAllMasterFiles();
console.log('File di Storage master/:', existing.size);

console.log('Membaca database_candidate & master_database_candidate ...');
const candidates = await getTable('database_candidate', CAND_SELECT, 'id');
const masters = await getTable('master_database_candidate', MASTER_SELECT, 'id');
console.log('Kandidat:', candidates.length, '| Master:', masters.length);

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

// ---- 3. Audit ------------------------------------------------------------------
const broken = []; // { id, id_kandidat, nama, wa, col, rusak, pengganti, masterPunya }
const ok = new Set();
const nonStorage = [];
for (const c of candidates) {
  const master = masterByWa.get(normWa(c.no_wa)) || masterByIdKand.get(String(c.id_kandidat || ''));
  for (const col of COLS) {
    const url = c[col.cand];
    const sp = storagePathFromUrl(url);
    if (!sp) {
      if (url && url !== '-' && url !== '' && !url.startsWith('data:')) {
        nonStorage.push({ id: c.id, nama: c.nama_lengkap, kolom: col.label, url });
      }
      continue; // kosong / drive link / non-storage — di luar lingkup audit
    }
    if (existing.has(sp)) {
      ok.add(c.id + ':' + col.cand);
      continue;
    }
    // Rusak — cari pengganti dari master (kolom sejenis) yang ada di Storage
    let replacement = null;
    if (master) {
      const msp = storagePathFromUrl(master[col.master]);
      if (msp && existing.has(msp)) replacement = master[col.master];
    }
    broken.push({
      id: c.id,
      id_kandidat: c.id_kandidat,
      nama: c.nama_lengkap,
      wa: c.no_wa,
      col: col.cand,
      label: col.label,
      rusak: url,
      pengganti: replacement,
      masterPunya: !!master,
    });
  }
}

console.log('\n================ HASIL AUDIT ================');
console.log('pas_photo valid          :', [...ok].filter((k) => k.endsWith(':pas_photo')).length);
console.log('file_cv valid            :', [...ok].filter((k) => k.endsWith(':file_cv')).length);
console.log('jft valid                :', [...ok].filter((k) => k.endsWith(':jft')).length);
console.log('ssw valid                :', [...ok].filter((k) => k.endsWith(':ssw')).length);
console.log('non-storage (drive/dll)  :', nonStorage.length);
console.log('RUSAK (file tidak ada)   :', broken.length);
const withFix = broken.filter((b) => b.pengganti);
const noFix = broken.filter((b) => !b.pengganti);
console.log('  → ada pengganti master  :', withFix.length);
console.log('  → TANPA pengganti       :', noFix.length);

for (const b of broken) {
  console.log(
    `  [${b.id}] ${b.label} — ${b.nama} (${b.wa}) — rusak: ${b.rusak ? b.rusak.slice(0, 85) : '-'}`,
  );
  if (b.pengganti) console.log(`      → ganti: ${b.pengganti.slice(0, 105)}`);
  else
    console.log(
      `      → TANPA PENGGANTI${b.masterPunya ? ' (master ada tapi nilainya juga 404/kosong)' : ' (tidak ada master)'}`,
    );
}
if (nonStorage.length) {
  console.log('\nNon-storage (tidak disentuh):');
  for (const n of nonStorage)
    console.log(`  [${n.id}] ${n.kolom} ${n.nama} — ${String(n.url).slice(0, 85)}`);
}

// ---- 4. Apply ------------------------------------------------------------------
if (APPLY) {
  if (!withFix.length) {
    console.log('\nTidak ada yang perlu diperbaiki.');
    process.exit(0);
  }
  const stamp = new Date().toISOString();
  const backupPath = path.resolve(
    fileURLToPath(import.meta.url),
    '../../.freebuff/berkas-fix-backup-' + stamp.replace(/[:.]/g, '-') + '.json',
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      withFix.map((b) => ({
        id: b.id,
        nama: b.nama,
        wa: b.wa,
        kolom: b.col,
        lama: b.rusak,
        baru: b.pengganti,
      })),
      null,
      2,
    ),
  );
  console.log('\nBackup ->', backupPath);

  let n = 0;
  for (const b of withFix) {
    const res = await fetch(`${BASE}/rest/v1/database_candidate?id=eq.${b.id}`, {
      method: 'PATCH',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ [b.col]: b.pengganti }),
    });
    if (!res.ok) {
      console.error(
        '  GAGAL id=' +
          b.id +
          ' ' +
          b.col +
          ' → HTTP ' +
          res.status +
          ' ' +
          (await res.text()).slice(0, 150),
      );
      continue;
    }
    n++;
    console.log('  OK id=' + b.id + ' ' + b.label + ' (' + b.nama + ')');
  }
  console.log('\nDiperbaiki:', n, 'dari', withFix.length);
} else {
  console.log(
    '\n(dry-run — jalankan dengan --apply untuk memperbaiki; backup otomatis dibuat dulu)',
  );
}
