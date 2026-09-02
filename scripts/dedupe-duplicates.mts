// @ts-nocheck
// =============================================================================
// dedupe-duplicates.mjs — Merge baris duplikat warisan (dry-run default)
// -----------------------------------------------------------------------------
// Panel admin sekarang menampilkan 1 kandidat = 1 baris (dedupe by WA), tapi
// baris duplikat LAMA tetap ada di DB dan bikin bingung (lamaran yang sama
// tampil berulang di inbox, dokumen tersebar di beberapa baris).
//
// Tabel yang dirapikan:
//   - database_asj_form        grup by (no_wa, code_job)
//   - database_candidate       grup by no_wa
//   - pemberkasan_checklist    grup by (wa, tahap)
//
// Strategi: 1 baris "penjaga" per grup (status paling lanjut / updated_at
// terbaru / id terbesar), semua kolom dokumen & catatan dari baris lain
// digabung ke penjaga, lalu baris sisanya dihapus. Untuk lamaran, status
// LULUS > GAGAL > REVIEW > UPDATE > MENUNGGU — keputusan admin tidak hilang.
//
//   bun run scripts/dedupe-duplicates.mjs           # dry-run (read-only)
//   bun run scripts/dedupe-duplicates.mjs --apply   # backup JSON + merge + hapus
// Selain WA persis, grup dengan nama sama + WA mirip (typo, jarak edit <= 2)
// ikut digabung supaya 1 kandidat = 1 baris (contoh: 6282... vs 6223...).
// Backup lengkap disimpan ke .freebuff/dedupe-backup-<timestamp>.json SEBELUM
// perubahan apa pun (baris asli + hasil merge), jadi bisa di-recover manual.
// =============================================================================
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const {
  normalizeWa: normWa,
  supabaseKey,
  supabaseUrl,
} = require('../netlify/functions/_lib/db/client');

