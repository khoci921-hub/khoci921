// ==========================================
// TESTS: js/core/html — escapeHtml kanonikal halaman standalone.
// ==========================================
import { describe, it, expect } from 'vitest';
import { escapeHtml } from './html';

describe('escapeHtml — 5 entitas HTML + null-safe', () => {
  it('escape & < > " \'', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#039;y&#039;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('null/undefined → kosong (bukan string "null")', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('nilai falsy non-null (0, false) dipertahankan (perbaikan drift siswa_baru)', () => {
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(false)).toBe('false');
  });

  it('teks biasa tidak berubah', () => {
    expect(escapeHtml('Nama Siswa - Kelas A')).toBe('Nama Siswa - Kelas A');
  });
});
