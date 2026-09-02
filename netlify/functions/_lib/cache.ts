// cache.js — TTL cache in-memory sederhana (satu proses function).
//
// Dipakai untuk data PUBLIK yang identik untuk semua user (jobs/dropdowns/
// assets/pengumuman) supaya request berikutnya tidak perlu roundtrip ke
// Supabase. Cache per-instance function (Netlify: per warm instance; preview:
// 1 proses) — cukup untuk skala ASJ, tanpa Redis.

const store = new Map();
const DEFAULT_TTL_MS = 20_000;
const MAX_ENTRIES = 50;

function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (store.size >= MAX_ENTRIES) {
    // Evict entri paling tua (Map mempertahankan urutan insert).
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function cacheClear() {
  store.clear();
}

// FIX #31/#35: Hapus cache spesifik (bukan semua).
// Dipakai saat jadwal/tugas/templates diubah — tidak perlu buang
// cache kandidat/public yang masih fresh.
function cacheClearKey(key) {
  store.delete(key);
}

export { cacheGet, cacheSet, cacheClear, cacheClearKey };
