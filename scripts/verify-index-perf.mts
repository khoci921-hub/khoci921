#!/usr/bin/env node
// @ts-nocheck
// =============================================================
// verify-index-perf.mjs — verifikasi READ-ONLY performa tarikan data
// ASJ Portal setelah migrasi index
// (netlify/migrations/2026-08-16-index-perf.sql) + cache server-side
// (Fase 3.17: loadCandidatesUnik TTL 25s, public-base TTL 20s).
//
// Isi cek:
//   A. Koneksi Supabase terpasang & terjangkau (TANPA membocorkan secret).
//   B. Timing query REST persis yang dipakai backend (3 ronde, min ms):
//        - Inbox 500 baris: sort timestamp.desc (ber-index) vs
//          created_at.desc (tanpa index → pembanding "sebelum index")
//        - Kandidat light full paginasi (updated_at.desc, idx)
//        - ILIKE id_loker_pilihan: pola >=3 char (trigram GIN terpakai)
//          vs pola 2 char (trigram tak bisa → seq scan, proksi "sebelum")
//        - Lookup no_wa eq (idx), berkas & master batch in-filter,
//          form per WA (or no_wa/wa)
//   C. Timing action handler (SEMUA tarikan data utama) — ronde 1 dingin,
//      ronde 2 langsung menyusul (menunjukkan efek cache server-side).
//
// TIDAK mengubah data apa pun. Hanya mencetak status/angka/durasi —
// data kandidat/lamaran TIDAK pernah dicetak.
// =============================================================
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const { env } = require('../netlify/functions/_lib/env.js');
const { handleAction } = require('../netlify/functions/_lib/handlers.js');

const WA = process.env.E2E_WA || '082130442661';
const PIN = process.env.E2E_PIN || '2661';
const ADMIN_NAME = process.env.E2E_ADMIN_NAME || 'KHOCI';
const ADMIN_PIN = process.env.E2E_ADMIN_PIN || '4444';

const base = String(env('SUPABASE_URL') || '').replace(/\/$/, '');
const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY') || '';

if (!base || !key) {
  console.error('❌ SUPABASE_URL / key tidak terpasang di .env.local');
  process.exit(1);
}

const headers = { apikey: key, Authorization: 'Bearer ' + key };

let failures = 0;
function ok(name, cond, extra = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
}

async function rest(pathname, query, { range, preferCount } = {}) {
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  const res = await fetch(base + '/rest/v1/' + pathname + qs, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      ...(range ? { Range: range } : {}),
      ...(preferCount ? { Prefer: 'count=exact' } : {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const cr = res.headers.get('content-range') || '';
  // PostgREST: 200 = konten penuh, 206 = konten parsial (Range / count=exact).
  // Keduanya sukses.
  return {
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    body,
    text: text.slice(0, 120),
    total: parseInt(String(cr).split('/')[1] || '0', 10) || 0,
  };
}

// Jalankan fn beberapa ronde, kembalikan array durasi ms.
async function rounds(fn, n = 3) {
  const ms = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const r = await fn();
    ms.push(Math.round(performance.now() - t0));
    if (r && r.pause) await new Promise((res) => setTimeout(res, r.pause));
  }
  return ms;
}

const fmt = (ms) => ms.map((m) => m + 'ms').join(' / ');
const min = (ms) => Math.min(...ms) + 'ms';

// =====================================================================
console.log('=== A. Koneksi Supabase ===');
ok('SUPABASE_URL terpasang', /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base));
ok('key terpasang (service role/anon)', key.length > 10);
const spec = await rest('');
ok(
  'OpenAPI rest/v1 terjangkau',
  spec.ok,
  `tabel=${spec.body && Array.isArray(spec.body.paths) ? 0 : spec.body && spec.body.paths ? Object.keys(spec.body.paths).length : '?'}`,
);

// Coba akses katalog index via REST (biasanya tidak diekspos PostgREST —
// kalau ada, ini bukti langsung index terpasang; kalau 404, lanjut ke B).
const pgIdx = await rest('pg_indexes', { select: 'indexname,tablename', limit: 500 });
if (pgIdx.ok && Array.isArray(pgIdx.body)) {
  const names = pgIdx.body.map((r) => r.indexname || '');
  const want = [
    'idx_asj_form_timestamp',
    'idx_asj_form_no_wa',
    'idx_asj_form_code_job',
    'idx_cand_updated_at',
    'idx_cand_no_wa',
    'idx_cand_loker_trgm',
    'idx_berkas_wa',
    'idx_master_no_wa',
  ];
  console.log('  pg_indexes ter-expose via REST:');
  for (const w of want) ok('index ' + w, names.includes(w));
} else {
  console.log(
    '  ℹ️ pg_indexes tidak diekspos REST (HTTP ' +
      pgIdx.status +
      ') — verifikasi index via bukti perilaku (trigram) + timing di bawah.',
  );
}

// Bukti langsung extension pg_trgm TERPASANG: fungsi show_trgm (milik extension
// itu) bisa dipanggil lewat REST dan mengembalikan trigram dari teks input.
{
  const r = await fetch(base + '/rest/v1/rpc/show_trgm', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ '': 'TG9ASJ' }),
  });
  const body = await r.text();
  let trigrams = null;
  try {
    trigrams = JSON.parse(body);
  } catch {}
  ok(
    'pg_trgm terpasang (rpc/show_trgm jalan)',
    r.ok && Array.isArray(trigrams) && trigrams.length > 0,
    Array.isArray(trigrams) ? trigrams.slice(0, 4).join(',') + ', …' : 'HTTP ' + r.status,
  );
}

