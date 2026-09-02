// @ts-nocheck
// =============================================================================
// dedupe-rules.mjs — ATURAN MERGE kandidat duplikat (fungsi murni, no side-effect)
// -----------------------------------------------------------------------------
// Dipakai scripts/dedupe-duplicates.mjs (CLI dry-run/--apply). Dipisah supaya
// aturan yang melindungi data asli (status LULUS tidak hilang, ai_data_json
// deep-merge newest-wins, tag [VIP] tidak hilang) bisa di-unit-test.
// Normalisasi WA memakai shared/wa-rules.js (satu sumber kebenaran).
// =============================================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { normalizeWa } from '../shared/wa-rules.ts';

// ---- Strategi memilih baris penjaga ------------------------------------------
const FORM_PRIO = {
  LULUS: 6,
  LOLOS: 6,
  APPROVED: 6,
  APPROVE: 6,
  GAGAL: 5,
  TOLAK: 5,
  REJECTED: 5,
  REJECT: 5,
  'REVIEW ADMIN': 4,
  REVIEW: 4,
  UPDATE: 3,
  UPDATED: 3,
  PROSES: 3,
  MENUNGGU: 1,
  MAIL: 1,
  BARU: 1,
  PENDING: 1,
};
function formPrio(r) {
  const s = String(r.status || 'MENUNGGU')
    .trim()
    .toUpperCase();
  return FORM_PRIO[s] !== undefined ? FORM_PRIO[s] : 0;
}
function tsOf(r) {
  return String(r.updated_at || r.created_at || r.timestamp || '');
}
function pickKeeper(rows, opts = {}) {
  return [...rows].sort((a, b) => {
    const pa = opts.prio ? opts.prio(a) : 0;
    const pb = opts.prio ? opts.prio(b) : 0;
    if (pa !== pb) return pb - pa;
    const ta = tsOf(a),
      tb = tsOf(b);
    if (ta !== tb) return ta > tb ? -1 : 1;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  })[0];
}

// ---- Fuzzy merge: WA typo (nama sama + digit hampir sama) ----------------------
// normalizeWa hanya mencocokkan digit persis. Ada duplikat warisan yang WA-nya
// beda sedikit karena typo (mis. 6282342782945 vs 622342782945 — kehilangan
// digit '8'). Kalau nama lengkapnya identik DAN jarak edit kedua WA <= 2,
// perlakukan sebagai kandidat yang sama dan gabung jadi 1 baris.
function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[m][n];
}
const normNameKey = (v) =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
const waDigits = (r) => normalizeWa((r && (r.no_wa || r.wa)) || '');
// Pilih WA "kanonik" dari sekumpulan WA yang mirip: preferensi awalan 628
// (nomor HP) lalu digit terbanyak — angka yang benar biasanya 13 digit 628xx.
function preferWa(was) {
  const score = (w) => (w.startsWith('628') ? 2 : 0) + w.length;
  return [...was].sort((a, b) => score(b) - score(a))[0];
}
// Gabung grup yang WA-nya typo: union-find di atas nama + jarak edit WA.
function fuzzyCluster(groups) {
  const keys = [...groups.keys()];
  const parent = new Map(keys.map((k) => [k, k]));
  const find = (k) => {
    while (parent.get(k) !== k) {
      parent.set(k, parent.get(parent.get(k)));
      k = parent.get(k);
    }
    return k;
  };
  const byName = new Map();
  for (const k of keys) {
    const n = normNameKey(groups.get(k)[0].nama_lengkap);
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(k);
  }
  for (const ks of byName.values()) {
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = waDigits(groups.get(ks[i])[0]);
        const b = waDigits(groups.get(ks[j])[0]);
        if (a && b && a !== b && levenshtein(a, b) <= 2) {
          const ra = find(ks[i]);
          const rb = find(ks[j]);
          if (ra !== rb) parent.set(rb, ra);
        }
      }
    }
  }
  const out = new Map();
  for (const k of keys) {
    const r = find(k);
    if (!out.has(r)) out.set(r, []);
    for (const row of groups.get(k)) out.get(r).push(row);
  }
  // Baris yang sama (id kembar) tidak boleh dobel di dalam satu grup.
  for (const [r, rowsArr] of out) {
    const seen = new Map();
    for (const row of rowsArr) seen.set(row.id, row);
    out.set(r, [...seen.values()]);
  }
  return out;
}
// Kolom WA dibetulkan ke format kanonik kalau grup punya >1 WA (fuzzy typo).
function fixWaKeeper(keeper, dups, body) {
  const was = [...new Set([keeper, ...dups].map(waDigits).filter(Boolean))];
  if (was.length > 1) {
    const pw = preferWa(was);
    if (waDigits(keeper) !== pw) body.no_wa = pw;
  }
  return body;
}

