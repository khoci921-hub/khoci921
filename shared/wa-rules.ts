// =============================================================================
// shared/wa-rules.js — SATU-SATUNYA sumber kebenaran aturan nomor WA.
// -----------------------------------------------------------------------------
// Dipakai DUA runtime:
//   - Backend : netlify/functions/_lib/db/client.js (require) → re-export
//               ke semua actions-* / ai / candidate-helpers (19 pemakai).
//   - Frontend: js/04_auth.js (import via esbuild bundle).
// JANGAN menambah varian normalisasi/gate WA di jalur lain — ini lock kandidat
// (AGENTS.md §3 & §6). Kasus SATRIA (2026-08-15): WA typo menciptakan kandidat
// duplikat; gate ketat 628… mencegahnya terulang.
// =============================================================================

// Normalisasi: buang non-digit, 0xx → 62xx, 8xx → 628xx. Format baku 628…
// (12-13 digit). Cabang 8xx dipakai frontend sejak awal (UX: pengguna boleh
// ketik tanpa nol di depan) — disatukan di sini supaya backend & frontend
// konsisten.
function normalizeWa(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}

// Gate login/daftar: hanya nomor HP Indonesia (62 + 8xx, total 12-13 digit).
function isValidWaFormat(wa) {
  return /^628\d{9,11}$/.test(normalizeWa(wa));
}

export { normalizeWa, isValidWaFormat };