// =====================================================================
console.log('\n=== B. Timing query REST backend (3 ronde, min = durasi tercepat) ===');

const FORM_LIGHT =
  'id,timestamp,code_job,kategory,nama_lengkap,no_wa,status,folder_url,pas_photo,jft,ssw,file_cv,keterangan,feedback_berkas,created_at,updated_at';
const CAND_LIGHT =
  'id,id_kandidat,nama_lengkap,no_wa,status_kandidat,updated_at,created_at,tanggal_daftar';

// B1. Inbox 500 — sort timestamp.desc (index idx_asj_form_timestamp).
{
  const r = await rounds(() =>
    rest('database_asj_form', { select: FORM_LIGHT, order: 'timestamp.desc', limit: 500 }),
  );
  console.log(`  B1. Inbox 500 sort timestamp.desc  (idx)      : ${fmt(r)} → min ${min(r)}`);
}
// B2. Inbox 500 — sort created_at.desc (tanpa index → sort penuh; pembanding).
{
  const r = await rounds(() =>
    rest('database_asj_form', { select: FORM_LIGHT, order: 'created_at.desc', limit: 500 }),
  );
  console.log(
    `  B2. Inbox 500 sort created_at.desc (no idx)    : ${fmt(r)} → min ${min(r)}  (proksi "sebelum index")`,
  );
}
// B3. Kandidat light full paginasi (findAllCandidatesLight — scan penuh ringan).
{
  const r = await rounds(async () => {
    let total = 0;
    for (let start = 0; ; start += 1000) {
      const res = await rest(
        'database_candidate',
        { select: CAND_LIGHT },
        { range: `${start}-${start + 999}`, preferCount: true },
      );
      if (!res.ok) return res;
      total = res.total || total;
      if (!Array.isArray(res.body) || res.body.length === 0 || start + res.body.length >= total)
        break;
    }
    return { total };
  });
  const last = await rest(
    'database_candidate',
    { select: CAND_LIGHT },
    { range: '0-0', preferCount: true },
  );
  console.log(
    `  B3. Kandidat light full paginasi   (idx upd)   : ${fmt(r)} → min ${min(r)}  (total=${last.total} baris)`,
  );
}
// B4/B5. ILIKE id_loker_pilihan — pola panjang (trigram) vs pola 2 char.
{
  const sample = await rest('database_candidate', { select: 'id_loker_pilihan', limit: 100 });
  const tokens = [];
  for (const row of Array.isArray(sample.body) ? sample.body : []) {
    for (const tok of String(row.id_loker_pilihan || '').split(/[,;]+/)) {
      const t = tok.trim().toUpperCase();
      if (/^[A-Z0-9]{3,}$/.test(t) && !tokens.includes(t)) tokens.push(t);
    }
  }
  if (tokens.length) {
    const tok = tokens[0];
    const short = tok.slice(0, 2);
    const r4 = await rounds(() =>
      rest('database_candidate', {
        select: 'id,id_kandidat,nama_lengkap,no_wa',
        id_loker_pilihan: `ilike.*${tok}*`,
        limit: 500,
      }),
    );
    const r5 = await rounds(() =>
      rest('database_candidate', {
        select: 'id,id_kandidat,nama_lengkap,no_wa',
        id_loker_pilihan: `ilike.*${short}*`,
        limit: 500,
      }),
    );
    console.log(`  B4. ILIKE '${tok}'   (trigram GIN, >=3 char): ${fmt(r4)} → min ${min(r4)}`);
    console.log(
      `  B5. ILIKE '${short}%' (trigram tak terpakai)  : ${fmt(r5)} → min ${min(r5)}  (proksi "sebelum index")`,
    );
  } else {
    console.log('  B4/B5. dilewati — tidak ada token id_loker_pilihan 3+ char di sample.');
  }
}
// B6. Lookup no_wa eq (idx_cand_no_wa).
{
  const cand = await rest('database_candidate', { select: 'no_wa', limit: 5 });
  const wa =
    Array.isArray(cand.body) && cand.body[0]
      ? String(cand.body[0].no_wa || '').replace(/\D/g, '')
      : '';
  if (wa) {
    const r = await rounds(() =>
      rest('database_candidate', { select: '*', no_wa: 'eq.' + wa, limit: 5 }),
    );
    console.log(`  B6. Lookup kandidat no_wa=eq (idx)            : ${fmt(r)} → min ${min(r)}`);
  } else {
    console.log('  B6. dilewati — kandidat tanpa no_wa.');
  }
}
// B7. Berkas batch (idx_berkas_wa).
{
  const cand = await rest('database_candidate', { select: 'no_wa', limit: 5 });
  const was = [];
  for (const row of Array.isArray(cand.body) ? cand.body : []) {
    const w = String(row.no_wa || '').replace(/\D/g, '');
    if (w && !was.includes(w)) was.push(w);
    if (was.length === 2) break;
  }
  if (was.length) {
    const r = await rounds(() =>
      rest('pemberkasan_checklist', { select: 'wa', wa: 'in.(' + was.join(',') + ')' }),
    );
    console.log(`  B7. Berkas batch wa.in (${was.length}) (idx)   : ${fmt(r)} → min ${min(r)}`);
  } else {
    console.log('  B7. dilewati — tidak ada WA sample.');
  }
}
// B8. Master batch (idx_master_no_wa).
{
  const cand = await rest('database_candidate', { select: 'no_wa', limit: 5 });
  const was = [];
  for (const row of Array.isArray(cand.body) ? cand.body : []) {
    const w = String(row.no_wa || '').replace(/\D/g, '');
    if (w && !was.includes(w)) was.push(w);
    if (was.length === 2) break;
  }
  if (was.length) {
    const r = await rounds(() =>
      rest('master_database_candidate', { select: 'no_wa', no_wa: 'in.(' + was.join(',') + ')' }),
    );
    console.log(`  B8. Master batch no_wa.in (${was.length}) (idx): ${fmt(r)} → min ${min(r)}`);
  } else {
    console.log('  B8. dilewati — tidak ada WA sample.');
  }
}
// B9. Form per WA (or no_wa/wa + sort timestamp.desc).
{
  const want = WA.replace(/\D/g, '');
  const r = await rounds(() =>
    rest('database_asj_form', {
      select: '*',
      limit: 100,
      order: 'timestamp.desc',
      or: `(no_wa.eq.${want},wa.eq.${want})`,
    }),
  );
  console.log(`  B9. Form per WA (or no_wa/wa, idx)             : ${fmt(r)} → min ${min(r)}`);
}

