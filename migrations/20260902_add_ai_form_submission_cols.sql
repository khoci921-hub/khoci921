-- ===========================================================================
-- Migration: tambah kolom ai_form_submissions.submitted_by
-- Tanggal:   2026-09-02
-- Gejala:    Kandidat/siswa klik "SIMPAN DB" di ai_form.html → tidak tersimpan,
--            dan tidak ada pesan apa pun di layar.
-- Status:    SUDAH DIVERIFIKASI lewat information_schema (2026-09-02).
-- ===========================================================================
--
-- HASIL DIAGNOSTIK ai_form_submissions (produksi)
--   id             bigint
--   created_at     timestamp with time zone
--   updated_at     timestamp with time zone
--   wa             text
--   nama_lengkap   text
--   mode           text
--   job_code       text
--   bidang         text
--   status         text
--   ai_data_json   jsonb
--   ai_updated_at  timestamp with time zone   ✅ SUDAH ADA
--   photo_url      text
--   jft_url        text
--   ssw_url        text
--   submitted_via  text
--   submitted_by   -- TIDAK ADA  ❌ PENYEBAB GAGAL SIMPAN
--
-- KENAPA INI MEMATIKAN SIMPAN
-- netlify/functions/_lib/ai/cv.ts (handleSubmitDataAsj) mengirim kolom
-- `submitted_by` di body INSERT/PATCH. PostgREST menolak SELURUH write dengan
-- HTTP 400 PGRST204 — "Could not find the 'submitted_by' column of
-- 'ai_form_submissions' in the schema cache" — jadi tidak ada satu pun baris
-- yang tersimpan. Pola bug ini sama dengan yang sudah didokumentasikan di
-- netlify/functions/_lib/actions-master.ts (MASTER_COLUMN_MISSING).
--
-- CATATAN ai_data_json (jsonb)
-- Kode mengirim JSON.stringify(...) sehingga tersimpan sebagai jsonb string.
-- Ini memang konvensi yang sudah dipakai di master_database_candidate
-- (dibaca kembali dengan JSON.parse) — TIDAK perlu diubah.
--
-- CARA PAKAI
--   Jalankan di Supabase → SQL Editor. Tidak perlu deploy ulang.
--   Aman dijalankan berulang (IF NOT EXISTS).
-- ===========================================================================

ALTER TABLE ai_form_submissions
  ADD COLUMN IF NOT EXISTS submitted_by TEXT;

-- Isi nilai baris lama supaya laporan tidak bolong.
UPDATE ai_form_submissions
   SET submitted_by = 'kandidat'
 WHERE submitted_by IS NULL;

-- Opsional: index untuk filter/laporan berdasarkan siapa yang menyimpan.
-- CREATE INDEX IF NOT EXISTS idx_ai_sub_by ON ai_form_submissions (submitted_by);
