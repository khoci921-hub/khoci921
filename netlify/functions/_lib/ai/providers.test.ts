// ==========================================
// TESTS: ai/providers — parseJsonLoose (parse output AI yang tidak selalu
// JSON murni: ada teks di sekitar, atau dibungkus markdown fence).
// ==========================================
import { describe, it, expect } from 'vitest';
import { parseJsonLoose } from './providers';

describe('parseJsonLoose — output AI → objek', () => {
  it('JSON murni langsung diparse', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it('markdown fence ```json dibuka', () => {
    expect(parseJsonLoose('```json\n{"score":7,"nilai":"B"}\n```')).toEqual({
      score: 7,
      nilai: 'B',
    });
  });

  it('teks di sekitar JSON diekstrak via slicing {…}', () => {
    expect(
      parseJsonLoose('Hasil wawancara: {"nama":"AGUS","hobi":"badminton"} Terima kasih'),
    ).toEqual({
      nama: 'AGUS',
      hobi: 'badminton',
    });
  });

  it('JSON invalid tetap melempar error (bukan silent)', () => {
    expect(() => parseJsonLoose('{a:1}')).toThrow();
    expect(() => parseJsonLoose('bukan json')).toThrow();
    expect(() => parseJsonLoose('')).toThrow();
  });
});
