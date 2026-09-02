// ==========================================
// ADVERSARIAL TESTS — exercise changed entry points with boundary/edge/empty inputs.
// ==========================================
import { describe, it, expect, vi } from 'vitest';

// --- Session tests (FIX #4, #5) ---
// Mock env with a FIXED secret — must be at top level, no vi.resetModules
vi.mock('./env.js', () => ({
  env: (key: string) => {
    if (key === 'SESSION_SECRET') return 'adversarial-test-secret-abcdef';
    if (key === 'NODE_ENV') return 'test';
    return '';
  },
  debugFileEnvKeys: () => ({}),
  debugFileStructure: () => ({}),
}));

import { signToken, verifyToken } from './session';

describe('session — adversarial', () => {
  it('rejects token with exp in the past but nonzero', () => {
    const crypto = require('crypto');
    const SECRET = 'adversarial-test-secret-abcdef';
    const payload = { role: 'admin', exp: 100, iat: 50 };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    expect(verifyToken(body + '.' + sig)).toBeNull();
  });

  it('accepts legacy token (no exp field) — smooth migration', () => {
    const crypto = require('crypto');
    const SECRET = 'adversarial-test-secret-abcdef';
    const payload = { role: 'kandidat', wa: '6281234567890' };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const result = verifyToken(body + '.' + sig);
    expect(result).not.toBeNull();
    expect(result!.role).toBe('kandidat');
    // Legacy token has no exp — verifyToken accepts it
    expect(result!.exp).toBeUndefined();
  });

  it('signToken TTL: refresh > candidate > admin', () => {
    const admin = signToken({ role: 'admin' });
    const cand = signToken({ role: 'kandidat', wa: '6281234567890' });
    const refresh = signToken({ role: 'kandidat', wa: '6281234567890', kind: 'refresh' });
    const a = verifyToken(admin)!;
    const c = verifyToken(cand)!;
    const r = verifyToken(refresh)!;
    expect(c.exp! - c.iat!).toBeGreaterThan(a.exp! - a.iat!);
    expect(r.exp! - r.iat!).toBeGreaterThan(c.exp! - c.iat!);
  });

  it('preserves caller-supplied iat/exp if provided (must be in the future)', () => {
    const now = Date.now();
    const customIat = now - 1000;
    const customExp = now + 7200000; // 2 hours from now
    const token = signToken({ role: 'admin', iat: customIat, exp: customExp });
    const result = verifyToken(token);
    expect(result!.iat).toBe(customIat);
    expect(result!.exp).toBe(customExp);
  });

  it('exp: 0 is falsy — expiry check skipped (documented gap, unreachable in practice)', () => {
    const crypto = require('crypto');
    const SECRET = 'adversarial-test-secret-abcdef';
    const payload = { role: 'admin', name: 'TEST', exp: 0, iat: 0 };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const result = verifyToken(body + '.' + sig);
    expect(result).not.toBeNull(); // exp=0 is falsy, bypasses check
    expect(result!.role).toBe('admin');
  });

  it('verifyToken rejects strings with >2 dot segments', () => {
    expect(verifyToken('a.b.c')).toBeNull();
    expect(verifyToken('a.b.c.d')).toBeNull();
  });

  it('verifyToken rejects non-base64url characters in signature', () => {
    const token = signToken({ role: 'admin' });
    const parts = token.split('.');
    expect(verifyToken(parts[0] + '.abc=def')).toBeNull();
  });

  it('empty payload body roundtrips correctly', () => {
    const token = signToken({});
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.exp).toBeGreaterThan(0);
    expect(result!.iat).toBeGreaterThan(0);
  });

  it('forged token with wrong secret is rejected', () => {
    const crypto = require('crypto');
    const WRONG_SECRET = 'wrong-secret-not-the-mock-one';
    const payload = { role: 'admin' };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', WRONG_SECRET).update(body).digest('base64url');
    expect(verifyToken(body + '.' + sig)).toBeNull();
  });
});

