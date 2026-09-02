-- ============================================================
-- Migration: Index Performa + Anti-Duplikat — ASJ Portal
-- Date: 2026-08-25
--
-- URUTAN EKSEKUSI WAJIB:
--   1. SECTION 1 (index performa)      -> aman langsung
--   2. SECTION 2 (cek duplikat)        -> read-only, lihat hasil
--   3. SECTION 3 (hapus duplikat)      -> HANYA jika SECTION 2 ada hasil
--   4. SECTION 4 (UNIQUE anti-duplikat)-> setelah data bersih
-- ============================================================

-- ############################################################
-- SECTION 1: INDEX PERFORMA (fetch cepat) — IF NOT EXISTS, aman berulang
-- ############################################################

-- database_candidate: lookup by WA, loker, ID kandidat
-- [DROPPED 2026-08-25] redundant — idx_dc_no_wa_loker btree (no_wa, id_loker_pilihan) prefix covers
CREATE INDEX IF NOT EXISTS idx_cand_loker ON database_candidate (id_loker_pilihan);
CREATE INDEX IF NOT EXISTS idx_cand_id_kandidat ON database_candidate (id_kandidat);

-- database_asj_form: mail inbox (1 kandidat x 1 job) — unik
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_wa_job ON database_asj_form (no_wa, code_job);

-- master_database_candidate: CV/AI lookup
CREATE INDEX IF NOT EXISTS idx_master_id_kandidat ON master_database_candidate (id_kandidat);

-- pemberkasan_checklist: upload flow
CREATE INDEX IF NOT EXISTS idx_berkas_wa ON pemberkasan_checklist (wa);

-- job_database: lookup job
CREATE INDEX IF NOT EXISTS idx_job_code ON job_database (code_job);

-- ai_form_submissions
CREATE INDEX IF NOT EXISTS idx_ai_sub_wa ON ai_form_submissions (wa);

-- schedule & tugas: sort tanggal terbaru
CREATE INDEX IF NOT EXISTS idx_schedule_created ON database_schedule (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tugas_created ON database_tugas (created_at DESC);

-- ############################################################
-- SECTION 2: DETEKSI DUPLIKAT (read-only — lihat hasil dulu!)
-- Hasil 0 baris = bersih, lompat ke SECTION 4.
-- ############################################################

-- 2a. Duplikat kandidat per no_wa
SELECT no_wa, COUNT(*) AS jumlah, string_agg(COALESCE(nama_lengkap,'?') || ' (id=' || id || ')', ' | ') AS baris
FROM database_candidate
WHERE no_wa IS NOT NULL AND no_wa <> ''
GROUP BY no_wa HAVING COUNT(*) > 1
ORDER BY jumlah DESC;

-- 2b. Duplikat lamaran per (no_wa, code_job)
SELECT no_wa, code_job, COUNT(*) AS jumlah
FROM database_asj_form
WHERE no_wa IS NOT NULL AND no_wa <> '' AND code_job IS NOT NULL AND code_job <> ''
GROUP BY no_wa, code_job HAVING COUNT(*) > 1
ORDER BY jumlah DESC;

-- 2c. Duplikat master CV per no_wa
SELECT no_wa, COUNT(*) AS jumlah
FROM master_database_candidate
WHERE no_wa IS NOT NULL AND no_wa <> ''
GROUP BY no_wa HAVING COUNT(*) > 1
ORDER BY jumlah DESC;

-- 2d. Duplikat berkas per (wa, tahap)
SELECT wa, tahap, COUNT(*) AS jumlah
FROM pemberkasan_checklist
WHERE wa IS NOT NULL AND wa <> '' AND tahap IS NOT NULL
GROUP BY wa, tahap HAVING COUNT(*) > 1
ORDER BY jumlah DESC;

-- ############################################################
-- SECTION 3: DEDUPE (HAPUS DUPLIKAT — mutasi data!)
-- Aturan keeper (sama dgn scripts/dedupe-duplicates.mjs):
--   status LULUS > GAGAL > REVIEW > UPDATE > MENUNGGU,
--   lalu updated_at terbaru, lalu id terbesar.
-- Kalau error 'column updated_at does not exist' -> ganti jadi created_at.
-- ############################################################

-- 3a. database_candidate: sisakan 1 baris terbaik per no_wa
WITH ranked AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY no_wa
           ORDER BY CASE UPPER(COALESCE(status_kandidat, ''))
                      WHEN 'LULUS' THEN 1 WHEN 'GAGAL' THEN 2
                      WHEN 'REVIEW' THEN 3 WHEN 'REVIEW ADMIN' THEN 3
                      WHEN 'UPDATE' THEN 4 ELSE 5 END ASC,
                    updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM database_candidate
  WHERE no_wa IS NOT NULL AND no_wa <> ''
)
DELETE FROM database_candidate WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1);