// ---- Penggabung kolom ---------------------------------------------------------
const nonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== '';
// Kolom yang "diisi dari baris lain kalau penjaga kosong" (dokumen/data utama).
function mergeFill(keeper, dups, cols) {
  const body = {};
  let changed = false;
  for (const col of cols) {
    if (nonEmpty(keeper[col])) continue;
    for (const d of dups) {
      if (nonEmpty(d[col])) {
        body[col] = d[col];
        changed = true;
        break;
      }
    }
  }
  return { body, changed };
}
// ai_data_json (jsonb) — SNAPSHOT bertingkat: setiap submit membawa state form
// yang makin lengkap. JANGAN pakai fill-if-empty (baris penjaga dipilih by
// STATUS, bisa jadi snapshot PALING TUA → data hilang). Deep-merge semua
// snapshot, newest-wins per leaf; array: snapshot terbaru yang non-kosong.
const isEmptyVal = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
function mergeJsonDeep(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (isEmptyVal(v)) continue;
    const tv = target[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (tv && typeof tv === 'object' && !Array.isArray(tv)) {
        mergeJsonDeep(tv, v);
      } else {
        target[k] = JSON.parse(JSON.stringify(v));
      }
    } else if (Array.isArray(v)) {
      if (v.length > 0) target[k] = JSON.parse(JSON.stringify(v));
      else if (tv === undefined) target[k] = [];
    } else if (isEmptyVal(tv)) {
      target[k] = v;
    } else {
      target[k] = v; // keduanya terisi → yang terbaru menang
    }
  }
  return target;
}
function mergeAiJson(rows) {
  const withAi = rows.filter((r) => r && r.ai_data_json);
  if (withAi.length === 0) return null;
  withAi.sort((a, b) => (tsOf(a) > tsOf(b) ? 1 : -1));
  let merged = {};
  for (const r of withAi) {
    let j = r.ai_data_json;
    if (typeof j === 'string') {
      try {
        j = JSON.parse(j);
      } catch (e) {
        continue;
      }
    }
    if (!j || typeof j !== 'object') continue;
    merged = mergeJsonDeep(merged, j);
  }
  return Object.keys(merged).length ? merged : null;
}
// Kolom biodata: ambil nilai TERBARU yang terisi di semua baris grup (bukan
// "penjaga dulu baru isi sisanya") — penjaga dipilih by status, belum tentu
// snapshot biodata terbaru.
function mergeFillLatest(rows, cols) {
  const body = {};
  let changed = false;
  const sorted = [...rows].sort((a, b) => (tsOf(a) > tsOf(b) ? 1 : -1));
  for (const col of cols) {
    const latest = [...sorted].reverse().find((r) => nonEmpty(r[col]));
    if (latest && String(latest[col]) !== String(rows[0][col])) {
      body[col] = latest[col];
      changed = true;
    }
  }
  return { body, changed };
}

// keterangan "NAMA:URL;NAMA2:URL2;..." — gabungkan kamus dokumen semua baris.
function mergeDocs(keeper, dups) {
  const docs = {};
  for (const r of [keeper, ...dups]) {
    String(r.keterangan || '')
      .split(';')
      .forEach((chunk) => {
        const i = chunk.indexOf(':');
        if (i > 0) docs[chunk.slice(0, i).trim().toUpperCase()] = chunk.slice(i + 1).trim();
      });
  }
  const out = Object.entries(docs)
    .filter(([, v]) => v)
    .map(([k, v]) => k + ':' + v)
    .join(';');
  return out === String(keeper.keterangan || '') ? null : out;
}
// feedback_berkas "[UPLOAD KTP] · [BIODATA] ..." — gabung unik, urutan penjaga dulu.
function mergeFeedback(keeper, dups) {
  const items = [];
  const seen = new Set();
  for (const r of [keeper, ...dups]) {
    String(r.feedback_berkas || '')
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        if (!seen.has(s)) {
          seen.add(s);
          items.push(s);
        }
      });
  }
  const out = items.join(' · ');
  return out === String(keeper.feedback_berkas || '').trim() ? null : out;
}
// catatan_internal kandidat — tag "[VIP]" / "[KELAS X]" digabung unik (tidak
// boleh hilang saat merge!), teks bebas diambil dari penjaga / baris lain.
function mergeCatatanInternal(keeper, dups) {
  const tags = [];
  const seenTag = new Set();
  const grab = (c) => String(c || '');
  for (const r of [keeper, ...dups]) {
    for (const t of grab(r.catatan_internal).match(/\[[^\]]+\]/g) || []) {
      if (!seenTag.has(t)) {
        seenTag.add(t);
        tags.push(t);
      }
    }
  }
  const freeTextOf = (c) =>
    grab(c)
      .replace(/\[[^\]]+\]\s*/g, '')
      .trim();
  let freeText = freeTextOf(keeper.catatan_internal);
  if (!freeText) {
    for (const d of dups) {
      freeText = freeTextOf(d.catatan_internal);
      if (freeText) break;
    }
  }
  const out = [...tags, freeText].filter(Boolean).join(' ').trim();
  return out === grab(keeper.catatan_internal).trim() ? null : out;
}

export {
  FORM_PRIO,
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
  isEmptyVal,
  mergeJsonDeep,
  mergeAiJson,
  mergeFillLatest,
  mergeDocs,
  mergeFeedback,
  mergeCatatanInternal,
};
