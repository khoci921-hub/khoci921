import { normalizeWa, pick, supabaseJson } from './db/client';
// candidate-helpers.js — helper kandidat SHARED (dipakai lintas domain:
// auth, job, form). Dipisah dari handlers.js (Fase 1.1b) supaya tidak ada
// saling-require antar modul action.

import { findCandidateByWaFiltered, findCandidates, maxCandidateIdNumber } from './db/candidates';

// Kolom WA yang dikenali di tabel kandidat (urutan prioritas).
const CAND_WA_COLS = ['no_wa', 'wa', 'whatsapp', 'telepon', 'phone', 'no_hp'];

// ID kandidat baru ASJ<max+1> (dipusatkan di sini — dulu ada 3 salinan:
// actions-extra, actions-mail, actions-master).
async function nextCandidateId() {
  // Jalur cepat: id_kandidat tertinggi via query server-side.
  const fastMax = await maxCandidateIdNumber();
  if (fastMax !== undefined) return 'ASJ' + String(fastMax + 1).padStart(5, '0');
  // Fallback: scan penuh (perilaku lama). Sama seperti fast path, id juga
  // dipakai di master_database_candidate → ikut di-scan supaya tidak ada
  // 409 duplicate key saat INSERT master (FIX 2026-08-16).
  const found = await findCandidates();
  let max = 0;
  for (const r of found.rows) {
    const m = String(pick(r, ['id_kandidat', 'id']) || '').match(/ASJ(\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  try {
    const master = await supabaseJson('GET', 'master_database_candidate', {
      query: { select: 'id_kandidat', order: 'id_kandidat.desc', limit: '5' },
    });
    for (const r of Array.isArray(master) ? master : []) {
      const m = String(r.id_kandidat || '').match(/ASJ(\d+)/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  } catch {
    /* master tidak bisa dibaca — pakai max dari database_candidate saja */
  }
  return 'ASJ' + String(max + 1).padStart(5, '0');
}

// Cari baris kandidat berdasarkan WA (format fleksibel 0xx / 62xx).
async function findCandidateByWa(wa) {
  const want = normalizeWa(wa);
  // Jalur cepat: query server-side (filter kolom WA) — tanpa tarik 300 baris.
  const hit = await findCandidateByWaFiltered(want);
  if (hit !== undefined) return hit;
  // Fallback: scan penuh (skema kolom WA tidak dikenal).
  const found = await findCandidates();
  return found.rows.find((r) => normalizeWa(pick(r, CAND_WA_COLS) || '') === want) || null;
}

export { CAND_WA_COLS, findCandidateByWa, nextCandidateId };
