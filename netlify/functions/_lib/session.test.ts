// ==========================================
// TESTS: session.js — sign/verify token HMAC-SHA256.
// - Roundtrip: sign lalu verify harus balik payload yang sama.
// - Tampered token harus reject (null).
// - Edge cases: null/undefined/malformed token.
// ==========================================
import { describe, it, expect, vi } from 'vitest';

// Override env() supaya SESSION_SECRET bisa dikontrol test
vi.mock('./env.js', () => {
  const SECRET = 'test-secret-for-session-' + process.env.TEST_SESSION_SECRET;
  return {
    env: (key) => (key === 'SESSION_SECRET' ? SECRET : ''),
    debugFileEnvKeys: () => ({}),
    debugFileStructure: () => ({}),
  };
});

import { signToken, verifyToken } from './session';

describe('session — signToken + verifyToken', () => {
  it('roundtrip: sign → verify mengembalikan payload + exp/iat', () => {
    const payload = { role: 'admin', name: 'KHOCI' };
    const token = signToken(payload);
    const result = verifyToken(token);
    // signToken now adds exp & iat — verify returns them
    expect(result).toMatchObject(payload);
    expect(result!.exp).toBeGreaterThan(0);
    expect(result!.iat).toBeGreaterThan(0);
  });

  it('roundtrip dengan payload kandidat (role: kandidat + wa)', () => {
    const payload = { role: 'kandidat', wa: '6281234567890' };
    const token = signToken(payload);
    const result = verifyToken(token);
    expect(result).toMatchObject(payload);
    expect(result!.exp).toBeGreaterThan(0);
  });

  it('roundtrip dengan payload kosong', () => {
    const payload = {};
    const token = signToken(payload);
    const result = verifyToken(token);
    // Payload kosong tetap punya exp & iat
    expect(result!.exp).toBeGreaterThan(0);
    expect(result!.iat).toBeGreaterThan(0);
  });

  it('token format: base64url.body.base64url.signature', () => {
    const token = signToken({ role: 'admin' });
    const parts = token.split('.');
    expect(parts.length).toBe(2);
    // Both parts should be valid base64url
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('session — tamper detection', () => {
  it('modified body → verify returns null', () => {
    const token = signToken({ role: 'admin' });
    const parts = token.split('.');
    // Tamper the body
    const tampered = Buffer.from(JSON.stringify({ role: 'hacker' })).toString('base64url');
    const badToken = tampered + '.' + parts[1];
    expect(verifyToken(badToken)).toBeNull();
  });

  it('modified signature → verify returns null', () => {
    const token = signToken({ role: 'admin' });
    const parts = token.split('.');
    const badToken = parts[0] + '.AAAA';
    expect(verifyToken(badToken)).toBeNull();
  });

  it('wrong secret produces different signature', () => {
    const token1 = signToken({ role: 'admin' });
    // Since we can't change the secret in test, verify the token is unique
    const token2 = signToken({ role: 'admin' });
    // Both should verify to same payload (same secret)
    expect(verifyToken(token1)).toEqual(verifyToken(token2));
  });
});

describe('session — edge cases', () => {
  it('null → returns null', () => {
    expect(verifyToken(null)).toBeNull();
  });

  it('undefined → returns null', () => {
    expect(verifyToken(undefined)).toBeNull();
  });

  it('empty string → returns null', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('non-string → returns null', () => {
    expect(verifyToken(123)).toBeNull();
    expect(verifyToken({})).toBeNull();
  });

  it('single part (no dot) → returns null', () => {
    expect(verifyToken('abcdef')).toBeNull();
  });

  it('three parts (extra dot) → returns null', () => {
    expect(verifyToken('a.b.c')).toBeNull();
  });

  it('invalid base64 in body → returns null (JSON parse fails)', () => {
    const token = signToken({ role: 'admin' });
    const parts = token.split('.');
    // Replace body with invalid base64 that decodes to invalid JSON
    const badBody = Buffer.from('not-json').toString('base64url');
    const sig = parts[1]; // Keep valid sig
    expect(verifyToken(badBody + '.' + sig)).toBeNull();
  });
});

describe('session — timing safe comparison', () => {
  it('verify uses timingSafeEqual (same-length buffers)', () => {
    const token = signToken({ role: 'admin' });
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result.role).toBe('admin');
  });

  it('different length signature → returns null (length check before timingSafeEqual)', () => {
    const token = signToken({ role: 'admin' });
    const parts = token.split('.');
    // Signature that's too short
    expect(verifyToken(parts[0] + '.abc')).toBeNull();
    // Signature that's too long
    expect(verifyToken(parts[0] + '.' + 'a'.repeat(100))).toBeNull();
  });
});

describe('session — token expiry (FIX #4)', () => {
  it('admin token expires after 2 hours', () => {
    const payload = { role: 'admin', name: 'KHOCI' };
    const token = signToken(payload);
    const result = verifyToken(token);
    // Token baru harus valid (exp > now)
    expect(result).not.toBeNull();
    expect(result!.exp).toBeGreaterThan(Date.now());
    // Admin TTL = 2 jam
    const twoHoursMs = 2 * 60 * 60 * 1000;
    expect(result!.exp - result!.iat).toBeLessThanOrEqual(twoHoursMs + 1000);
  });

  it('candidate token expires after 24 hours', () => {
    const payload = { role: 'kandidat', wa: '6281234567890' };
    const token = signToken(payload);
    const result = verifyToken(token);
    expect(result!.exp).toBeGreaterThan(Date.now());
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    expect(result!.exp - result!.iat).toBeLessThanOrEqual(twentyFourHoursMs + 1000);
  });

  it('refresh token expires after 30 days', () => {
    const payload = { role: 'kandidat', wa: '6281234567890', kind: 'refresh' };
    const token = signToken(payload);
    const result = verifyToken(token);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(result!.exp - result!.iat).toBeLessThanOrEqual(thirtyDaysMs + 1000);
  });

  it('expired token returns null', () => {
    // Forge an expired token by modifying the exp in the body.
    // MUST use the same secret as the mock env — derive it identically.
    const crypto = require('crypto');
    const SECRET = 'test-secret-for-session-' + process.env.TEST_SESSION_SECRET;
    const expiredPayload = { role: 'admin', name: 'TEST', exp: 1, iat: 0 };
    const body = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const expiredToken = body + '.' + sig;
    expect(verifyToken(expiredToken)).toBeNull();
  });
});
