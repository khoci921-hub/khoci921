import crypto from 'crypto';
import { env } from './env';
// session.js — token sesi bertanda tangan (HMAC-SHA256).
//
// Pengganti "createSession" di auth.ts asli. Token { role, wa?, name?,
// exp, iat } ditandatangani dengan secret dari env; semua aksi admin/
// kandidat memvalidasinya kembali. Tidak ada penyimpanan status server-side.
//
// FIX #4 (audit 2026-09-02): Token sekarang punya exp (expiry) dan iat
// (issued-at). Admin TTL = 2 jam, kandidat = 24 jam. Refresh token = 30
// hari (dipakai hanya untuk auto-login persist, bukan aksi langsung).
// FIX #5: Secret wajib di-set di production; PIN tidak lagi dipakai sebagai
// HMAC key (terlalu rendah entropy, bisa brute-force offline dari token).

/** @typedef {{ role: string, wa?: string, name?: string, kind?: string, exp?: number, iat?: number }} SessionPayload */

// TTL per role (ms)
const ADMIN_TTL_MS  = 2 * 60 * 60 * 1000;    // 2 jam
const CANDIDATE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 jam
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

/** @returns {string} */
function secret() {
  // FIX #5: Hanya pakai SESSION_SECRET (64-hex, tinggi entropy). Jangan
  // turunkan dari PIN / password — mereka terlalu rendah entropy untuk
  // jadi HMAC key (brute-force offline dari satu token tertangkap).
  const s = env('SESSION_SECRET') || env('ADMIN_PASSWORD') || env('ASJ_ADMIN_PASSWORD');
  // Fail closed di production — jangan pernah pakai secret hardcoded.
  if (!s && (env('NODE_ENV') === 'production' || env('NETLIFY') === 'true')) {
    throw new Error('SESSION_SECRET wajib di-set di production (Netlify → Site → Environment variables)');
  }
  return s || 'dev-only-insecure-secret';
}

/** @param {SessionPayload} payload @returns {string} */
function signToken(payload) {
  const now = Date.now();
  // Tentukan TTL berdasarkan role + kind
  let ttl = ADMIN_TTL_MS;
  if (payload.kind === 'refresh') {
    ttl = REFRESH_TTL_MS;
  } else if (payload.role === 'kandidat') {
    ttl = CANDIDATE_TTL_MS;
  }
  // Tambahkan exp & iat ke payload (jika belum ada)
  const enriched: Record<string, any> = Object.assign({}, payload);
  if (!enriched.iat) enriched.iat = now;
  if (!enriched.exp) enriched.exp = now + ttl;
  const body = Buffer.from(JSON.stringify(enriched)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}

/** @param {string} token @returns {SessionPayload | null} */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    // FIX #4: Reject expired tokens. Token tanpa exp (legacy) tetap diterima
    // supaya transisi tidak memaksa semua user login ulang sekaligus.
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export { signToken, verifyToken };