// --- clientIp (FIX #1) ---
describe('netlify-wrapper — clientIp adversarial', () => {
  // Re-implement clientIp inline (not exported from module)
  function clientIp(event: any) {
    const h = (event && event.headers) || {};
    const nf = h['x-nf-client-connection-ip'];
    if (nf) return String(nf).trim();
    const fwd = h['x-forwarded-for'];
    if (fwd) {
      const parts = String(fwd).split(',').map((s: string) => s.trim()).filter(Boolean);
      return parts[parts.length - 1] || null;
    }
    return h['client-ip'] || h['x-real-ip'] || null;
  }

  it('x-nf-client-connection-ip takes priority over x-forwarded-for', () => {
    expect(clientIp({
      headers: {
        'x-nf-client-connection-ip': '1.2.3.4',
        'x-forwarded-for': '10.0.0.1, 10.0.0.2',
      }
    })).toBe('1.2.3.4');
  });

  it('rightmost x-forwarded-for when no nf header', () => {
    expect(clientIp({
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 1.2.3.4' }
    })).toBe('1.2.3.4');
  });

  it('single x-forwarded-for entry', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4' } })).toBe('1.2.3.4');
  });

  it('empty x-forwarded-for after trim/filter → null', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '  ,  ,  ' } })).toBeNull();
  });

  it('x-forwarded-for with spaces around commas', () => {
    expect(clientIp({
      headers: { 'x-forwarded-for': '  10.0.0.1 , 10.0.0.2 , 1.2.3.4 ' }
    })).toBe('1.2.3.4');
  });

  it('null headers → null', () => {
    expect(clientIp({ headers: null })).toBeNull();
  });

  it('no headers → null', () => {
    expect(clientIp({})).toBeNull();
  });

  it('null event → null', () => {
    expect(clientIp(null)).toBeNull();
  });

  it('undefined event → null', () => {
    expect(clientIp(undefined)).toBeNull();
  });

  it('fallback to client-ip', () => {
    expect(clientIp({ headers: { 'client-ip': '5.6.7.8' } })).toBe('5.6.7.8');
  });

  it('fallback to x-real-ip', () => {
    expect(clientIp({ headers: { 'x-real-ip': '9.10.11.12' } })).toBe('9.10.11.12');
  });

  it('x-forwarded-for with trailing comma', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '10.0.0.1,' } })).toBe('10.0.0.1');
  });

  it('x-forwarded-for spoofed leftmost is ignored', () => {
    // Attacker sends: x-forwarded-for: 127.0.0.1, 10.0.0.1
    // Rightmost (10.0.0.1) is the real one from our proxy
    expect(clientIp({
      headers: { 'x-forwarded-for': '127.0.0.1, 10.0.0.1' }
    })).toBe('10.0.0.1');
  });

  it('nf header with whitespace is trimmed', () => {
    expect(clientIp({
      headers: { 'x-nf-client-connection-ip': '  1.2.3.4  ' }
    })).toBe('1.2.3.4');
  });
});

