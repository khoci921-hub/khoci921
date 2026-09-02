// =============================================================
// E2E UPSERT CHECK — ASJ Portal
// -------------------------------------------------------------
// Verifikasi E2E helper supabaseUpsert() di production DB.
// Insert sentinel → upsert lagi (harus UPDATE) → hapus.
// Jalankan: bun e2e/upsert-check.mjs  (perlu .env.local valid)
// Requires: pg module (sudah ada di node_modules).
// =============================================================
import { supabaseUpsert, supabaseJson, hasBackend } from '../netlify/functions/_lib/db/client.ts';

const SENT_WA = '000000000TEST';
const results = [];

function report(table, step, ok, detail) {
  results.push({ table, step, ok, detail });
  console.log(
    (ok ? '  PASS ' : '  FAIL ') + table + ' :: ' + step + (detail ? ' — ' + detail : ''),
  );
}

async function rowsOf(table, filter) {
  const rows = await supabaseJson('GET', table, { query: { ...filter, select: '*' } });
  return Array.isArray(rows) ? rows : [];
}

async function cleanup(table, filter) {
  try {
    await supabaseJson('DELETE', table, { query: filter, headers: { Prefer: 'return=minimal' } });
  } catch {}
}

async function testTable(name, table, conflictCols, rowA, rowB, filter, fieldCheck) {
  console.log('');
  console.log('=== ' + name + ' ===');
  await cleanup(table, filter);
  try {
    await supabaseUpsert(table, rowA, conflictCols);
    const rows = await rowsOf(table, filter);
    const ok = rows.length === 1 && fieldCheck(rows[0], rowA);
    report(name, 'insert #1 lands', ok, 'count=' + rows.length);
  } catch (e) {
    report(name, 'insert #1 lands', false, e.message.slice(0, 120));
    await cleanup(table, filter);
    return;
  }
  try {
    await supabaseUpsert(table, rowB, conflictCols);
    const rows = await rowsOf(table, filter);
    const ok = rows.length === 1 && fieldCheck(rows[0], rowB);
    report(
      name,
      'insert #2 UPDATES (bukan 409/duplikat)',
      ok,
      rows.length === 1
        ? ok
          ? 'count=1, nilai ter-update'
          : 'count=1 tapi nilai TIDAK ter-update'
        : 'DUP! count=' + rows.length,
    );
  } catch (e) {
    report(name, 'insert #2 UPDATES (bukan 409/duplikat)', false, e.message.slice(0, 120));
  }
  await cleanup(table, filter);
  const left = await rowsOf(table, filter);
  report(name, 'cleanup, 0 residu', left.length === 0, 'sisa=' + left.length);
}

if (!hasBackend()) {
  console.error('FATAL: SUPABASE_URL / key tidak terbaca dari .env.local');
  process.exit(1);
}

await testTable(
  'database_candidate',
  'database_candidate',
  ['no_wa'],
  {
    id_kandidat: 'E2EUPSERT1',
    nama_lengkap: 'E2E UPSERT A',
    no_wa: SENT_WA,
    gender: 'LAKI-LAKI',
    created_at: new Date().toISOString(),
  },
  {
    id_kandidat: 'E2EUPSERT1B',
    nama_lengkap: 'E2E UPSERT B',
    no_wa: SENT_WA,
    gender: 'PEREMPUAN',
    created_at: new Date().toISOString(),
  },
  { no_wa: 'eq.' + SENT_WA },
  (r, e) => r.nama_lengkap === e.nama_lengkap && r.gender === e.gender,
);

await testTable(
  'database_asj_form',
  'database_asj_form',
  ['no_wa,code_job'],
  {
    no_wa: SENT_WA,
    code_job: 'E2EUPSERT',
    nama_lengkap: 'E2E FORM A',
    status: 'MENUNGGU',
    created_at: new Date().toISOString(),
  },
  {
    no_wa: SENT_WA,
    code_job: 'E2EUPSERT',
    nama_lengkap: 'E2E FORM B',
    status: 'UPDATE',
    created_at: new Date().toISOString(),
  },
  { no_wa: 'eq.' + SENT_WA, code_job: 'eq.E2EUPSERT' },
  (r, e) => r.nama_lengkap === e.nama_lengkap && r.status === e.status,
);

await testTable(
  'master_database_candidate',
  'master_database_candidate',
  ['no_wa'],
  {
    id_kandidat: 'E2EUPSERT2',
    nama_lengkap: 'E2E MASTER A',
    no_wa: SENT_WA,
    gender: 'LAKI-LAKI',
    created_at: new Date().toISOString(),
  },
  {
    id_kandidat: 'E2EUPSERT2B',
    nama_lengkap: 'E2E MASTER B',
    no_wa: SENT_WA,
    gender: 'PEREMPUAN',
    created_at: new Date().toISOString(),
  },
  { no_wa: 'eq.' + SENT_WA },
  (r, e) => r.nama_lengkap === e.nama_lengkap && r.gender === e.gender,
);

await testTable(
  'pemberkasan_checklist',
  'pemberkasan_checklist',
  ['wa,tahap'],
  { wa: SENT_WA, tahap: 1, nama_lengkap: 'E2E BERKAS A', updated_at: new Date().toISOString() },
  { wa: SENT_WA, tahap: 1, nama_lengkap: 'E2E BERKAS B', updated_at: new Date().toISOString() },
  { wa: 'eq.' + SENT_WA, tahap: 'eq.1' },
  (r, e) => r.nama_lengkap === e.nama_lengkap,
);

const fails = results.filter((r) => !r.ok);
console.log('');
console.log('================ RINGKASAN ================');
console.log('PASS: ' + (results.length - fails.length) + ' | FAIL: ' + fails.length);
if (fails.length) {
  fails.forEach((f) => console.log('  GAGAL: ' + f.table + ' :: ' + f.step + ' — ' + f.detail));
  process.exit(1);
}
