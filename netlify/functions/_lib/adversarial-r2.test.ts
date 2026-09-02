// ==========================================
// ADVERSARIAL TESTS — Round 2
// resolveForm steps 1+2 mocked, patchFormMail upsert, removeFormMail,
// AbortSignal.timeout, isVipCatatan edge cases, session clock.
// ==========================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./env.js', () => ({
  env: (key: string) => {
    if (key === 'SESSION_SECRET') return 'adv-r2-secret';
    return '';
  },
  debugFileEnvKeys: () => ({}),
  debugFileStructure: () => ({}),
}));

import { signToken, verifyToken } from './session';

// ============================================================
// 1. resolveForm — steps 1+2 with mocked Supabase
// ============================================================
describe('resolveForm — steps 1+2 with mocked Supabase', () => {
  let mockQuery: any;
  let resolveForm: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('./env.js', () => ({
      env: (key: string) => {
        if (key === 'SESSION_SECRET') return 'adv-r2-secret';
        return '';
      },
      debugFileEnvKeys: () => ({}),
      debugFileStructure: () => ({}),
    }));
    mockQuery = vi.fn();
    vi.doMock('./db/client.js', () => ({
      supabaseJson: mockQuery,
      normalizeWa: (s: string) => String(s || '').replace(/\D/g, ''),
      toText: (v: any) => (v == null ? '' : String(v)),
      pick: (row: any, keys: string[]) => {
        for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
        return null;
      },
    }));
    const mod = await import('./db/forms.js');
    resolveForm = mod.resolveForm;
  });

  it('Step 1: findFormById succeeds → source=id, single query', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'uuid-123', code_job: 'TG9ASJ01' }]);
    const result = await resolveForm('uuid-123');
    expect(result.source).toBe('id');
    expect(result.form.id).toBe('uuid-123');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][2].query.id).toBe('eq.uuid-123');
  });

  it('Step 1 fails → Step 2 tries rowIndex, 2 queries total', async () => {
    mockQuery.mockResolvedValueOnce([]);  // Step 1: no match
    mockQuery.mockResolvedValueOnce([{ id: 'row-456' }]);  // Step 2: match
    const result = await resolveForm('5');
    expect(result.source).toBe('index');
    expect(result.form.id).toBe('row-456');
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('undefined → immediate error, 0 queries', async () => {
    const result = await resolveForm(undefined);
    expect(result.form).toBeNull();
    expect(result.error).toContain('tidak valid');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('null → immediate error', async () => {
    const result = await resolveForm(null);
    expect(result.form).toBeNull();
    expect(result.error).toContain('tidak valid');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('0 (number) → passes null-check, enters Step 1', async () => {
    mockQuery.mockResolvedValueOnce([]);
    mockQuery.mockResolvedValueOnce([{ id: 'idx-0' }]);
    const result = await resolveForm(0);
    expect(result.source).toBe('index');
  });

  it('non-numeric string → Step 1 null, Step 2 skipped (NaN), Step 3 needed', async () => {
    mockQuery.mockResolvedValueOnce([]);  // Step 1: no match
    // Step 2 is skipped (NaN), Step 3 calls findForms
    mockQuery.mockResolvedValueOnce([{ id: 'abc' }]);  // findForms returns
    const result = await resolveForm('abc');
    // Should reach Step 3 — either finds or returns error
    expect(mockQuery).toHaveBeenCalledTimes(2); // Step 1 + findForms
  });

  it('Supabase throws in Step 1 → falls through to Step 2 (not crash)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('timeout'));
    // Step 2 might also fail
    mockQuery.mockResolvedValueOnce([]);
    // Step 3
    mockQuery.mockResolvedValueOnce([]);
    // Should NOT throw — resolveForm catches internally
    const result = await resolveForm('err-id');
    expect(result.form).toBeNull();
  });
});

// ============================================================
// 2. session — clock-based expiry
// ============================================================
describe('session — clock-based expiry', () => {
  it('admin token TTL ≈ 2h', () => {
    const t = signToken({ role: 'admin' });
    const r = verifyToken(t)!;
    const ttl = r.exp! - r.iat!;
    expect(ttl).toBeGreaterThan(7_000_000);
    expect(ttl).toBeLessThan(7_300_000);
  });

  it('candidate token TTL ≈ 24h', () => {
    const t = signToken({ role: 'kandidat', wa: '6281234567890' });
    const r = verifyToken(t)!;
    const ttl = r.exp! - r.iat!;
    expect(ttl).toBeGreaterThan(86_000_000);
    expect(ttl).toBeLessThan(87_000_000);
  });

  it('refresh token TTL ≈ 30d', () => {
    const t = signToken({ role: 'kandidat', wa: '6281234567890', kind: 'refresh' });
    const r = verifyToken(t)!;
    const ttl = r.exp! - r.iat!;
    expect(ttl).toBeGreaterThan(2_590_000_000);
    expect(ttl).toBeLessThan(2_600_000_000);
  });

  it('exp: 0 bypasses expiry check (falsy guard) — documented gap', () => {
    const crypto = require('crypto');
    const SECRET = 'adv-r2-secret';
    const payload = { role: 'admin', exp: 0, iat: 0 };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const result = verifyToken(body + '.' + sig);
    expect(result).not.toBeNull(); // exp=0 is falsy, check skipped
  });

  it('legacy token (no exp) accepted — migration path', () => {
    const crypto = require('crypto');
    const SECRET = 'adv-r2-secret';
    const payload = { role: 'kandidat', wa: '6281234567890' };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const result = verifyToken(body + '.' + sig);
    expect(result).not.toBeNull();
    expect(result!.exp).toBeUndefined();
  });
});

// ============================================================
// 3. patchFormMail — upsert behavior
// ============================================================
describe('patchFormMail — upsert / stale-data edge', () => {
  let ALL_FORM: any[];

  function patchFormMail(idOrIndex: any, newForm: any) {
    if (!newForm) return;
    var found = -1;
    for (var k = 0; k < ALL_FORM.length; k++) {
      if (ALL_FORM[k] && String(ALL_FORM[k].id) === String(newForm.id)) {
        found = k;
        break;
      }
    }
    if (found >= 0) {
      ALL_FORM[found] = newForm;
    } else {
      var byParam = -1;
      for (var k2 = 0; k2 < ALL_FORM.length; k2++) {
        if (ALL_FORM[k2] && String(ALL_FORM[k2].id) === String(idOrIndex)) {
          byParam = k2;
          break;
        }
      }
      if (byParam >= 0) ALL_FORM[byParam] = newForm;
      else ALL_FORM.push(newForm);
    }
  }

  beforeEach(() => {
    ALL_FORM = [
      { id: 'f1', status: 'MENUNGGU' },
      { id: 'f2', status: 'LULUS' },
      { id: 'f3', status: 'GAGAL' },
    ];
  });

  it('patches existing form by id (primary path)', () => {
    patchFormMail('ignored', { id: 'f2', status: 'REVIEW ADMIN' });
    expect(ALL_FORM[1].status).toBe('REVIEW ADMIN');
    expect(ALL_FORM.length).toBe(3);
  });

  it('unknown id → appends (upsert for newly-created forms)', () => {
    patchFormMail('anything', { id: 'f-new', status: 'MENUNGGU' });
    expect(ALL_FORM.length).toBe(4);
    expect(ALL_FORM[3].id).toBe('f-new');
  });

  it('null newForm → no-op', () => {
    patchFormMail('f1', null);
    expect(ALL_FORM.length).toBe(3);
  });

  it('undefined newForm → no-op', () => {
    patchFormMail('f1', undefined);
    expect(ALL_FORM.length).toBe(3);
  });

  it('form with id=undefined → appended (never matches existing)', () => {
    patchFormMail('anything', { id: undefined, status: 'X' });
    expect(ALL_FORM.length).toBe(4);
    expect(ALL_FORM[3].id).toBeUndefined();
  });

  it('multiple patches to same id → last write wins', () => {
    patchFormMail('ignored', { id: 'f1', status: 'LULUS' });
    patchFormMail('ignored', { id: 'f1', status: 'GAGAL' });
    expect(ALL_FORM[0].status).toBe('GAGAL');
    expect(ALL_FORM.length).toBe(3);
  });

  it('idOrIndex fallback: newForm.id mismatch but idOrIndex matches', () => {
    patchFormMail('f2', { id: 'mismatch', status: 'X' });
    expect(ALL_FORM[1].id).toBe('mismatch');
    expect(ALL_FORM[1].status).toBe('X');
  });
});

// ============================================================
// 4. removeFormMail — delete by id
// ============================================================
describe('removeFormMail — delete by id', () => {
  let ALL_FORM: any[];

  function removeFormMail(idOrIndex: any) {
    var id = String(idOrIndex);
    var found = -1;
    for (var k = 0; k < ALL_FORM.length; k++) {
      if (ALL_FORM[k] && String(ALL_FORM[k].id) === id) {
        found = k;
        break;
      }
    }
    if (found >= 0) ALL_FORM.splice(found, 1);
  }

  beforeEach(() => {
    ALL_FORM = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ];
  });

  it('removes form by id', () => {
    removeFormMail('b');
    expect(ALL_FORM.length).toBe(2);
    expect(ALL_FORM.map((f: any) => f.id)).toEqual(['a', 'c']);
  });

  it('unknown id → no-op', () => {
    removeFormMail('z');
    expect(ALL_FORM.length).toBe(3);
  });

  it('duplicate ids → removes first match', () => {
    ALL_FORM.push({ id: 'a', extra: true });
    removeFormMail('a');
    expect(ALL_FORM.length).toBe(3);
    expect(ALL_MAP_has_a()).toBe(true); // second 'a' remains
  });

  function ALL_MAP_has_a() {
    return ALL_FORM.some((f: any) => f.id === 'a');
  }
});

// ============================================================
// 5. AbortSignal.timeout
// ============================================================
describe('AbortSignal.timeout', () => {
  it('creates a signal that aborts after timeout', async () => {
    if (typeof AbortSignal === 'undefined') return;
    const signal = AbortSignal.timeout(1);
    await new Promise(r => setTimeout(r, 10));
    expect(signal.aborted).toBe(true);
  });

  it('signal within timeout is not aborted', () => {
    if (typeof AbortSignal === 'undefined') return;
    const signal = AbortSignal.timeout(5000);
    expect(signal.aborted).toBe(false);
  });
});

// ============================================================
// 6. isVipCatatan — edge cases
// ============================================================
describe('isVipCatatan — edge cases', () => {
  function isVipCatatan(catatan: any) {
    const c = String(catatan || '');
    return c.includes('[VIP]') || /\[KELAS\s*[A-Z0-9]+\]/i.test(c);
  }

  it('[VIP] exact → true', () => expect(isVipCatatan('[VIP]')).toBe(true));
  it('[vip] → false (includes is case-sensitive)', () => expect(isVipCatatan('[vip]')).toBe(false));
  it('[KELASABC] no space → true (\\s* allows zero spaces)', () => expect(isVipCatatan('[KELASABC]')).toBe(true));
  it('[KELAS  A] multiple spaces → true', () => expect(isVipCatatan('[KELAS  A]')).toBe(true));
  it('[KELAS\\tA] tab → true (\\s matches tab)', () => expect(isVipCatatan('[KELAS\tA]')).toBe(true));
  it('[KELAS] no suffix → false', () => expect(isVipCatatan('[KELAS]')).toBe(false));
  it('[MCU] → false', () => expect(isVipCatatan('[MCU]')).toBe(false));
  it('[VISA] → false', () => expect(isVipCatatan('[VISA]')).toBe(false));
  it('[[VIP]] → true (includes finds [VIP] substring)', () => expect(isVipCatatan('[[VIP]]')).toBe(true));
  it('[ VIP ] → false (spaces inside brackets)', () => expect(isVipCatatan('[ VIP ]')).toBe(false));
  it('VIP without brackets → false', () => expect(isVipCatatan('VIP')).toBe(false));
  it('empty → false', () => expect(isVipCatatan('')).toBe(false));
  it('null → false', () => expect(isVipCatatan(null)).toBe(false));
  it('undefined → false', () => expect(isVipCatatan(undefined)).toBe(false));
});
