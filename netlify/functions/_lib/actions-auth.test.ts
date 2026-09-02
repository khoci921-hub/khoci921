// ==========================================
// TESTS: actions-auth — gate WA login/daftar (isValidWaFormat).
// Hanya /^628\d{9,10}$/ yang diterima — WA typo (mis. 6223… vs 6282…,
// kasus SATRIA 2026-08-15) ditolak supaya tidak bikin kandidat duplikat.
// ==========================================
import { describe, it, expect } from 'vitest';
import * as auth from './actions-auth';
const { isValidWaFormat, handleRefreshAdminSession, handleRefreshKandidatSession } = auth;
import * as session from './session';
describe('refreshKandidatSession — pemulihan sesi kandidat diam-diam', () => {
  it('refresh token kandidat yang sah → sessionToken baru + wa', async () => {
    const rt = session.signToken({ role: 'kandidat', wa: '6281234567890', kind: 'refresh' });
    const res = await handleRefreshKandidatSession([rt]);
    expect(res.success).toBe(true);
    expect(res.wa).toBe('6281234567890');
    const t = session.verifyToken(res.sessionToken);
    expect(t.role).toBe('kandidat');
    expect(t.wa).toBe('6281234567890');
    expect(t.kind).toBeUndefined(); // token sesi biasa, bukan refresh
  });

  it('menolak token non-refresh (sesi biasa / role lain / rusak)', async () => {
    const st = session.signToken({ role: 'kandidat', wa: '6281234567890' });
    expect((await handleRefreshKandidatSession([st])).sessionInvalid).toBe(true);
    const adm = session.signToken({ role: 'admin', name: 'AGUS', kind: 'refresh' });
    expect((await handleRefreshKandidatSession([adm])).sessionInvalid).toBe(true);
    expect((await handleRefreshKandidatSession(['bogus.token'])).sessionInvalid).toBe(true);
    expect((await handleRefreshKandidatSession([''])).sessionInvalid).toBe(true);
  });

  it('refresh token TIDAK bisa dipakai sebagai sesi aksi lain (guard kind)', async () => {
    // requireRole & isOwnerOrAdmin harus menolak token kind 'refresh'.
    const rt = session.signToken({ role: 'kandidat', wa: '6281234567890', kind: 'refresh' });
    expect(auth.requireRole(rt, 'kandidat').error).toBeTruthy();
    expect(auth.isOwnerOrAdmin(rt, '6281234567890')).toBe(false);
    const rtAdm = session.signToken({ role: 'admin', name: 'AGUS', kind: 'refresh' });
    expect(auth.requireAdmin(rtAdm).error).toBeTruthy();
  });
});

describe('refreshAdminSession — pemulihan sesi admin diam-diam', () => {
  it('refresh token admin yang sah → sessionToken baru + nama', async () => {
    const rt = session.signToken({ role: 'admin', name: 'AGUS', kind: 'refresh' });
    const res = await handleRefreshAdminSession([rt]);
    expect(res.success).toBe(true);
    expect(res.name).toBe('AGUS');
    const t = session.verifyToken(res.sessionToken);
    expect(t.role).toBe('admin');
    expect(t.name).toBe('AGUS');
    expect(t.kind).toBeUndefined(); // token sesi biasa, bukan refresh
  });

  it('menolak token non-refresh (sesi biasa / role lain / rusak)', async () => {
    const st = session.signToken({ role: 'admin', name: 'AGUS' });
    expect((await handleRefreshAdminSession([st])).sessionInvalid).toBe(true);
    const kand = session.signToken({ role: 'kandidat', wa: '6281234567890', kind: 'refresh' });
    expect((await handleRefreshAdminSession([kand])).sessionInvalid).toBe(true);
    expect((await handleRefreshAdminSession(['bogus.token'])).sessionInvalid).toBe(true);
    expect((await handleRefreshAdminSession([''])).sessionInvalid).toBe(true);
  });
});

describe('isValidWaFormat — gate login/daftar kandidat', () => {
  it('menerima 628… 13 digit (awalan HP baku)', () => {
    expect(isValidWaFormat('6281234567890')).toBe(true);
    expect(isValidWaFormat('6282130442661')).toBe(true);
  });

  it('menerima 08xx… (dinormalisasi jadi 628…)', () => {
    expect(isValidWaFormat('081234567890')).toBe(true);
    expect(isValidWaFormat('082130442661')).toBe(true);
  });

  it('menerima 8xx… tanpa nol depan (konsisten dengan frontend)', () => {
    expect(isValidWaFormat('81234567890')).toBe(true);
    expect(isValidWaFormat('82130442661')).toBe(true);
  });

  it('menerima 628 + 9 digit (total 12)', () => {
    expect(isValidWaFormat('628123456789')).toBe(true);
  });

  it('menolak WA typo 6223… (kasus SATRIA)', () => {
    expect(isValidWaFormat('6223123456789')).toBe(false);
    expect(isValidWaFormat('622130442661')).toBe(false);
  });

  it('menolak nomor terlalu pendek / terlalu panjang', () => {
    expect(isValidWaFormat('081234')).toBe(false);
    expect(isValidWaFormat('0812345678')).toBe(false); // 628 + 8 digit → kurang
    expect(isValidWaFormat('628123456789012')).toBe(false); // 15 digit
  });

  it('menolak kosong / non-digit / awalan bukan 62', () => {
    expect(isValidWaFormat('')).toBe(false);
    expect(isValidWaFormat('abc')).toBe(false);
    expect(isValidWaFormat('71234567890')).toBe(false);
    expect(isValidWaFormat('08123456789012345678')).toBe(false);
  });
});