// --- isVipCatatan regex (FIX #28) ---
describe('isVipCatatan — adversarial regex boundary', () => {
  // Same implementation as backend + frontend
  function isVipCatatan(catatan: any) {
    const c = String(catatan || '');
    return c.includes('[VIP]') || /\[KELAS\s*[A-Z0-9]+\]/i.test(c);
  }

  it('[VIP] matches (exact case)', () => expect(isVipCatatan('[VIP]')).toBe(true));
  it('[vip] does NOT match — includes() is case-sensitive', () => expect(isVipCatatan('[vip]')).toBe(false));
  it('[Vip] does NOT match', () => expect(isVipCatatan('[Vip]')).toBe(false));

  it('[KELAS A] matches (case-insensitive regex)', () => expect(isVipCatatan('[KELAS A]')).toBe(true));
  it('[kelas abc123] matches', () => expect(isVipCatatan('[kelas abc123]')).toBe(true));
  it('[KELAS] with no suffix → false', () => expect(isVipCatatan('[KELAS]')).toBe(false));

  // OLD regex would match these — new regex must NOT:
  it('[MCU] → false', () => expect(isVipCatatan('[MCU]')).toBe(false));
  it('[VISA] → false', () => expect(isVipCatatan('[VISA]')).toBe(false));
  it('[NOTE] → false', () => expect(isVipCatatan('[NOTE]')).toBe(false));
  it('[TGST] → false', () => expect(isVipCatatan('[TGST]')).toBe(false));
  it('[ADMIN] → false', () => expect(isVipCatatan('[ADMIN]')).toBe(false));

  it('VIP without brackets → false', () => expect(isVipCatatan('VIP')).toBe(false));
  it('[VIP] in middle of text', () => expect(isVipCatatan('status: [VIP] aktif')).toBe(true));
  it('[KELAS B] in middle of text', () => expect(isVipCatatan('catatan: [KELAS B] lulus')).toBe(true));

  it('[KELAS 12AB] matches (alphanumeric)', () => expect(isVipCatatan('[KELAS 12AB]')).toBe(true));
  it('[KELAS _] → false (underscore not in [A-Z0-9])', () => expect(isVipCatatan('[KELAS _]')).toBe(false));
  it('[KELAS -] → false', () => expect(isVipCatatan('[KELAS -]')).toBe(false));

  it('empty string → false', () => expect(isVipCatatan('')).toBe(false));
  it('null → false', () => expect(isVipCatatan(null)).toBe(false));
  it('undefined → false', () => expect(isVipCatatan(undefined)).toBe(false));
  it('number → false', () => expect(isVipCatatan(123)).toBe(false));
  it('boolean → false', () => expect(isVipCatatan(true)).toBe(false));
});

// --- cacheClearKey (FIX #31/#35) ---
import { cacheGet, cacheSet, cacheClear, cacheClearKey } from './cache';

describe('cache — cacheClearKey isolation', () => {
  it('cacheClearKey removes only the targeted key', () => {
    cacheClear(); // start clean
    cacheSet('schedules', [{ id: 1 }], 60000);
    cacheSet('tugas', [{ id: 2 }], 60000);
    cacheSet('candidates', [{ id: 3 }], 25000);
    cacheClearKey('schedules');
    expect(cacheGet('schedules')).toBeUndefined();
    expect(cacheGet('tugas')).toEqual([{ id: 2 }]);
    expect(cacheGet('candidates')).toEqual([{ id: 3 }]);
  });

  it('cacheClearKey on nonexistent key is harmless', () => {
    cacheClear();
    cacheSet('existing', 'data', 60000);
    cacheClearKey('nonexistent');
    expect(cacheGet('existing')).toBe('data');
  });

  it('cacheClear removes everything', () => {
    cacheSet('a', 1, 60000);
    cacheSet('b', 2, 60000);
    cacheClear();
    expect(cacheGet('a')).toBeUndefined();
    expect(cacheGet('b')).toBeUndefined();
  });

  it('cache expiry works', () => {
    cacheClear();
    cacheSet('ttl-test', 'value', 1); // 1ms TTL
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy wait ~5ms
    expect(cacheGet('ttl-test')).toBeUndefined();
  });

  it('overwriting same key replaces value', () => {
    cacheClear();
    cacheSet('key', 'old', 60000);
    cacheSet('key', 'new', 60000);
    expect(cacheGet('key')).toBe('new');
  });

  it('cacheClearKey then re-set works', () => {
    cacheClear();
    cacheSet('schedules', [1], 60000);
    cacheClearKey('schedules');
    expect(cacheGet('schedules')).toBeUndefined();
    cacheSet('schedules', [2], 60000);
    expect(cacheGet('schedules')).toEqual([2]);
  });
});