// =====================================================================
console.log('\n=== C. Tarikan data via handler (r1 = dingin, r2 = cache server-side) ===');

function handlerRounds(fn, n = 2) {
  return rounds(fn, n);
}

// C1. Login kandidat.
const t0 = performance.now();
const login = await handleAction('loginKandidat', [WA, PIN]);
const loginMs = Math.round(performance.now() - t0);
const candToken = login.sessionToken || '';
const candWa = String(login.wa || WA).replace(/\D/g, '');
ok(
  'C1. loginKandidat',
  login.success === true,
  `${loginMs}ms${(login.error || '').slice(0, 60) ? ' (' + (login.error || '').slice(0, 60) + ')' : ''}`,
);

// C2. getAppData kandidat (x2).
if (candToken && candWa) {
  const r = await handlerRounds(() => handleAction('getAppData', ['kandidat', candWa], candToken));
  console.log(
    `  C2. getAppData kandidat : ${fmt(r)} → r1 ${r[0]}ms (dingin) | r2 ${r[1] || '-'}ms (cache public-base)`,
  );
}

// C3. Login admin.
const t1 = performance.now();
const adm = await handleAction('checkAdminPersonal', [ADMIN_NAME, ADMIN_PIN]);
const admMs = Math.round(performance.now() - t1);
const admToken = adm.sessionToken || '';
ok(
  'C3. checkAdminPersonal',
  adm.success === true,
  `${admMs}ms${(adm.error || '').slice(0, 60) ? ' (' + (adm.error || '').slice(0, 60) + ')' : ''}`,
);

