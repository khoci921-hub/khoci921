// rate-limit.js — rate limiter in-memory (satu instance function/process).
//
// Implementasi paling sederhana tanpa infra baru (sesuai REVIEW.md M3):
//   Map<key, { count, fails, resetAt, lockUntil, lastAccess }> dengan window bergulir.
// Cukup untuk satu instance Netlify function / proses preview; kalau butuh
// akurat lintas instance, pindahkan ke Supabase/Redis.
//
// API:
//   check(key, { limit, windowMs, lockoutAfter, lockoutMs })
//     → { ok: true } atau { ok: false, retryAfter, locked }
//   fail(key, { lockoutAfter, lockoutMs }) — catat kegagalan (mis. PIN salah);
//     setelah `lockoutAfter` kegagalan dalam window → lockout `lockoutMs`.
//
// FIX #7 (audit 2026-09-02): Map bisa tumbuh tanpa batas jika semua bucket
// masih aktif — prune() hanya hapus bucket expired, bukan LRU. Sekarang:
//   1. Hapus semua bucket expired (resetAt < now && lockUntil < now)
//   2. Kalau masih penuh → evict bucket PALING TUA (lastAccess terkecil)
//   3. getBucket() tidak pernah return undefined (selalu return valid bucket)

/** @typedef {{ count: number, fails: number, resetAt: number, lockUntil: number, lastAccess: number }} Bucket */
/** @typedef {{ limit?: number, windowMs?: number, lockoutAfter?: number, lockoutMs?: number }} RateLimitOpts */
/** @typedef {{ ok: true, retryAfter?: undefined, locked?: undefined } | { ok: false, retryAfter: number, locked?: boolean }} RateLimitResult */

/** @type {Map<string, Bucket>} */
const buckets = new Map();
const MAX_BUCKETS = 20000;

// FIX #7: Prune expired buckets first; if still full, evict oldest (LRU).
// Prevents unbounded Map growth under sustained unique-IP attack.
/** @param {number} now */
function prune(now) {
  if (buckets.size < MAX_BUCKETS) return;
  // 1. Remove all expired buckets (both window and lockout passed).
  for (const [k, b] of buckets) {
    if (b.resetAt < now && b.lockUntil < now) buckets.delete(k);
  }
  // 2. If still at capacity, evict the oldest bucket (LRU) to make room.
  if (buckets.size >= MAX_BUCKETS) {
    let oldestKey = null;
    let oldestAccess = Infinity;
    for (const [k, b] of buckets) {
      if (b.lastAccess < oldestAccess) {
        oldestAccess = b.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey !== null) buckets.delete(oldestKey);
  }
}

/** @param {string} key @param {number} now @returns {Bucket} */
function getBucket(key, now) {
  let b = buckets.get(key);
  if (!b) {
    b = { count: 0, fails: 0, resetAt: now, lockUntil: 0, lastAccess: now };
    // FIX #7: Ensure room before inserting. If prune can't free space,
    // it evicts the oldest entry. This guarantees the Map never grows
    // beyond MAX_BUCKETS + 1 (the new entry before prune runs).
    if (buckets.size >= MAX_BUCKETS) prune(now);
    buckets.set(key, b);
  } else {
    b.lastAccess = now;
  }
  return b;
}

/** @param {string} key @param {RateLimitOpts} opts @returns {RateLimitResult} */
function check(key, opts) {
  const now = Date.now();
  const limit = opts.limit || 5;
  const windowMs = opts.windowMs || 60000;
  const b = getBucket(key, now);

  if (b.lockUntil > now) {
    return { ok: false, retryAfter: Math.ceil((b.lockUntil - now) / 1000), locked: true };
  }
  if (now >= b.resetAt) {
    b.resetAt = now + windowMs;
    b.count = 0;
    b.fails = 0;
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true };
}

/** @param {string} key @param {RateLimitOpts} opts @returns {void} */
function fail(key, opts) {
  const now = Date.now();
  const windowMs = opts.windowMs || 60000;
  const lockoutAfter = opts.lockoutAfter || 0;
  const lockoutMs = opts.lockoutMs || 0;
  const b = getBucket(key, now);
  if (now >= b.resetAt) {
    b.resetAt = now + windowMs;
    b.count = 0;
    b.fails = 0;
  }
  b.fails += 1;
  if (lockoutAfter > 0 && b.fails >= lockoutAfter) {
    b.lockUntil = now + lockoutMs;
    b.fails = 0;
  }
}

// FIX #7: Expose clear function for tests (reset module-level state).
function _clearForTests() {
  buckets.clear();
}

export { check, fail, _clearForTests };
