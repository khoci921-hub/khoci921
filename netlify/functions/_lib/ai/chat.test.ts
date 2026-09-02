// ==========================================
// TESTS: ai/chat — normalizeBidang (pemilihan model wawancara per bidang SSW).
// Resolve bidang dari teks bebas (master/kandidat) ke BIDANG_INTERVIEW —
// salah map = kandidat dapat model wawancara bidang yang salah.
// ==========================================
import { describe, it, expect } from 'vitest';
import { normalizeBidang } from './chat';

describe('normalizeBidang — pilih model wawancara per bidang SSW', () => {
  it('7 bidang resmi dikenali (case-insensitive)', () => {
    expect(normalizeBidang('Kaigo').label).toBe('Kaigo (介護)');
    expect(normalizeBidang('KAIGO').label).toBe('Kaigo (介護)');
    expect(normalizeBidang('Shokuhin Seizou').label).toBe('Shokuhin Seizou (食品製造)');
    expect(normalizeBidang('Nougyou').label).toBe('Nougyou (農業)');
    expect(normalizeBidang('Kensetsu').label).toBe('Kensetsu (建設)');
    expect(normalizeBidang('Jidousha Seibi').label).toBe('Jidousha Seibi (自動車整備)');
    expect(normalizeBidang('Binbou').label).toBe('Binbou (ビルクリーニング)');
    expect(normalizeBidang('Sougou Service').label).toBe('Sougou Service (総合サービス)');
  });

  it('sinonim bahasa Indonesia/Inggris ikut terdeteksi', () => {
    expect(normalizeBidang('perawat lansia').label).toBe('Kaigo (介護)');
    expect(normalizeBidang('caregiver').label).toBe('Kaigo (介護)');
    expect(normalizeBidang('food manufacturing').label).toBe('Shokuhin Seizou (食品製造)');
    expect(normalizeBidang('pertanian').label).toBe('Nougyou (農業)');
    expect(normalizeBidang('konstruksi').label).toBe('Kensetsu (建設)');
    expect(normalizeBidang('otomotif').label).toBe('Jidousha Seibi (自動車整備)');
    expect(normalizeBidang('cleaning').label).toBe('Binbou (ビルクリーニング)');
    expect(normalizeBidang('hotel').label).toBe('Sougou Service (総合サービス)');
  });

  it('bidang tidak dikenal → null (caller pakai BIDANG_DEFAULT)', () => {
    expect(normalizeBidang('IT Programmer')).toBe(null);
    expect(normalizeBidang('')).toBe(null);
    expect(normalizeBidang(undefined)).toBe(null);
  });
});
