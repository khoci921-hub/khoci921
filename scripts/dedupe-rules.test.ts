// ==========================================
// TESTS: dedupe-rules — aturan merge kandidat duplikat.
// Aturan ini melindungi data asli saat dedupe (--apply): status keputusan
// admin (LULUS > GAGAL > REVIEW > UPDATE > MENUNGGU) dan data terbaru tidak
// boleh hilang. Test di sini = kontrak aturan.
// ==========================================
import { describe, it, expect } from 'vitest';
import {
  pickKeeper,
  formPrio,
  mergeJsonDeep,
  mergeAiJson,
  mergeFillLatest,
  mergeDocs,
  mergeFeedback,
  mergeCatatanInternal,
  levenshtein,
  preferWa,
  fuzzyCluster,
  fixWaKeeper,
} from './dedupe-rules.mjs';

describe('pickKeeper — strategi baris penjaga', () => {
  const row = (status, updated, id) => ({ status, updated_at: updated, id });

  it('status LULUS > GAGAL > REVIEW > UPDATE > MENUNGGU', () => {
    const rows = [
      row('MENUNGGU', '2026-01-01', 1),
      row('LULUS', '2026-01-01', 2),
      row('GAGAL', '2026-01-01', 3),
      row('UPDATE', '2026-01-01', 4),
    ];
    expect(pickKeeper(rows, { prio: formPrio }).id).toBe(2);
  });

  it('status sama → updated_at terbaru', () => {
    const rows = [row('MENUNGGU', '2026-01-01', 1), row('MENUNGGU', '2026-02-01', 2)];
    expect(pickKeeper(rows, { prio: formPrio }).id).toBe(2);
  });

  it('status & waktu sama → id terbesar', () => {
    const rows = [row('MENUNGGU', '2026-01-01', 5), row('MENUNGGU', '2026-01-01', 9)];
    expect(pickKeeper(rows, { prio: formPrio }).id).toBe(9);
  });

  it('status tak dikenal dianggap paling rendah (tidak menang)', () => {
    const rows = [row('ANEKA', '2026-02-01', 1), row('MENUNGGU', '2026-01-01', 2)];
    expect(pickKeeper(rows, { prio: formPrio }).id).toBe(2);
  });
});

describe('mergeJsonDeep / mergeAiJson — snapshot tidak boleh hilang', () => {
  it('deep-merge object, newest-wins per leaf', () => {
    const oldSnap = { nama: 'Budi', tb: '170', alamat: { kota: 'Jakarta', rt: '01' } };
    const newSnap = { nama: 'Budi', tb: '172', alamat: { kota: 'Bandung' } };
    const out = mergeJsonDeep(oldSnap, newSnap);
    expect(out).toEqual({ nama: 'Budi', tb: '172', alamat: { kota: 'Bandung', rt: '01' } });
  });

  it('nilai kosong tidak menimpa (skip empty)', () => {
    const out = mergeJsonDeep({ tb: '170' }, { tb: '', alamat: 'x' });
    expect(out.tb).toBe('170');
    expect(out.alamat).toBe('x');
  });

  it('mergeAiJson: beberapa snapshot digabung newest-wins', () => {
    const rows = [
      { updated_at: '2026-01-01', ai_data_json: { nama: 'A', tb: '170', hp: '1' } },
      { updated_at: '2026-02-01', ai_data_json: { nama: 'A', tb: '175' } },
    ];
    const out = mergeAiJson(rows);
    expect(out).toEqual({ nama: 'A', tb: '175', hp: '1' });
  });

  it('mergeAiJson: baris tanpa ai_data_json diabaikan', () => {
    expect(mergeAiJson([{ updated_at: 'x' }, { updated_at: 'y' }])).toBeNull();
  });
});

describe('mergeFillLatest — biodata terbaru menang', () => {
  it('nilai terbaru terisi dipakai walau penjaga kosong', () => {
    const rows = [
      { updated_at: '2026-01-01', email: 'lama@x.id' },
      { updated_at: '2026-02-01', email: '' },
      { updated_at: '2026-03-01', email: 'baru@x.id' },
    ];
    const { body } = mergeFillLatest(rows, ['email']);
    expect(body.email).toBe('baru@x.id');
  });
});

describe('mergeDocs / mergeFeedback / mergeCatatanInternal — dokumen & tag tidak hilang', () => {
  it('mergeDocs menggabung kamus keterangan', () => {
    const out = mergeDocs({ keterangan: 'KTP:a.pdf' }, [{ keterangan: 'JFT:b.pdf;KTP:a.pdf' }]);
    expect(out).toBe('KTP:a.pdf;JFT:b.pdf');
  });

  it('mergeFeedback gabung unik, urutan penjaga dulu', () => {
    const out = mergeFeedback({ feedback_berkas: '[UPLOAD KTP] · [BIODATA]' }, [
      { feedback_berkas: '[BIODATA] · [UPLOAD KK]' },
    ]);
    expect(out).toBe('[UPLOAD KTP] · [BIODATA] · [UPLOAD KK]');
  });

  it('mergeCatatanInternal: tag [VIP] dari baris lain tidak hilang', () => {
    const out = mergeCatatanInternal({ catatan_internal: 'teks bebas' }, [
      { catatan_internal: '[VIP] [KELAS 1]' },
    ]);
    expect(out).toContain('[VIP]');
    expect(out).toContain('[KELAS 1]');
    expect(out).toContain('teks bebas');
  });
});

describe('fuzzy merge — WA typo (kasus SATRIA)', () => {
  it('levenshtein dasar', () => {
    // 6282342782945 → 622342782945 = kehilangan 1 digit '8' (jarak 1, ≤ 2 → digabung)
    expect(levenshtein('6282342782945', '622342782945')).toBe(1);
    expect(levenshtein('6282342782945', '6223342782945')).toBe(2);
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('fuzzyCluster menggabung nama sama + WA mirip (edit <= 2)', () => {
    const groups = new Map([
      ['a', [{ id: 1, no_wa: '6282342782945', nama_lengkap: 'SATRIA' }]],
      ['b', [{ id: 2, no_wa: '622342782945', nama_lengkap: 'SATRIA' }]],
      ['c', [{ id: 3, no_wa: '6281234567890', nama_lengkap: 'BUDI' }]],
    ]);
    const out = fuzzyCluster(groups);
    // a & b menyatu (2 baris), c terpisah
    const sizes = [...out.values()].map((r) => r.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it('nama berbeda tidak digabung walau WA mirip', () => {
    const groups = new Map([
      ['a', [{ id: 1, no_wa: '6282342782945', nama_lengkap: 'SATRIA' }]],
      ['b', [{ id: 2, no_wa: '622342782945', nama_lengkap: 'SUTRIA' }]],
    ]);
    expect(fuzzyCluster(groups).size).toBe(2);
  });

  it('preferWa memilih 628 + digit terbanyak', () => {
    expect(preferWa(['622342782945', '6282342782945'])).toBe('6282342782945');
  });

  it('fixWaKeeper membetulkan no_wa penjaga ke kanonik', () => {
    const keeper = { no_wa: '622342782945' };
    const body = fixWaKeeper(keeper, [{ no_wa: '6282342782945' }], {});
    expect(body.no_wa).toBe('6282342782945');
  });
});
