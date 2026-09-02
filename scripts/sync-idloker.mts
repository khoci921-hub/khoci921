// =============================================================================
// sync-idloker.mjs — Sinkronkan id_loker_pilihan kandidat (database_candidate)
// agar konsisten dengan lamaran LULUS terbaru di mail (database_asj_form).
// -----------------------------------------------------------------------------
// Alur: untuk SETIAP kandidat, cari lamaran berstatus LULUS di mail per WA.
//   - Ada lamaran LULUS  → set id_loker_pilihan = code_job lamaran LULUS TERBARU
//   - Tidak ada LULUS    → id_loker_pilihan TIDAK disentuh (biarkan manual)
// Aman: dry-run secara default (hanya mencetak rencana). Jalankan dengan
// `--apply` untuk menulis ke database.
//   bun run scripts/sync-idloker.mjs            # dry-run
//   bun run scripts/sync-idloker.mjs --apply    # eksekusi
// =============================================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizeWa, pick, supabaseJson } = require('../netlify/functions/_lib/db/client');
const { findForms } = require('../netlify/functions/_lib/db/forms');
const { findCandidates } = require('../netlify/functions/_lib/db/candidates');

const APPLY = process.argv.includes('--apply');

const [forms, cands] = await Promise.all([findForms(), findCandidates()]);

// Index lamaran LULUS per WA, urut timestamp terbaru dulu.
const byWa = new Map();
for (const f of forms) {
  const w = normalizeWa(String(f.no_wa || f.wa || f.whatsapp || ''));
  const code = String(f.code_job || '').trim();
  if (!w || !code) continue;
  if (String(f.status || '').toUpperCase() !== 'LULUS') continue;
  if (!byWa.has(w)) byWa.set(w, []);
  byWa.get(w).push({ ts: String(f.timestamp || f.created_at || ''), code });
}
for (const arr of byWa.values()) arr.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

let changed = 0;
let skipped = 0;
const report = [];

for (const r of cands.rows) {
  const w = normalizeWa(
    String(pick(r, ['no_wa', 'wa', 'whatsapp', 'telepon', 'phone', 'no_hp']) || ''),
  );
  if (!w) {
    skipped++;
    continue;
  }
  const lulus = byWa.get(w);
  if (!lulus || lulus.length === 0) {
    skipped++; // tidak ada lamaran LULUS → biarkan id_loker manual
    continue;
  }
  const latest = lulus[0].code;
  const cur = String(pick(r, ['id_loker_pilihan', 'id_loker']) || '').trim();
  if (cur === latest) {
    skipped++; // sudah konsisten
    continue;
  }
  report.push({
    id: r.id,
    nama: String(r.nama_lengkap || '').slice(0, 32),
    wa: w,
    dari: cur || '-',
    ke: latest,
  });
  changed++;
  if (APPLY) {
    await supabaseJson('PATCH', 'database_candidate', {
      query: { id: 'eq.' + r.id },
      body: { id_loker_pilihan: latest, updated_at: new Date().toISOString() },
      headers: { Prefer: 'return=minimal' },
    });
  }
}

for (const x of report) {
  console.log(`  ${x.id} | ${x.nama} | WA ${x.wa} | ${x.dari} -> ${x.ke}`);
}
console.log(
  `\n${APPLY ? '✅ DIAPPLY' : '⏸ DRY-RUN (pakai --apply untuk eksekusi)'} — ${changed} kandidat diperbarui, ${skipped} tidak disentuh (sudah konsisten / tanpa lamaran LULUS).`,
);
process.exit(0);
