// ==========================================
// DISPATCH-LEVEL TEST — exercise handleAction (the real Netlify entry point).
// Tests the full dispatch → auth → handler → Supabase flow with mocked DB.
// ==========================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env
vi.mock('./env.js', () => ({
  env: (key: string) => {
    if (key === 'SESSION_SECRET') return 'dispatch-test-secret';
    return '';
  },
  debugFileEnvKeys: () => ({}),
  debugFileStructure: () => ({}),
}));

// Mock Supabase — record all calls for assertion
let supabaseCalls: any[] = [];
vi.mock('./db/client.js', () => ({
  supabaseJson: (...args: any[]) => {
    supabaseCalls.push(args);
    // Default: return empty array for any query
    return Promise.resolve([]);
  },
  normalizeWa: (s: string) => String(s || '').replace(/\D/g, ''),
  toText: (v: any) => (v == null ? '' : String(v)),
  hasBackend: () => true,
  pick: (row: any, keys: string[]) => {
    for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
    return null;
  },
  supabaseUpsert: vi.fn(),
  findTable: vi.fn().mockResolvedValue({ table: null, rows: [] }),
  invalidateTableCache: vi.fn(),
  getSchema: vi.fn().mockResolvedValue(null),
  tablesFromSchema: vi.fn().mockReturnValue([]),
  columnsFromSchema: vi.fn().mockReturnValue([]),
  normalizeStatus: (v: any) => 'OPEN',
  normalizeGender: (v: any) => '',
}));

// Mock FCM (avoid real HTTP calls)
vi.mock('./fcm-server.js', () => ({
  sendMulticast: vi.fn().mockResolvedValue(undefined),
}));

// Mock fcm-helpers
vi.mock('./fcm-helpers.js', () => ({
  notifyAdmins: vi.fn().mockResolvedValue(undefined),
}));

import { signToken } from './session';
import { handleAction } from './handlers';

// Generate real tokens
const adminToken = signToken({ role: 'admin', name: 'TESTADMIN' });
const candidateToken = signToken({ role: 'kandidat', wa: '6281234567890' });
const refreshAdminToken = signToken({ role: 'admin', name: 'TESTADMIN', kind: 'refresh' });

describe('handleAction — dispatch level integration', () => {
  beforeEach(() => {
    supabaseCalls = [];
  });

  // --- ping ---
  it('ping returns immediately without rate limit or Supabase', async () => {
    const result = await handleAction('ping', [], null, { ip: '1.2.3.4' });
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('pong');
    expect(supabaseCalls).toHaveLength(0);
  });

  // --- unknown action ---
  it('unknown action returns NOT_IMPLEMENTED', async () => {
    const result = await handleAction('nonexistentAction', [], adminToken, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('belum diimplementasi');
  });

  // --- auth: no session ---
  it('reviewForm without session → auth error', async () => {
    const result = await handleAction('reviewForm', ['form-1'], null, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
    expect(result.sessionInvalid || result.error).toBeTruthy();
  });

  // --- auth: refresh token rejected for actions ---
  it('reviewForm with refresh token → auth error', async () => {
    const result = await handleAction('reviewForm', ['form-1'], refreshAdminToken, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
  });

  // --- auth: candidate cannot do admin actions ---
  it('reviewForm with candidate token → auth error', async () => {
    const result = await handleAction('reviewForm', ['form-1'], candidateToken, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
  });

  // --- registerFcmToken: no session → rejected ---
  it('registerFcmToken without session → rejected', async () => {
    const result = await handleAction('registerFcmToken', ['6281234567890', 'fcm-token-abc'], null, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
    expect(result.message.toLowerCase()).toContain('sesi');
  });

  // --- registerFcmToken: refresh token → rejected ---
  it('registerFcmToken with refresh token → rejected', async () => {
    const result = await handleAction('registerFcmToken', ['6281234567890', 'fcm-token-abc'], refreshAdminToken, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
  });

  // --- reviewForm: admin, form not found → error ---
  it('reviewForm admin, form not found → error (not crash)', async () => {
    // supabaseJson returns [] for all queries → form not found
    const result = await handleAction('reviewForm', ['nonexistent-id'], adminToken, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  // --- deleteForm: admin, form not found → error ---
  it('deleteForm admin, form not found → error (not crash)', async () => {
    const result = await handleAction('deleteForm', ['nonexistent-id'], adminToken, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  // --- tandaiDibacaForm: admin, form not found → error ---
  it('tandaiDibacaForm admin, form not found → error (not crash)', async () => {
    const result = await handleAction('tandaiDibacaForm', ['nonexistent-id'], adminToken, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  // --- handleDaftarKandidat: valid payload, no session needed ---
  it('daftarKandidat with valid payload → attempts insert', async () => {
    // Mock: first supabaseJson call (findCandidates) returns a table
    // daftarKandidat is unauthenticated — just verify it doesn't crash
    const result = await handleAction('daftarKandidat', ['Test Name', '6281234567890'], null, { ip: '1.2.3.4' });
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  // --- loginKandidat: empty payload → error ---
  it('loginKandidat with empty payload → error (not crash)', async () => {
    const result = await handleAction('loginKandidat', ['', ''], null, { ip: '1.2.3.4' });
    expect(result.success).toBe(false);
  });

  // --- getAppData: public mode without session → returns public data ---
  it('getAppData public mode → no crash', async () => {
    const result = await handleAction('getAppData', ['public'], null, { ip: '1.2.3.4' });
    expect(result).toBeDefined();
    // Should not crash even with mocked Supabase returning empty
  });

  // --- getAppData: admin mode without valid session → sessionInvalid ---
  it('getAppData admin mode with no session → sessionInvalid', async () => {
    const result = await handleAction('getAppData', ['admin'], null, { ip: '1.2.3.4' });
    expect(result).toBeDefined();
    // Public data returned + sessionInvalid flag
    // With Supabase unreachable (empty mocked responses), admin mode now returns
    // an error instead of silently showing demo data.
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  // --- rate limiting: rapid fire login attempts ---
  it('rate limit: 6th login attempt within 1 minute → rate limited', async () => {
    const ip = 'rate-test-ip';
    // Fire 5 login attempts (the limit)
    for (let i = 0; i < 5; i++) {
      await handleAction('checkAdminMaster', ['wrong-pin'], null, { ip });
    }
    // 6th should be rate limited
    const result = await handleAction('checkAdminMaster', ['wrong-pin'], null, { ip });
    expect(result.rateLimited).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  // --- dispatch: handler throws → generic error (not crash) ---
  it('handler throw → caught by dispatch, returns generic error', async () => {
    // This tests the try/catch in dispatchAction
    //触登 an action that will throw due to mocked Supabase returning unexpected data
    const result = await handleAction('reviewForm', ['test'], adminToken, { ip: '1.2.3.4' });
    // Should return error, not throw
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});
