// @ts-nocheck
// =============================================================================
// cleanup-job-misc.mjs — Audit file di Supabase Storage folder jobs/ & misc/
// (template CV & pamflet loker) yang TIDAK direferensikan kolom mana pun
// (job_database.link_pamflet / format_cv, atau URL storage di tabel lain).
// Berbeda dari master/: folder jobs/misc TIDAK pernah di-list untuk
// ditampilkan (tidak ada share-view folder) — file di sini hanya terpakai
// kalau URL-nya ada di kolom DB. Jadi file yang path-nya tak direferensikan
// = aman dihapus.
//   bun run scripts/cleanup-job-misc.mjs           # dry-run (default)
//   bun run scripts/cleanup-job-misc.mjs --apply   # backup JSON + hapus
// Backup disimpan ke ../.freebuff/storage-delete-backup-*.json
// =============================================================================
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const {
  findTable,
  supabaseKey,
  supabaseUrl,
  toText,
} = require('../netlify/functions/_lib/db/client');
const { findJobs } = require('../netlify/functions/_lib/db/jobs');
const { findForms, parseDocs } = require('../netlify/functions/_lib/db/forms');

const APPLY = process.argv.includes('--apply');
const PREFIXES = ['jobs/', 'misc/'];
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'asj-files';
const BASE = supabaseUrl().replace(/\/$/, '');
const KEY = supabaseKey();
if (!BASE || !KEY) {
  console.error('Supabase belum dikonfigurasi (cek .env.local / Keys).');
  process.exit(1);
}

// ---- 1. List semua file (paginasi offset — lihat scan-orphan-files.mjs) -----
async function listPrefix(prefix) {
  const out = [];
  let offset = 0;
  const LIMIT = 200;
  for (;;) {
    const res = await fetch(`${BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix,
        limit: LIMIT,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    if (!res.ok) throw new Error('storage list HTTP ' + res.status);
    const j = await res.json();
    const batch = Array.isArray(j)
      ? j.map((o) => (o && o.name ? String(o.name).replace(/\/$/, '') : '')).filter(Boolean)
      : [];
    if (batch.length === 0) break;
    out.push(...batch);
    if (batch.length < LIMIT) break;
    offset += LIMIT;
  }
  return out;
}

// List semua file di bawah prefix: level-1 = subfolder, lalu list tiap subfolder.
async function listAllUnder(prefix) {
  const level = await listPrefix(prefix);
  const out = [];
  // Entry level-1 bisa subfolder ATAU file langsung (misc/ biasanya file).
  const CHUNK = 8;
  for (let i = 0; i < level.length; i += CHUNK) {
    const chunk = level.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (name) => {
        const sub = await listPrefix(prefix + name + '/').catch(() => []);
        if (sub.length === 0) {
          // Bukan subfolder → file langsung di bawah prefix.
          return [{ rel: prefix + name, folder: prefix.replace(/\/$/, '') || prefix, name }];
        }
        return sub.map((n) => ({
          rel: prefix + name + '/' + n,
          folder: name,
          name: n,
        }));
      }),
    );
    for (const arr of results) out.push(...arr);
  }
  return out;
}

// ---- 2. Kumpulkan SEMUA referensi path di database --------------------------
function pathsFromUrls(cells) {
  const set = new Set();
  for (const v of cells) {
    if (typeof v !== 'string' || !v) continue;
    const m = String(v).match(new RegExp('/storage/v1/object/public/' + BUCKET + '/([^?#]+)'));
    if (!m) continue;
    let rel = m[1];
    try {
      rel = decodeURIComponent(rel);
    } catch {
      /* biarkan */
    }
    set.add(rel.replace(/^\/+/, ''));
  }
  return set;
}

async function collectReferences() {
  const refs = new Set();
  // a) job_database — link_pamflet & format_cv (plus kolom URL lain apa pun).
  const jobs = await findJobs();
  for (const r of jobs.rows) for (const u of pathsFromUrls(Object.values(r))) refs.add(u);
  console.log(`  (info) referensi dari job_database: ${jobs.rows.length} baris`);
  // b) Tabel lain yang mungkin menyimpan URL jobs/ (legacy).
  for (const table of ['database_candidate', 'master_database_candidate']) {
    try {
      const { rows, table: found } = await findTable([table]);
      for (const r of rows || []) for (const u of pathsFromUrls(Object.values(r))) refs.add(u);
      console.log(`  (info) referensi dari ${found || table}: ${(rows || []).length} baris`);
    } catch (e) {
      console.log(`  (info) ${table} dilewati: ${String(e.message || e).slice(0, 80)}`);
    }
  }
  // c) Keterangan form lamaran (NAMA:URL;...).
  const forms = await findForms();
  for (const f of forms) {
    for (const d of parseDocs(toText(f.keterangan))) {
      if (d && d.url) for (const p of pathsFromUrls([d.url])) refs.add(p);
    }
  }
  console.log(`  (info) ${forms.length} form lamaran, ${refs.size} path total direferensikan`);
  return refs;
}

// ---- 3. Hapus batch ----------------------------------------------------------
async function storageDelete(rels) {
  const res = await fetch(`${BASE}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: rels }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('storage DELETE HTTP ' + res.status + ' ' + t.slice(0, 200));
  }
}

