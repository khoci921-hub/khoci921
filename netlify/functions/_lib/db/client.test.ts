// ==========================================
// TESTS: db/client — normalisasi WA, status, gender (Fase 1.5).
// Normalisasi WA adalah GATE kritis: 0xx → 62xx, buang non-digit — salah
// normalisasi = kandidat duplikat (kasus SATRIA 6223 vs 6282, 2026-08-15).
// ==========================================
import { describe, it, expect } from 'vitest';
import { normalizeWa, normalizeStatus, normalizeGender } from './client';

describe('normalizeWa — format baku 628…', () => {
  it('0xx… dikonversi ke 62xx… (awalan HP)', () => {
    expect(normalizeWa('081234567890')).toBe('6281234567890');
    expect(normalizeWa('082130442661')).toBe('6282130442661');
  });

  it('8xx… (tanpa nol depan) dikonversi ke 628xx… — sama dengan frontend', () => {
    expect(normalizeWa('81234567890')).toBe('6281234567890');
    expect(normalizeWa('82130442661')).toBe('6282130442661');
  });

  it('buang semua non-digit (spasi, +, -, kurung)', () => {
    expect(normalizeWa('+62 812-3456-7890')).toBe('6281234567890');
    expect(normalizeWa('(0812) 345 678')).toBe('62812345678');
  });

  it('628… yang sudah baku tetap dipertahankan', () => {
    expect(normalizeWa('6281234567890')).toBe('6281234567890');
  });

  it('nilai kosong / non-string aman', () => {
    expect(normalizeWa('')).toBe('');
    expect(normalizeWa(undefined)).toBe('');
    expect(normalizeWa(null)).toBe('');
    expect(normalizeWa('abc')).toBe('');
  });

  it('nomor pendek tidak menjadi 628 palsu (tetap digit apa adanya)', () => {
    expect(normalizeWa('08123')).toBe('628123');
  });
});

describe('normalizeStatus — status lowongan (OPEN/CLOSE/URGENT)', () => {
  it('kata kunci tutup/close/selesai → CLOSE', () => {
    expect(normalizeStatus('CLOSE')).toBe('CLOSE');
    expect(normalizeStatus('TUTUP')).toBe('CLOSE');
    expect(normalizeStatus('SELESAI / CLOSE')).toBe('CLOSE');
  });

  it('selain itu → OPEN (termasuk kosong dianggap CLOSE di kode lama)', () => {
    expect(normalizeStatus('OPEN')).toBe('OPEN');
    expect(normalizeStatus('✅ OPEN')).toBe('OPEN');
    expect(normalizeStatus('PENCARIAN KANDIDAT')).toBe('OPEN');
    expect(normalizeStatus('PEMBERKASAN')).toBe('OPEN');
    expect(normalizeStatus('')).toBe('CLOSE');
  });

  it('URGENT menang atas kata kunci lain', () => {
    expect(normalizeStatus('URGENT')).toBe('URGENT');
    expect(normalizeStatus('OPEN URGENT')).toBe('URGENT');
  });
});

describe('normalizeGender — kanonikal LAKI-LAKI/PEREMPUAN (konvensi situs lama)', () => {
  it('berbagai varian laki-laki (termasuk L — konvensi L/P)', () => {
    for (const v of ['LAKI-LAKI', 'laki', 'L', 'LK', 'M', 'MALE', 'PRIA', 'Laki-laki']) {
      expect(normalizeGender(v)).toBe('LAKI-LAKI');
    }
  });

  it('berbagai varian perempuan (termasuk P — konvensi L/P)', () => {
    for (const v of [
      'PEREMPUAN',
      'perempuan',
      'P',
      'PR',
      'W',
      'F',
      'FEMALE',
      'WANITA',
      'CEWEK',
      '女',
    ]) {
      expect(normalizeGender(v)).toBe('PEREMPUAN');
    }
  });

  it('nilai tak dikenal / kosong → kosong (bukan L/P)', () => {
    expect(normalizeGender('')).toBe('');
    expect(normalizeGender('-')).toBe('');
    expect(normalizeGender('n/a')).toBe('');
  });
});