// C4. getAppData admin (x2) — r2 harus kena cache kandidat + public-base.
if (admToken) {
  const r = await handlerRounds(() => handleAction('getAppData', ['admin'], admToken));
  let rows = 0;
  try {
    const rr = await handleAction('getAppData', ['admin'], admToken);
    rows = Array.isArray(rr.candidates) ? rr.candidates.length : -1;
  } catch {}
  console.log(
    `  C4. getAppData admin   : ${fmt(r)} → r1 ${r[0]}ms (dingin) | r2 ${r[1] || '-'}ms (cache kand+pub) | candidates=${rows}`,
  );

  // C5. getCandidatesPage (x2 — cache key sama dengan C4 → r2 sangat cepat).
  const r5 = await handlerRounds(() =>
    handleAction('getCandidatesPage', [{ page: 1, pageSize: 50, q: '' }], admToken),
  );
  console.log(
    `  C5. getCandidatesPage  : ${fmt(r5)} → r1 ${r5[0]}ms | r2 ${r5[1] || '-'}ms (cache loadCandidatesUnik)`,
  );

  // C6. getAppConfig (admin) — hanya ukur durasi, isi tidak dicetak.
  const t6 = performance.now();
  const cfg = await handleAction('getAppConfig', [], admToken);
  console.log(
    `  C6. getAppConfig       : ${Math.round(performance.now() - t6)}ms (sukses=${cfg.success === true})`,
  );

  // C7. getRincianPresets (admin).
  const t7 = performance.now();
  const pres = await handleAction('getRincianPresets', [], admToken);
  console.log(
    `  C7. getRincianPresets  : ${Math.round(performance.now() - t7)}ms (sukses=${pres.success === true || !!pres})`,
  );
}

// C8. getDaftarSiswaBaru (publik).
{
  const t = performance.now();
  const res = await handleAction('getDaftarSiswaBaru', []);
  const arr =
    res && Array.isArray(res.data)
      ? res.data
      : res && Array.isArray(res.siswa)
        ? res.siswa
        : Array.isArray(res)
          ? res
          : null;
  console.log(
    `  C8. getDaftarSiswaBaru : ${Math.round(performance.now() - t)}ms (baris=${arr ? arr.length : '?'})`,
  );
}

// C9. cekDataPelamar (publik, per WA).
{
  const t = performance.now();
  const res = await handleAction('cekDataPelamar', [WA]);
  const n = res && Array.isArray(res.applications) ? res.applications.length : -1;
  console.log(
    `  C9. cekDataPelamar     : ${Math.round(performance.now() - t)}ms (found=${res.found === true}, lamaran=${n})`,
  );
}

