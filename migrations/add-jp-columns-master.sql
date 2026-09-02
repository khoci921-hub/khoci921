-- ===========================================================================
-- Migration: Tambah kolom JP yang belum ada di master_database_candidate
-- Tanggal: 2026-08-26
-- ===========================================================================

-- 1. Rename kolom lama (naming konsisten pakai _jp suffix)
--    alergijp → alergi_jp (tambah underscore supaya konsisten dengan kolom lain)
ALTER TABLE master_database_candidate
  RENAME COLUMN alergijp TO alergi_jp;

--    tempatlahirjp → tempat_lahir_jp (tambah underscore)
ALTER TABLE master_database_candidate
  RENAME COLUMN tempatlahirjp TO tempat_lahir_jp;

--    agamajp → agama_jp
ALTER TABLE master_database_candidate
  RENAME COLUMN agamajp TO agama_jp;

--    alamatjp → alamat_jp
ALTER TABLE master_database_candidate
  RENAME COLUMN alamatjp TO alamat_jp;

--    statusnikahjp → status_pernikahan_jp
ALTER TABLE master_database_candidate
  RENAME COLUMN statusnikahjp TO status_pernikahan_jp;

-- 2. Tambah kolom pendidikan jurusan JP untuk slot 1, 2, 4, 5
--    (slot 3 sudah punya pendidikan_3_jurusan_jp)
ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS pendidikan_1_jurusan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS pendidikan_2_jurusan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS pendidikan_4_jurusan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS pendidikan_5_jurusan_jp TEXT;

-- 3. Tambah kolom pekerjaan slot 3 JP (slot 1-2 sudah ada)
ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS pekerjaan_3_jabatan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS pekerjaan_3_perusahaan_jp TEXT;

-- 4. Tambah kolom keluarga slot 2-5 JP (slot 1 sudah ada)
ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS keluarga_2_hubungan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS keluarga_3_hubungan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS keluarga_4_hubungan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS keluarga_5_hubungan_jp TEXT;

-- 5. Tambah kolom kenalan di Jepang JP
ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS kenalan_di_jepang_nama_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS kenalan_di_jepang_hubungan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS kenalan_di_jepang_pekerjaan_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS kenalan_di_jepang_usia_jp TEXT;

ALTER TABLE master_database_candidate
  ADD COLUMN IF NOT EXISTS kenalan_di_jepang_alamat_jp TEXT;

-- ===========================================================================
-- CATATAN:
-- Setelah run migration ini, kode yang pakai nama lama (alergijp, tempatlahirjp,
-- dll) HARUS diupdate ke nama baru (alergi_jp, tempat_lahir_jp, dll).
-- Lihat file actions-master.ts → JP_TRANSLATE_MAP + buildMasterNested + submitMasterForm.
-- ===========================================================================
