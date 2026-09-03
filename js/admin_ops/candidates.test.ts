// ==========================================
// TESTS: kirimBertahap (js/admin_ops/candidates.ts) — loop kirim per nomor.
// Fokus: perilaku RATE LIMIT (FONNTE_ACTIONS 2/menit di handlers.ts) — saat
// server membalas { rateLimited: true, retryAfter }, nomor yang sama diulang
// setelah retryAfter + 1 dtk (maks 3 percobaan), bukan ditandai gagal.
//
// candidates.ts mengeksekusi `window.*` di module scope (via state.ts) →
// vitest env node perlu stub global SEBELUM dynamic import (pola sama dengan
// js/core/bridge.test.ts).
// ==========================================
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

describe('kirimBertahap — rate limit', () => {
  let kirimBertahap;

  beforeAll(async () => {
    const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    vi.stubGlobal('window', { localStorage: ls, addEventListener: () => {} });
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('document', { addEventListener: () => {}, getElementById: () => null });
    const mod = await import('./candidates');
    kirimBertahap = mod.kirimBertahap;
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saat rateLimited → tunggu retryAfter lalu ulangi nomor yang sama sampai sukses', async () => {
    const calls = [];
    window.callAPI = vi.fn(async () => {
      calls.push(1);
      if (calls.length === 1) {
        return { success: false, rateLimited: true, retryAfter: 2, error: 'Terlalu banyak permintaan.' };
      }
      return { success: true };
    });
    const p = kirimBertahap({
      list: [{ wa: '6281234567890', nama: 'TES' }],
      jobCode: '',
      linkGrup: '',
      interval: 0,
      customMessage: 'Halo {nama}',
    });
    // Percobaan 1 → rateLimited; tunggu retryAfter + 1 = 3 dtk; percobaan 2 → sukses.
    await vi.advanceTimersByTimeAsync(4000);
    const results = await p;
    expect(calls).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].error).toBeNull();
  });

  it('rateLimited berulang → maks 3 percobaan lalu dicatat gagal dengan error asli', async () => {
    window.callAPI = vi.fn(async () => ({
      success: false,
      rateLimited: true,
      retryAfter: 1,
      error: 'Terlalu banyak permintaan.',
    }));
    const p = kirimBertahap({
      list: [{ wa: '6281234567890', nama: 'TES' }],
      jobCode: '',
      linkGrup: '',
      interval: 0,
      customMessage: 'Halo {nama}',
    });
    // 3 percobaan × jeda 2 dtk + margin.
    await vi.advanceTimersByTimeAsync(8000);
    const results = await p;
    expect(window.callAPI).toHaveBeenCalledTimes(3);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Terlalu banyak permintaan');
  });

  it('onProgress menerima info.menungguRateLimit saat retry', async () => {
    window.callAPI = vi.fn(async () => ({
      success: false,
      rateLimited: true,
      retryAfter: 1,
      error: 'Terlalu banyak permintaan.',
    }));
    const infos = [];
    const p = kirimBertahap({
      list: [{ wa: '6281234567890', nama: 'TES' }],
      jobCode: '',
      linkGrup: '',
      interval: 0,
      customMessage: 'Halo {nama}',
      onProgress: (done, total, info) => infos.push({ done, total, info }),
    });
    await vi.advanceTimersByTimeAsync(8000);
    await p;
    expect(infos.some((i) => i.info && i.info.menungguRateLimit)).toBe(true);
    expect(infos.some((i) => i.info && i.info.wait === 2)).toBe(true);
  });
});