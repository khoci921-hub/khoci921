// ==========================================
// TESTS: withRetry (js/core/retry.ts) — helper retry yang dulu diduplikasi
// di 4 modul ai_copilot + ai_form. Modul murni (tanpa window/document) jadi
// aman di-import vitest.
// ==========================================
import { describe, it, expect } from 'vitest';
import { withRetry } from './retry';

describe('withRetry — helper retry', () => {
  it('sukses di percobaan pertama → hanya 1 pemanggilan', async () => {
    let n = 0;
    const out = await withRetry(async () => {
      n += 1;
      return 'ok';
    }, 3, 1);
    expect(out).toBe('ok');
    expect(n).toBe(1);
  });

  it('gagal lalu sukses → retry sampai berhasil', async () => {
    let n = 0;
    const out = await withRetry(async () => {
      n += 1;
      if (n < 3) throw new Error('coba ' + n);
      return 'sukses';
    }, 3, 1);
    expect(out).toBe('sukses');
    expect(n).toBe(3);
  });

  it('gagal terus → throw error percobaan terakhir', async () => {
    await expect(
      withRetry(async () => {
        throw new Error('selalu gagal');
      }, 2, 1),
    ).rejects.toThrow('selalu gagal');
  });

  it('default maxAttempts=2 & delayMs=2000 dipakai saat argumen kosong', async () => {
    let n = 0;
    await expect(
      withRetry(async () => {
        n += 1;
        throw new Error('x');
      }),
    ).rejects.toThrow('x');
    expect(n).toBe(2);
  });
});