-- 3b. database_asj_form: sisakan 1 per (no_wa, code_job)
WITH ranked AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY no_wa, code_job
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM database_asj_form
  WHERE no_wa IS NOT NULL AND no_wa <> '' AND code_job IS NOT NULL AND code_job <> ''
)
DELETE FROM database_asj_form WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1);

-- 3c. master_database_candidate: sisakan 1 per no_wa
WITH ranked AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY no_wa
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM master_database_candidate
  WHERE no_wa IS NOT NULL AND no_wa <> ''
)
DELETE FROM master_database_candidate WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1);

-- 3d. pemberkasan_checklist: sisakan 1 per (wa, tahap)
WITH ranked AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY wa, tahap
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM pemberkasan_checklist
  WHERE wa IS NOT NULL AND wa <> '' AND tahap IS NOT NULL
)
DELETE FROM pemberkasan_checklist WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1);

-- ############################################################
-- SECTION 4: UNIQUE INDEX ANTI-DUPLIKAT (jalankan setelah bersih)
-- Setelah ini, INSERT duplikat dari mana pun DITOLAK database
-- dengan error 'duplicate key value' — duplikasi mustahil terjadi lagi.
-- ############################################################

-- Kandidat: 1 baris per no_wa
CREATE UNIQUE INDEX IF NOT EXISTS idx_cand_no_wa_uniq ON database_candidate (no_wa);

-- Master CV: 1 baris per no_wa
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_no_wa_uniq ON master_database_candidate (no_wa);

-- Berkas: 1 baris per (wa, tahap)
-- [DROPPED 2026-08-25] redundant — idx_pemberkasan_wa_tahap UNIQUE (wa,tahap) sudah ada

-- Lamaran (no_wa, code_job): sudah unik via idx_form_wa_job di SECTION 1.

-- ############################################################
-- SECTION 5 (BONUS): DASHBOARD DUPLIKAT — ringkasan 1 query
-- Jalankan kapan saja (read-only) untuk pantau kesehatan data.
--   dup_count  = jumlah kunci yang punya >1 baris
--   extra_rows = total baris lebih yang bisa dihemat
-- ############################################################
SELECT 'database_candidate (per no_wa)' AS tabel,
       COUNT(*) AS dup_count,
       COALESCE(SUM(jml - 1), 0) AS extra_rows
FROM (SELECT no_wa, COUNT(*) AS jml FROM database_candidate
      WHERE no_wa IS NOT NULL AND no_wa <> ''
      GROUP BY no_wa HAVING COUNT(*) > 1) d
UNION ALL
SELECT 'database_asj_form (per no_wa+code_job)',
       COUNT(*), COALESCE(SUM(jml - 1), 0)
FROM (SELECT no_wa, code_job, COUNT(*) AS jml FROM database_asj_form
      WHERE no_wa IS NOT NULL AND no_wa <> '' AND code_job IS NOT NULL AND code_job <> ''
      GROUP BY no_wa, code_job HAVING COUNT(*) > 1) d
UNION ALL
SELECT 'master_database_candidate (per no_wa)',
       COUNT(*), COALESCE(SUM(jml - 1), 0)
FROM (SELECT no_wa, COUNT(*) AS jml FROM master_database_candidate
      WHERE no_wa IS NOT NULL AND no_wa <> ''
      GROUP BY no_wa HAVING COUNT(*) > 1) d
UNION ALL
SELECT 'pemberkasan_checklist (per wa+tahap)',
       COUNT(*), COALESCE(SUM(jml - 1), 0)
FROM (SELECT wa, tahap, COUNT(*) AS jml FROM pemberkasan_checklist
      WHERE wa IS NOT NULL AND wa <> '' AND tahap IS NOT NULL
      GROUP BY wa, tahap HAVING COUNT(*) > 1) d
ORDER BY dup_count DESC;

-- Hasil sehat = semua dup_count 0.
-- Setelah SECTION 4 (UNIQUE index) terpasang, query ini selalu 0 —
-- database menolak duplikat baru otomatis.

-- ############################################################
-- VERIFIKASI AKHIR: lihat semua index terpasang
-- ############################################################
-- SELECT tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('database_candidate','database_asj_form',
--                     'master_database_candidate','pemberkasan_checklist',
--                     'job_database','ai_form_submissions',
--                     'database_schedule','database_tugas')
-- ORDER BY tablename, indexname;