// ---- Main -------------------------------------------------------------------
console.log(
  `Scan file yatim di Storage ${PREFIXES.join(' & ')} (${APPLY ? 'APPLY' : 'read-only'})...\n`,
);
const files = [];
for (const p of PREFIXES) {
  const f = await listAllUnder(p);
  console.log(`Total file di ${p}: ${f.length}`);
  files.push(...f);
}
const refs = await collectReferences();
const orphan = files.filter((o) => !refs.has(o.rel));
console.log(`\nFile TIDAK direferensikan: ${orphan.length}/${files.length}\n`);

// Kategorikan:
//   A-varian-lama  — tipe sama dengan file terreferensi di folder sama
//   B-folder-yatim — seluruh folder tak ada yang terreferensi
//   C-lainnya      — tak direferensikan, folder lain ada yang terreferensi
function stemOf(name) {
  return String(name)
    .replace(/\.\w+$/, '')
    .replace(/_\d{10,}$/, '');
}
const byFolder = new Map();
for (const o of files) {
  if (!byFolder.has(o.folder)) byFolder.set(o.folder, []);
  byFolder.get(o.folder).push(o);
}
const SAFE = [];
for (const o of orphan) {
  const folderRefs = [...refs].filter(
    (r) => r.startsWith('jobs/' + o.folder + '/') || r.startsWith('misc/' + o.folder + '/'),
  );
  const folderKnown = folderRefs.length > 0;
  const s = stemOf(o.name);
  const varianLama = folderKnown && folderRefs.some((r) => stemOf(r.split('/').pop()) === s);
  const tag = varianLama ? 'A-varian-lama' : folderKnown ? 'C-lainnya' : 'B-folder-yatim';
  SAFE.push({ tag, o });
}
for (const { tag, o } of SAFE) console.log(`  [${tag}] ${o.rel}`);
const byTag = {};
for (const { tag } of SAFE) byTag[tag] = (byTag[tag] || 0) + 1;
console.log(
  `\nRINGKASAN: ${SAFE.length} file yatim (A varian-lama: ${byTag['A-varian-lama'] || 0}, ` +
    `B folder-yatim: ${byTag['B-folder-yatim'] || 0}, C lainnya: ${byTag['C-lainnya'] || 0}).`,
);

if (!APPLY) {
  console.log('\nDry-run selesai — tidak ada yang dihapus. Pakai --apply untuk eksekusi.');
  process.exit(0);
}

const backupDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.freebuff',
);
fs.mkdirSync(backupDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `storage-delete-backup-${ts}.json`);
fs.writeFileSync(
  backupFile,
  JSON.stringify(
    {
      timestamp: ts,
      total: SAFE.length,
      byTag,
      files: SAFE.map(({ tag, o }) => ({ tag, rel: o.rel })),
    },
    null,
    2,
  ),
);
console.log(`\n✅ Backup ${SAFE.length} path → ${backupFile}`);

let deleted = 0;
for (let i = 0; i < SAFE.length; i += 100) {
  const chunk = SAFE.slice(i, i + 100).map(({ o }) => o.rel);
  await storageDelete(chunk);
  deleted += chunk.length;
  console.log(`  hapus ${deleted}/${SAFE.length}…`);
}
console.log(`\n✅ ${deleted} file dihapus dari Storage (backup di ${backupFile}).`);
process.exit(0);
