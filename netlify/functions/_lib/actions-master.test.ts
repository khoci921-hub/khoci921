// ==========================================
// TESTS: actions-master — kolom master yang TIDAK ada di tabel + penyimpanan
// overflow ke ai_data_json. Latar: skema master_database_candidate (154 kolom)
// tidak punya keluarga_N_gaji, keluarga slot 2-5, jurusan slot 1/2/4/5,
// pekerjaan_3_gaji, kenalan pekerjaan/usia/alamat → menulis kolom itu ke
// PATCH/POST = HTTP 400 PGRST204 = SELURUH simpan gagal (bug nyata 2026-08-16).
// ==========================================
import { describe, it, expect } from 'vitest';
import { MASTER_COLUMN_MISSING, buildAiOverflow, mergeAiOverflow } from './actions-master';

describe('MASTER_COLUMN_MISSING — kolom yang tidak ada di tabel', () => {
  it('keluarga_N_gaji & keluarga slot 2-5 masuk daftar', () => {
    expect(MASTER_COLUMN_MISSING.has('keluarga_1_gaji')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('keluarga_2_nama')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('keluarga_5_pekerjaan')).toBe(true);
  });

  it('jurusan slot 1/2/4/5 masuk daftar, slot 3 tidak (kolom ada)', () => {
    expect(MASTER_COLUMN_MISSING.has('pendidikan_1_jurusan_id')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('pendidikan_2_jurusan_id')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('pendidikan_4_jurusan_id')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('pendidikan_5_jurusan_id')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('pendidikan_3_jurusan_id')).toBe(false);
  });

  it('kenalan pekerjaan/usia/alamat masuk daftar; nama/hubungan tidak', () => {
    expect(MASTER_COLUMN_MISSING.has('kenalan_di_jepang_pekerjaan')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('kenalan_di_jepang_usia')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('kenalan_di_jepang_alamat')).toBe(true);
    expect(MASTER_COLUMN_MISSING.has('kenalan_di_jepang_nama')).toBe(false);
    expect(MASTER_COLUMN_MISSING.has('kenalan_di_jepang_hubungan')).toBe(false);
  });
});

describe('buildAiOverflow — nilai form yang kolomnya tidak ada di tabel', () => {
  it('null kalau tidak ada yang perlu disimpan', () => {
    expect(buildAiOverflow({ wa: '6281', nama: 'X' })).toBeNull();
  });

  it('kenalan → kenalan_jepang (hanya non-kosong)', () => {
    const o = buildAiOverflow({
      kenalanNama: 'KENJI',
      kenalanAlamat: 'TOKYO',
      kenalanUsia: '',
    });
    expect(o.kenalan_jepang).toEqual({
      nama_id: 'KENJI',
      alamat_id: 'TOKYO',
    });
  });

  it('jurusan slot 1 masuk (slot 3 dilewati — kolomnya ada)', () => {
    const o = buildAiOverflow({
      pendidikan: [
        { tingkat: 'SD', namaSekolah: 'SDN A', jurusan: 'IPA' },
        {},
        { tingkat: 'SMA', namaSekolah: 'SMAN B', jurusan: 'IPS' },
        {},
        {},
      ],
    });
    expect(o.pendidikan).toHaveLength(1);
    expect(o.pendidikan[0]).toEqual({
      slot: 0,
      entry: { tingkat: 'SD', sekolah: 'SDN A', jurusan_id: 'IPA' },
    });
  });

  it('gaji pekerjaan slot 3 → pekerjaan; keluarga slot 2 → keluarga', () => {
    const o = buildAiOverflow({
      pekerjaan: [{}, {}, { namaPt: 'PT X', gaji: '5.000.000' }],
      keluarga: [
        { hubungan: 'AYAH', nama: 'A', gaji: '' },
        { hubungan: 'IBU', nama: 'B', usia: 50, pekerjaan: 'IRT' },
        {},
        {},
        {},
      ],
    });
    expect(o.pekerjaan).toEqual([{ slot: 2, entry: { perusahaan: 'PT X', gaji: '5.000.000' } }]);
    expect(o.keluarga).toEqual([
      { slot: 1, entry: { nama: 'B', umur: '50', usia: '50', hubungan: 'IBU', pekerjaan: 'IRT' } },
    ]);
  });
});

describe('mergeAiOverflow — deep-merge ke ai_data_json (newest-wins, isi lama utuh)', () => {
  it('kenalan_jepang digabung tanpa menghapus isi lama', () => {
    const ai = { kenalan_jepang: { nama_id: 'KENJI', nama_jp: 'ケンジ' } };
    const out = mergeAiOverflow(ai, {
      kenalan_jepang: { alamat_id: 'TOKYO', nama_jp: 'ケンジ2' },
    });
    expect(out.kenalan_jepang).toEqual({
      nama_id: 'KENJI',
      nama_jp: 'ケンジ2',
      alamat_id: 'TOKYO',
    });
  });

  it('pendidikan dicocokkan per sekolah; data lama (sekolah_jp) dipertahankan', () => {
    const ai = {
      pendidikan: [{ tingkat: 'SD', sekolah: 'SDN A', sekolah_jp: 'Ａ小学校' }],
    };
    const out = mergeAiOverflow(ai, {
      pendidikan: [{ slot: 0, entry: { tingkat: 'SD', sekolah: 'SDN A', jurusan_id: 'IPA' } }],
    });
    expect(out.pendidikan[0]).toEqual({
      tingkat: 'SD',
      sekolah: 'SDN A',
      sekolah_jp: 'Ａ小学校',
      jurusan_id: 'IPA',
    });
  });

  it('keluarga slot baru diisi sampai index slot', () => {
    const out = mergeAiOverflow(
      { keluarga: [{ nama: 'A' }] },
      { keluarga: [{ slot: 2, entry: { nama: 'C', hubungan: 'ADIK' } }] },
    );
    expect(out.keluarga).toEqual([{ nama: 'A' }, {}, { nama: 'C', hubungan: 'ADIK' }]);
  });
});
