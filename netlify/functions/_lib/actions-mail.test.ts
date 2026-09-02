// ==========================================
// TESTS: actions-mail — transisi status mail inbox + appendFeedback.
// MENUNGGU = lamaran baru; UPDATE = kandidat mengubah data setelah pernah
// diproses (progres LULUS/GAGAL tidak di-reset) — ini alur inti mail sync.
// ==========================================
import { describe, it, expect } from 'vitest';
import { mailStatusUntukUpdate, appendFeedback } from './actions-mail';
// Label seksi AI form — diimpor dari ai/cv.js (bukan duplikat) supaya test
// menjaga sinkron dengan kode produksi; simpan ini juga membuktikan tidak ada
// circular require (ai/cv → actions-mail).
import { AI_SEKSI_LABEL } from './ai/cv';

describe('mailStatusUntukUpdate — transisi status saat biodata/berkas diubah', () => {
  it('baris belum diproses (MENUNGGU/MAIL/BARU/PENDING) tetap MENUNGGU', () => {
    expect(mailStatusUntukUpdate('MENUNGGU')).toBe('MENUNGGU');
    expect(mailStatusUntukUpdate('MAIL')).toBe('MENUNGGU');
    expect(mailStatusUntukUpdate('BARU')).toBe('MENUNGGU');
    expect(mailStatusUntukUpdate('PENDING')).toBe('MENUNGGU');
    expect(mailStatusUntukUpdate('')).toBe('MENUNGGU');
  });

  it('baris sudah diproses admin → UPDATE (progres tidak di-reset)', () => {
    expect(mailStatusUntukUpdate('LULUS')).toBe('UPDATE');
    expect(mailStatusUntukUpdate('GAGAL')).toBe('UPDATE');
    expect(mailStatusUntukUpdate('REVIEW')).toBe('UPDATE');
    expect(mailStatusUntukUpdate('APPROVED')).toBe('UPDATE');
    expect(mailStatusUntukUpdate('REJECTED')).toBe('UPDATE');
  });

  it('case-insensitive (input bebas huruf besar/kecil)', () => {
    expect(mailStatusUntukUpdate('lulus')).toBe('UPDATE');
    expect(mailStatusUntukUpdate('menunggu')).toBe('MENUNGGU');
  });
});

describe('appendFeedback — riwayat aktivitas terakhir (maks 3 entri)', () => {
  it('entri baru ditaruh paling depan', () => {
    expect(appendFeedback('', '[BIODATA] email diubah')).toBe('[BIODATA] email diubah');
    expect(appendFeedback('[BIODATA] email diubah', '[UPLOAD KTP]')).toBe(
      '[UPLOAD KTP] · [BIODATA] email diubah',
    );
  });

  it('maks 3 entri — yang paling lama dibuang', () => {
    expect(appendFeedback('[A] · [B] · [C]', '[D]')).toBe('[D] · [A] · [B]');
  });
});

describe('AI_SEKSI_LABEL — label seksi ai_form untuk ringkasan mail (sync biodata)', () => {
  it('mencakup semua seksi yang dikelola form AI', () => {
    expect(AI_SEKSI_LABEL.identitas).toBe('identitas');
    expect(AI_SEKSI_LABEL.fisik).toBe('fisik & ukuran');
    expect(AI_SEKSI_LABEL.medis).toBe('medis');
    expect(AI_SEKSI_LABEL.pendidikan).toBe('pendidikan');
    expect(AI_SEKSI_LABEL.pekerjaan).toBe('pekerjaan');
    expect(AI_SEKSI_LABEL.sertifikasi).toBe('sertifikasi');
    expect(AI_SEKSI_LABEL.keluarga).toBe('keluarga');
    expect(AI_SEKSI_LABEL.wawancara).toBe('wawancara');
  });

  it('label terbaca (bukan nama kolom mentah)', () => {
    for (const label of Object.values(AI_SEKSI_LABEL)) {
      expect(label.includes('_')).toBe(false);
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('spasi ganda / pemisah kosong dibersihkan', () => {
    expect(appendFeedback('[A]  ·  ', '[B]')).toBe('[B] · [A]');
  });
});
