// ==========================================
// TESTS: i18n — paritas bahasa & guard typo key (Fase 4).
// - SETIAP key di LANG.id harus punya pasangan di LANG.jp (kalau tidak,
//   user JP melihat key mentah — tr() TIDAK fallback ke id).
// - tr(key) untuk setiap key id tidak boleh mengembalikan key itu sendiri
//   (guard typo: key yang salah ketik / tidak ada → dikembalikan apa adanya).
// ==========================================
import { describe, it, expect } from 'vitest';

// i18n.js membaca localStorage & menulis window.* saat evaluasi — stub dulu.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;

const { LANG, tr, ensureJpLocale } = await import('./i18n.js');

// JP locale di-load secara lazy (tidak bundled). Untuk test parity,
// kita load langsung dari source file agar test bisa jalan tanpa fetch.
import { jp } from './i18n/locales/jp/index.js';
// Injek ke LANG supaya test paritas bisa jalan.
LANG.jp = jp;

function leaves(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, p, out);
    else out.add(p);
  }
  return out;
}

function getPath(obj, path) {
  return path.split('.').reduce((o, p) => (o === undefined || o === null ? undefined : o[p]), obj);
}

describe('paritas LANG.id ↔ LANG.jp', () => {
  const idKeys = leaves(LANG.id);
  const jpKeys = leaves(LANG.jp);

  it('kamus tidak kosong', () => {
    expect(idKeys.size).toBeGreaterThan(500);
    expect(jpKeys.size).toBeGreaterThan(500);
  });

  it('setiap key id punya pasangan jp (tidak ada key mentah di mode JP)', () => {
    const missing = [...idKeys].filter((k) => !jpKeys.has(k));
    expect(missing, 'key id tanpa jp: ' + missing.join(', ')).toEqual([]);
  });

  it('tidak ada key jp yatim (tanpa pasangan id)', () => {
    const extra = [...jpKeys].filter((k) => !idKeys.has(k));
    expect(extra, 'key jp tanpa id: ' + extra.join(', ')).toEqual([]);
  });
});

describe('tr() — guard typo key (mode ID)', () => {
  it('semua key id diterjemahkan (tr ≠ key)', () => {
    const broken = [...leaves(LANG.id)].filter((k) => tr(k) === k);
    expect(broken, 'key yang gagal diterjemahkan: ' + broken.slice(0, 10).join(', ')).toEqual([]);
  });
});

describe('nilai jp — tidak ada placeholder key mentah', () => {
  it('nilai jp tidak sama dengan key path-nya (user JP tidak melihat key)', () => {
    const bad = [...leaves(LANG.id)].filter((k) => getPath(LANG.jp, k) === k);
    expect(bad, 'nilai jp sama dengan key: ' + bad.slice(0, 10).join(', ')).toEqual([]);
  });
});
