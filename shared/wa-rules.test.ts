// ==========================================
// TESTS: shared/wa-rules — SATU-SATUNYA sumber aturan WA.
// Modul ini dipakai backend (db/client + actions-auth) DAN frontend
// (js/04_auth.js). Test di sini adalah kontrak: jangan mengubah perilaku
// tanpa mengubah test ini — drift frontend↔backend adalah bug (kasus SATRIA).
// ==========================================
import { describe, it, expect } from 'vitest';
import { normalizeWa, isValidWaFormat } from './wa-rules';

describe('normalizeWa — format baku 628…', () => {
  it('0xx… → 62xx…', () => {
    expect(normalizeWa('081234567890')).toBe('6281234567890');
  });

  it('8xx… (tanpa nol depan) → 628xx…', () => {
    expect(normalizeWa('81234567890')).toBe('6281234567890');
  });

  it('buang non-digit (spasi, +, -, kurung)', () => {
    expect(normalizeWa('+62 812-3456-7890')).toBe('6281234567890');
    expect(normalizeWa('(0812) 345 678')).toBe('62812345678');
  });

  it('628… yang sudah baku tetap dipertahankan', () => {
    expect(normalizeWa('6281234567890')).toBe('6281234567890');
  });

  it('kosong / non-string / non-digit aman', () => {
    expect(normalizeWa('')).toBe('');
    expect(normalizeWa(undefined)).toBe('');
    expect(normalizeWa(null)).toBe('');
    expect(normalizeWa('abc')).toBe('');
  });
});

describe('isValidWaFormat — gate login/daftar', () => {
  it('menerima 628… 13 digit & 12 digit', () => {
    expect(isValidWaFormat('6281234567890')).toBe(true);
    expect(isValidWaFormat('628123456789')).toBe(true);
  });

  it('menerima 08xx / 8xx (dinormalisasi)', () => {
    expect(isValidWaFormat('081234567890')).toBe(true);
    expect(isValidWaFormat('81234567890')).toBe(true);
  });

  it('menolak WA typo 6223… (kasus SATRIA)', () => {
    expect(isValidWaFormat('6223123456789')).toBe(false);
    expect(isValidWaFormat('622130442661')).toBe(false);
  });

  it('menolak terlalu pendek / panjang / non-digit / awalan bukan 62', () => {
    expect(isValidWaFormat('081234')).toBe(false);
    expect(isValidWaFormat('628123456789012')).toBe(false);
    expect(isValidWaFormat('')).toBe(false);
    expect(isValidWaFormat('abc')).toBe(false);
    expect(isValidWaFormat('71234567890')).toBe(false);
  });
});