const APPLY = process.argv.includes('--apply');
const BASE = supabaseUrl().replace(/\/$/, '');
const KEY = supabaseKey();
if (!BASE || !KEY) {
  console.error('Supabase belum dikonfigurasi (cek .env.local / Keys).');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const normalizeWa = (v) => normWa(v);

// ---- Helper fetch semua baris (paginasi Range) ------------------------------
async function getAll(table) {
  const out = [];
  let from = 0;
  const SIZE = 500;
  for (;;) {
    const res = await fetch(`${BASE}/rest/v1/${table}?select=*&order=id.asc`, {
      headers: { ...H, Range: `${from}-${from + SIZE - 1}` },
    });
    if (!res.ok)
      throw new Error(`${table} GET HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < SIZE) break;
    from += SIZE;
  }
  return out;
}
async function patchRow(table, id, body) {
  const res = await fetch(`${BASE}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) throw new Error(`PATCH ${table} #${id} HTTP ${res.status}`);
}
async function deleteRow(table, id) {
  const res = await fetch(`${BASE}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...H, Prefer: 'return=minimal' },
  });
  if (!res.ok && res.status !== 204) throw new Error(`DELETE ${table} #${id} HTTP ${res.status}`);
}

// Aturan merge (fungsi murni, bisa di-unit-test) — satu sumber:
// scripts/dedupe-rules.mjs (normalisasi WA ikut shared/wa-rules.js).
import {
  formPrio,
  tsOf,
  pickKeeper,
  levenshtein,
  normNameKey,
  waDigits,
  preferWa,
  fuzzyCluster,
  fixWaKeeper,
  nonEmpty,
  mergeFill,
  mergeJsonDeep,
  mergeAiJson,
  mergeFillLatest,
  mergeDocs,
  mergeFeedback,
  mergeCatatanInternal,
} from './dedupe-rules.mts';
// ---- Definisi tiap tabel -------------------------------------------------------
const TABLES = [
  {
    name: 'database_asj_form',
    fuzzy: true,
    key: (r) => normalizeWa(String(r.no_wa || r.wa || '')) + '#' + String(r.code_job || '').trim(),
    pick: (rows) => pickKeeper(rows, { prio: formPrio }),
    merge: (keeper, dups) => {
      const all = [keeper, ...dups];
      // ai_data_json DEEP-MERGE semua snapshot (newest-wins) — bukan fill-if-empty.
      const ai = mergeAiJson(all);
      // Kolom biodata lain: nilai terbaru yang terisi menang (penjaga by status
      // bisa saja snapshot paling tua → jangan biarkan data baru hilang).
      const { body, changed } = mergeFillLatest(all, [
        'pas_photo',
        'jft',
        'ssw',
        'file_cv',
        'gender',
        'usia',
        'tb',
        'bb',
        'email',
        'tempat_lahir',
        'tgl_lahir',
        'alamat_lengkap',
        'folder_url',
        'folder_id',
        'folder_name',
        'kategory',
        'nama_lengkap',
        'no_wa',
      ]);
      fixWaKeeper(keeper, dups, body); // WA typo → format kanonik
      const docs = mergeDocs(keeper, dups);
      const fb = mergeFeedback(keeper, dups);
      if (ai) {
        const cur =
          typeof keeper.ai_data_json === 'string'
            ? keeper.ai_data_json
            : JSON.stringify(keeper.ai_data_json || {});
        if (JSON.stringify(ai) !== cur) {
          body.ai_data_json = JSON.stringify(ai);
        }
      }
      if (docs) body.keterangan = docs;
      if (fb) body.feedback_berkas = fb;
      return { body, changed: changed || !!docs || !!fb || !!body.ai_data_json };
    },
  },
  {
    name: 'database_candidate',
    fuzzy: true,
    key: (r) => normalizeWa(String(r.no_wa || r.wa || '')),
    pick: (rows) => pickKeeper(rows),
    merge: (keeper, dups) => {
      const { body, changed } = mergeFill(keeper, dups, [
        'nik',
        'gender',
        'usia',
        'tb',
        'bb',
        'pendidikan',
        'id_loker_pilihan',
        'tahapan_seleksi',
        'status_kandidat',
        'tanggal_daftar',
        'catatan_admin',
        'pas_photo',
        'folder_url',
        'jft',
        'ssw',
        'file_cv',
        'no_pasport',
        'email',
        'tempat_lahir',
        'tgl_lahir',
        'alamat_lengkap',
        'catatan_external',
        'nilai_jft_text',
        'bidang_ssw_text',
        'id_kandidat',
      ]);
      fixWaKeeper(keeper, dups, body); // WA typo → format kanonik
      const cat = mergeCatatanInternal(keeper, dups);
      if (cat) body.catatan_internal = cat;
      return { body, changed: changed || !!cat || !!body.no_wa };
    },
  },
  {
    name: 'pemberkasan_checklist',
    key: (r) => normalizeWa(String(r.wa || r.no_wa || '')) + '#' + String(r.tahap ?? ''),
    pick: (rows) => pickKeeper(rows),
    merge: (keeper, dups) =>
      mergeFill(keeper, dups, [
        'nama_lengkap',
        'kk_url',
        'akte_url',
        'sd_url',
        'smp_url',
        'sma_url',
        'pasport_url',
        'mcu_url',
        'kontrak_url',
        'cert_url',
        'ktp_url',
        'foto2_url',
        'ijinortu_url',
        'cpmi_url',
        'kawin_url',
        'sehat_url',
        'bpjs_url',
        'psikotes_url',
        'univ_url',
      ]),
  },
];

// ---- Main -----------------------------------------------------------------------
console.log(
  `Scan duplikat warisan (${APPLY ? 'APPLY — akan merge & hapus' : 'dry-run / read-only'})...\n`,
);
const report = [];
for (const t of TABLES) {
  const rows = await getAll(t.name);
  let groups = new Map();
  for (const r of rows) {
    const k = t.key(r);
    if (!k || k === '#') continue; // tanpa WA → jangan disentuh
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  // WA typo (nama sama, digit mirip) → gabung grup biar jadi 1 baris.
  if (t.fuzzy) groups = fuzzyCluster(groups);
  let dupGroups = 0;
  let dupRows = 0;
  const groupsInfo = [];
  for (const [k, g] of groups) {
    if (g.length < 2) continue;
    dupGroups++;
    dupRows += g.length - 1;
    const keeper = t.pick(g);
    const dups = g.filter((r) => r.id !== keeper.id);
    const { body, changed } = t.merge(keeper, dups);
    groupsInfo.push({
      key: k,
      rows: g.length,
      keeperId: keeper.id,
      dupIds: dups.map((d) => d.id),
      changed,
      mergedCols: Object.keys(body),
    });
    console.log(
      `  [${t.name}] ${k}: ${g.length} baris → penjaga #${keeper.id}${changed ? ' (+merge: ' + Object.keys(body).join(', ') + ')' : ' (tanpa isi tambahan)'}`,
    );
  }
  if (!dupGroups) console.log(`  [${t.name}] bersih — tidak ada duplikat`);
  report.push({ table: t.name, dupGroups, dupRows, groups: groupsInfo });
  console.log('');
}

const totalGroups = report.reduce((a, r) => a + r.dupGroups, 0);
const totalRows = report.reduce((a, r) => a + r.dupRows, 0);
console.log(
  `RINGKASAN: ${totalGroups} grup duplikat, ${totalRows} baris duplikat siap dihapus (setelah digabung ke penjaga).`,
);

if (!APPLY) {
  console.log('\nDry-run selesai — tidak ada yang diubah. Jalankan dengan --apply untuk eksekusi.');
  process.exit(totalGroups ? 1 : 0);
}
if (totalGroups === 0) {
  console.log('\nTidak ada yang perlu dilakukan.');
  process.exit(0);
}

// Backup penuh SEBELUM mutasi.
const backupDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.freebuff');
fs.mkdirSync(backupDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `dedupe-backup-${ts}.json`);
const backupPayload = { timestamp: ts, report };
for (const t of TABLES) {
  backupPayload[t.name] = await getAll(t.name);
}
fs.writeFileSync(backupFile, JSON.stringify(backupPayload, null, 2));
console.log(
  `\n✅ Backup ${backupPayload.database_asj_form.length + backupPayload.database_candidate.length + backupPayload.pemberkasan_checklist.length} baris → ${backupFile}`,
);

let merged = 0;
let deleted = 0;
const errors = [];
for (const t of TABLES) {
  const rows = await getAll(t.name);
  let groups = new Map();
  for (const r of rows) {
    const k = t.key(r);
    if (!k || k === '#') continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  if (t.fuzzy) groups = fuzzyCluster(groups);
  for (const [k, g] of groups) {
    if (g.length < 2) continue;
    const keeper = t.pick(g);
    const dups = g.filter((r) => r.id !== keeper.id);
    const { body, changed } = t.merge(keeper, dups);
    try {
      if (changed) {
        await patchRow(t.name, keeper.id, { ...body, updated_at: new Date().toISOString() });
        merged++;
      }
      for (const d of dups) await deleteRow(t.name, d.id);
      deleted += dups.length;
      console.log(`  ✅ [${t.name}] ${k}: gabung ke #${keeper.id}, hapus ${dups.length} baris`);
    } catch (e) {
      errors.push(`[${t.name}] ${k}: ${e.message}`);
      console.log(`  ❌ [${t.name}] ${k}: ${e.message}`);
    }
  }
}
console.log(`\n✅ Selesai: ${merged} penjaga diperbarui, ${deleted} baris duplikat dihapus.`);
if (errors.length) {
  console.log(
    `⚠ ${errors.length} grup gagal diproses (lihat daftar di atas). Backup tetap tersedia di ${backupFile}`,
  );
  process.exit(1);
}
process.exit(0);
