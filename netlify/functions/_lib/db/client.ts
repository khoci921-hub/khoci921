import { env } from '../env.ts';
import { normalizeWa } from '../../../../shared/wa-rules.ts';
// db/client.js — klien REST Supabase (PostgREST) + normalisasi data.
// perilaku TIDAK berubah.

// Aturan WA (normalisasi + gate) — satu sumber kebenaran: shared/wa-rules.js
// (dipakai frontend js/04_auth.js juga). Jangan definisikan ulang di sini.

/** @typedef {{ query?: Record<string, string | number>, headers?: Record<string, string>, body?: unknown }} JsonOpts */
/** @typedef {{ rows: Record<string, unknown>[], total: number }} PagedResult */
/** @typedef {{ table: string | null, rows: Record<string, unknown>[] }} FindTableResult */
/** @typedef {{ paths?: Record<string, unknown>, components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> } }} OpenApiSpec */

/** @returns {string} */
function supabaseUrl() {
  return env('SUPABASE_URL');
}

/** @returns {string} */
function supabaseKey() {
  return env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY') || env('SUPABASE_KEY');
}

/** @returns {boolean} */
function hasBackend() {
  return !!(supabaseUrl() && supabaseKey());
}

// FIX #15 (audit 2026-09-02): Timeout 8 detik pada semua fetch Supabase.
// Tanpa timeout, response lambat/tergantung memegang function sampai platform
// timeout (10s/26s di Netlify) → pool habis → endpoint lain (termasuk ping)
// ikut gagal. 8 detik cukup untuk query normal tapi masih di bawah platform limit.
const FETCH_TIMEOUT_MS = 8_000;

