// ==========================================
// TESTS: js/core/bridge.js — registry seam + dispatcher data-action
// ==========================================
// bridge.js (dan api-client.js/i18n.js yang di-import-nya) mengeksekusi
// `window.*` di module scope → vitest env node perlu stub global SEBELUM
// dynamic import. Logika murni yang diuji:
//   - registerSeamAliases: non-fungsi ditolak tanpa allowNonFunction;
//     diterima dengan allowNonFunction; guard tabrakan nama (nilai beda).
//   - dispatchSeamAction: resolve dari registry / window fallback.
import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('bridge seam registry + dispatcher', () => {
  let bridge;

  beforeAll(async () => {
    const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const win = { localStorage: ls, addEventListener: () => {} };
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', ls); // i18n/core.js baca bare localStorage
    vi.stubGlobal('document', { addEventListener: () => {} });
    bridge = await import('./bridge.js');
  });

  it('registerSeamAliases menolak non-fungsi tanpa allowNonFunction', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    bridge.registerSeamAliases({ OBJEK: { a: 1 } });
    expect(bridge.getSeamAliases().OBJEK).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('registerSeamAliases menerima non-fungsi dengan allowNonFunction', () => {
    bridge.registerSeamAliases({ THEMES: { dark: 'x' } }, { allowNonFunction: true });
    expect(bridge.getSeamAliases().THEMES).toEqual({ dark: 'x' });
    expect(window.THEMES).toEqual({ dark: 'x' });
  });

  it('guard tabrakan nama: nilai berbeda → warn, nilai terbaru menang', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    bridge.registerSeamAliases({ sama: () => 'v1' }, { source: 'modulA' });
    bridge.registerSeamAliases({ sama: () => 'v2' }, { source: 'modulB' });
    expect(warn).toHaveBeenCalled();
    expect(bridge.getSeamAliases().sama()).toBe('v2');
    warn.mockRestore();
  });

  it('re-registrasi nilai sama → idempotent (tidak warn)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = () => 'x';
    bridge.registerSeamAliases({ idem: fn }, { source: 'modulA' });
    bridge.registerSeamAliases({ idem: fn }, { source: 'modulB' });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('dispatchSeamAction resolve dari registry + window fallback', () => {
    const fn = vi.fn((a, b) => a + b);
    bridge.registerSeamAliases({ tambah: fn });
    const el = { tagName: 'BUTTON' };
    const ev = { currentTarget: el };
    const result = bridge.dispatchSeamAction('tambah', ev, [2, 3]);
    expect(result).toBe(5);
    expect(fn).toHaveBeenCalledWith(2, 3);

    // fallback window.*
    window.fnLama = () => 'lama';
    expect(bridge.dispatchSeamAction('fnLama', ev, [])).toBe('lama');
  });

  it('dispatchSeamAction nama tak dikenal → warn + undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(bridge.dispatchSeamAction('tidakAda', undefined, [])).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