// C10. getMasterDataByWa + getDrafCvMaster (sesi kandidat).
if (candToken && candWa) {
  const t = performance.now();
  const m = await handleAction('getMasterDataByWa', [candWa], candToken);
  console.log(
    `  C10. getMasterDataByWa : ${Math.round(performance.now() - t)}ms (${m && m.error ? 'error: ' + m.error.slice(0, 60) : 'sukses'})`,
  );
  const t2 = performance.now();
  const cv = await handleAction('getDrafCvMaster', [candWa], candToken);
  console.log(
    `  C11. getDrafCvMaster   : ${Math.round(performance.now() - t2)}ms (${cv && cv.error ? 'error: ' + cv.error.slice(0, 60) : 'sukses'})`,
  );
}

// =====================================================================
console.log('\n=== D. Integritas: hitung handler vs hitung REST langsung (DB) ===');
// Tarikan data terbaru harus SAMA dengan isi DB — bandingkan jumlah baris
// yang dikembalikan handler dengan count=exact langsung ke REST.

async function restCount(table, select = 'id') {
  const res = await rest(table, { select, limit: 1 }, { preferCount: true });
  return res.ok ? res.total : -1;
}

// Kumpulkan angka dari handler (sekali jalan).
const adminData = admToken ? await handleAction('getAppData', ['admin'], admToken) : null;

const D = [];
if (adminData) {
  const candDb = await restCount('database_candidate');
  D.push([
    'kandidat halaman 1 (50)',
    Math.min(candDb, 50),
    Array.isArray(adminData.candidates) ? adminData.candidates.length : -1,
    'halaman 1 = min(total, 50)',
  ]);
  D.push([
    'total kandidat unik (candidatesTotal)',
    candDb,
    adminData.candidatesTotal ?? -1,
    'handler total vs DB count',
  ]);
  const formDb = await restCount('database_asj_form');
  D.push([
    'inbox (database_asj_form)',
    formDb,
    Array.isArray(adminData.formInbox) ? adminData.formInbox.length : -1,
    'handler (max 500) vs DB count',
  ]);
  const jobNames = ['job_database', 'jobs', 'loker', 'lokers'];
  let jobDb = -1;
  let jobTable = '';
  for (const j of jobNames) {
    jobDb = await restCount(j, 'code_job');
    if (jobDb >= 0) {
      jobTable = j;
      break;
    }
  }
  D.push([
    'lowongan (' + (jobTable || 'job_database/jobs/loker/lokers') + ')',
    jobDb,
    Array.isArray(adminData.jobs) ? adminData.jobs.length : -1,
    'handler vs DB count',
  ]);
  const schedDb = await restCount('database_schedule');
  D.push([
    'jadwal (database_schedule)',
    schedDb,
    Array.isArray(adminData.schedules) ? adminData.schedules.length : -1,
    'handler (max 500) vs DB count',
  ]);
  const tugasDb = await restCount('database_tugas');
  D.push([
    'tugas (database_tugas)',
    tugasDb,
    Array.isArray(adminData.tugas) ? adminData.tugas.length : -1,
    'handler (max 500) vs DB count',
  ]);
  const waDb = await restCount('wa_templates');
  D.push([
    'template WA (wa_templates)',
    waDb,
    Array.isArray(adminData.waTemplates) ? adminData.waTemplates.length : -1,
    'handler (max 500) vs DB count',
  ]);
  const berkasDb = await restCount('pemberkasan_checklist', 'wa');
  D.push([
    'berkas (pemberkasan_checklist)',
    berkasDb,
    -1,
    'hanya REST (handler lampirkan per kandidat)',
  ]);
  const masterDb = await restCount('master_database_candidate', 'no_wa');
  D.push([
    'master (master_database_candidate)',
    masterDb,
    -1,
    'hanya REST (handler lampirkan per kandidat)',
  ]);
}

for (const [name, db, handler, note] of D) {
  if (db === null || db < 0) {
    console.log(`  ⚪ ${name.padEnd(34)} REST gagal (tabel/kolom tidak dikenal)`);
    continue;
  }
  const same = handler < 0 ? null : db === handler || handler === Math.min(db, 500);
  const mark = same === true ? '✅' : same === false ? '⚠️' : '⚪';
  console.log(`  ${mark} ${name.padEnd(34)} DB=${db} | handler=${handler}  (${note})`);
  if (same === false) failures++;
}

console.log(
  `\n${failures === 0 ? '✅ SEMUA CEK LULUS (durasi di atas hanya informasi)' : `💥 ${failures} cek GAGAL`}`,
);