/** @param {string} method @param {string} pathname @param {JsonOpts} [opts] @returns {Promise<unknown>} */
async function supabaseJson(method, pathname, opts = {}) {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) throw new Error('SUPABASE_URL / key belum dikonfigurasi');
  // @ts-expect-error JS→TS migration
  const qs = opts.query
    ? '?' +
      // @ts-expect-error JS→TS migration
      new URLSearchParams(Object.entries(opts.query).map(([k, v]) => [k, String(v)])).toString()
    : '';
  const res = await fetch(url.replace(/\/$/, '') + '/rest/v1/' + pathname + qs, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      // @ts-expect-error JS→TS migration
      ...(opts.headers || {}),
    },
    // @ts-expect-error JS→TS migration
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(pathname + ' → HTTP ' + res.status + ' ' + text.slice(0, 200));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// UPSERT via PostgREST: INSERT dengan resolution=merge-duplicates + on_conflict.
// Kalau baris dengan kolom konflik sudah ada (unique index), UPDATE baris lama
// alih-alih error 409 duplicate key — duplikasi tidak mungkin & user tidak
// melihat error. Butuh unique index di kolom konflik (lihat
// migrations/20260825_index_antiduplikat.sql SECTION 4).
/** @param {string} table @param {Record<string, unknown>} row @param {string[]} conflictCols @param {JsonOpts} [opts] @returns {Promise<unknown>} */
async function supabaseUpsert(
  table: string,
  row: Record<string, unknown>,
  conflictCols: string[],
  opts: {
    query?: Record<string, string | number>;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<unknown> {
  const cols = conflictCols.join(',');
  try {
    return await supabaseJson('POST', table, {
      ...opts,
      body: row,
      query: { ...(opts.query || {}), on_conflict: cols },
      // Gabung Prefer pemanggil (mis. return=minimal) dengan resolution upsert.
      headers: {
        ...(opts.headers || {}),
        Prefer:
          ((opts.headers && opts.headers.Prefer) || 'return=minimal') +
          ',resolution=merge-duplicates',
      },
    });
  } catch (e) {
    // 42P10 = unique index di kolom konflik belum ada di DB
    // (migrations/20260825_index_antiduplikat.sql SECTION 4 belum dijalankan).
    // Fallback INSERT biasa — perilaku lama, race paralel tetap bisa dobel
    // tapi tidak melempar error baru. Error lain diteruskan.
    if (!String((e && e.message) || '').includes('42P10')) throw e;
    return supabaseJson('POST', table, {
      ...opts,
      body: row,
      headers: { ...(opts.headers || {}), Prefer: 'return=minimal' },
    });
  }
}

// Query paginated via header Range + total dari Content-Range. Tempat TUNGGAL
// untuk fetch REST dengan Range — pemakai: fetchPagedAll (candidates.js) &
// queryPaged (misc.js). supabaseJson biasa tidak bisa dipakai di sini (butuh
// header Range/Prefer + baca Content-Range, bukan auto-JSON + throw).
/** @param {string} table @param {string} [qs] @param {{ start?: number, end?: number }} [range] @returns {Promise<PagedResult>} */
// @ts-expect-error JS→TS migration
async function supabasePaged(table, qs, { start, end } = {}) {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) throw new Error('SUPABASE_URL / key belum dikonfigurasi');
  const res = await fetch(url.replace(/\/$/, '') + '/rest/v1/' + table + (qs ? '?' + qs : ''), {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Range: (start ?? 0) + '-' + (end ?? 999),
      Prefer: 'count=exact',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(table + ' → HTTP ' + res.status + ' ' + (await res.text()).slice(0, 150));
  }
  const rows = await res.json();
  const cr = res.headers.get('content-range') || '';
  const total = parseInt(String(cr).split('/')[1] || '0', 10) || rows.length;
  return { rows, total };
}

// FIX #12 (audit 2026-09-02): Memoize skema tabel — skema tidak berubah
// di runtime, jadi probe berulang membakar 2-3 RTT percuma (~600-1500ms).
// Cache per kombinasi (candidates.join, limit) supaya berbagai caller tidak
// saling ganggu. TTL 5 menit (skema jarang berubah tapi ingin graceful
// kalau tabel baru ditambah admin).
const TABLE_CACHE = new Map();
const TABLE_CACHE_TTL_MS = 5 * 60 * 1000;

// Coba daftar nama tabel sampai satu yang benar-benar ada & mengembalikan baris.
/** @param {string[]} candidates @param {number} [limit] @returns {Promise<FindTableResult>} */
async function findTable(candidates, limit = 300) {
  const key = candidates.join(':') + '|' + limit;
  const cached = TABLE_CACHE.get(key);
  if (cached && Date.now() - cached.at < TABLE_CACHE_TTL_MS) return cached.result;
  for (const t of candidates) {
    try {
      const rows = await supabaseJson('GET', t, {
        query: { select: '*', limit },
      });
      if (Array.isArray(rows)) {
        const result = { table: t, rows };
        TABLE_CACHE.set(key, { result, at: Date.now() });
        return result;
      }
    } catch {
      /* coba tabel berikutnya */
    }
  }
  const result = { table: null, rows: [] };
  TABLE_CACHE.set(key, { result, at: Date.now() });
  return result;
}

// Invalidate cache skema (dipanggil saat tabel baru dibuat/dihapus).
function invalidateTableCache() {
  TABLE_CACHE.clear();
}

/** @param {Record<string, unknown>} row @param {string[]} keys @returns {unknown} */
function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return null;
}

/** @param {unknown} v @returns {string} */
function toText(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// Normalisasi nomor WA Indonesia: "0821..." -> "62821...", "+62821..." -> "62821...".
// Status asli di DB campur: "✅ OPEN", "❌ CLOSE", "SELESAI / CLOSE",
// "PENCARIAN KANDIDAT", "PEMBERKASAN", "APPROVED", "" — yang berarti masih
// rekrutmen hanya yang eksplisit tertutup; sisanya dianggap OPEN.
/** @param {unknown} v @returns {'OPEN'|'CLOSE'|'URGENT'} */
function normalizeStatus(v) {
  const s = toText(v).toUpperCase();
  if (s.includes('URGENT')) return 'URGENT';
  if (s === '') return 'CLOSE';
  if (s.includes('CLOSE') || s.includes('TUTUP') || s.includes('SELESAI')) {
    return 'CLOSE';
  }
  return 'OPEN';
}

// SATU-SATUNYA normalisasi gender backend — disamakan dengan kanonikal situs
// lama (normalizeGenderValue di js/03_candidate.js): LAKI-LAKI / PEREMPUAN.
// CV AI dan render L/P mengecek format ini (includes('PEREMPUAN') dsb), jadi
// jangan tambah varian normalisasi lain di jalur mana pun.
/** @param {unknown} v @returns {'LAKI-LAKI'|'PEREMPUAN'|''} */
function normalizeGender(v) {
  const s = toText(v).trim().toUpperCase();
  if (!s || s === '-') return '';
  if (s === 'L' || s === 'LK' || s === 'M' || s === 'PRIA' || s === 'MALE' || s.includes('LAKI'))
    return 'LAKI-LAKI';
  if (
    s === 'P' ||
    s === 'PR' ||
    s === 'F' ||
    s === 'W' ||
    s === 'FEMALE' ||
    s === 'WANITA' ||
    s === 'CEWEK' ||
    s.includes('PEREMPUAN') ||
    s.includes('女')
  )
    return 'PEREMPUAN';
  return '';
}

// Baca skema OpenAPI (daftar tabel + kolom) — dipakai untuk penemuan tabel
// adaptif saat nama tabel tidak cocok dengan tebakan.
/** @returns {Promise<OpenApiSpec | null>} */
async function getSchema() {
  if (!hasBackend()) return null;
  try {
    return await supabaseJson('GET', '', {});
  } catch {
    return null;
  }
}

/** @param {OpenApiSpec} spec @returns {string[]} */
function tablesFromSchema(spec) {
  if (!spec || !spec.paths) return [];
  return Object.keys(spec.paths)
    .map((p) => p.replace(/^\//, ''))
    .filter(Boolean);
}

/** @param {OpenApiSpec} spec @param {string} table @returns {string[]} */
function columnsFromSchema(spec, table) {
  if (!spec || !spec.components || !spec.components.schemas) return [];
  const s = spec.components.schemas[table];
  return s && s.properties ? Object.keys(s.properties) : [];
}

export {
  supabaseUrl,
  supabaseKey,
  hasBackend,
  supabaseJson,
  supabaseUpsert,
  supabasePaged,
  findTable,
  invalidateTableCache,
  pick,
  toText,
  normalizeWa,
  normalizeStatus,
  normalizeGender,
  getSchema,
  tablesFromSchema,
  columnsFromSchema,
};
