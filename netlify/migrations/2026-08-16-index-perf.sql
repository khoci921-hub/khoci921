-- =============================================================================
-- 2026-08-16 — Index performa ASJ Portal (Supabase / PostgreSQL)
-- -----------------------------------------------------------------------------
-- Latar belakang: getAppData admin menarik SEMUA baris database_candidate
-- (full scan tanpa limit), mengurutkan 500 baris database_asj_form per
-- timestamp, dan melakukan ILIKE '%kode%' pada id_loker_pilihan. Tanpa index,
-- query tersebut full table scan + sort penuh — beban naik linear seiring
-- tabel tumbuh (penyebab "mulai lambat").
--
-- Cara pakai: buka Supabase → SQL Editor → tempel seluruh file → Run.
-- SEMUA statement idempotent (IF NOT EXISTS) — aman dijalankan ulang.
-- Kalau sebuah statement error "column does not exist" (skema project beda),
-- HAPUS statement itu saja; sisanya tetap aman dijalankan.
--
-- Tidak ada perubahan perilaku aplikasi — murni performa. Bisa dijalankan
-- kapan pun tanpa downtime (PostgreSQL membuat index paralel).
--
-- REVISI 2026-08-16 (sesi lanjutan): idx_cand_no_wa & idx_master_no_wa
-- dihapus dari daftar CREATE — redundan dengan index lama yang sudah ada
-- (idx_dc_no_wa_loker & constraint unik no_wa). File ini kini idempotent
-- penuh: CREATE yang diperlukan + DROP cleanup di section 4, jadi aman
-- ditempel ulang utuh kapan pun (tidak membuat ulang index redundan).
-- =============================================================================

-- 1) Inbox form (database_asj_form)
--    Q2: ORDER BY timestamp DESC LIMIT 500 → index (timestamp DESC) membuat
--        PostgreSQL cukup ambil 500 baris teratas, tanpa sort seluruh tabel.
CREATE INDEX IF NOT EXISTS idx_asj_form_timestamp
  ON database_asj_form (timestamp DESC);

--    Lookup per WA (findFormsByWa, findFormsByWaList — filter no_wa IN ...)
CREATE INDEX IF NOT EXISTS idx_asj_form_no_wa
  ON database_asj_form (no_wa);

--    Lookup per kode job (lamaran per loker)
CREATE INDEX IF NOT EXISTS idx_asj_form_code_job
  ON database_asj_form (code_job);

-- 2) Kandidat (database_candidate)
--    Q1: dedupe+sort by updated_at → index (updated_at DESC) mempercepat
--        ambil halaman terbaru & sort (masih full scan oleh desain, tapi
--        sort tidak lagi dilakukan di memori PostgreSQL).
CREATE INDEX IF NOT EXISTS idx_cand_updated_at
  ON database_candidate (updated_at DESC);

--    Lookup per WA (findCandidateByWaFiltered) — REVISI 2026-08-16: index
--    idx_cand_no_wa TIDAK dibuat lagi. Sudah dilayani index lama
--    idx_dc_no_wa_loker (btree (no_wa, id_loker_pilihan) — no_wa di posisi
--    pertama, prefix btree melayani query no_wa = ? / IN). Lihat section 4.

--    Q4: kandidat per job — id_loker_pilihan di-query pakai ILIKE '%kode%'
--        (wildcard KIRI). Index btree TIDAK bisa dipakai; trigram (pg_trgm)
--        memungkinkan GIN index utk pola seperti itu.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_cand_loker_trgm
  ON database_candidate USING gin (id_loker_pilihan gin_trgm_ops);

-- 3) Berkas & bio (batch IN filter di getAppData admin)
CREATE INDEX IF NOT EXISTS idx_berkas_wa
  ON pemberkasan_checklist (wa);

--    REVISI 2026-08-16: idx_master_no_wa TIDAK dibuat lagi — redundan dengan
--    constraint unik master_database_candidate_no_wa_key (UNIQUE btree no_wa;
--    index constraint juga melayani lookup no_wa = ? / IN). Lihat section 4.

-- 4) PEMBERSIHAN index redundan (revisi 2026-08-16)
--    Dihapus dari daftar CREATE di atas karena sudah dilayani index lama.
--    DROP IF EXISTS = idempotent; aman dijalankan ulang kapan pun.
--    a) idx_cand_no_wa  → redundan dgn idx_dc_no_wa_loker ((no_wa, id_loker_pilihan))
--    b) idx_master_no_wa → redundan dgn master_database_candidate_no_wa_key (UNIQUE no_wa)
DROP INDEX IF EXISTS idx_cand_no_wa;
DROP INDEX IF EXISTS idx_master_no_wa;

--    (opsional) idx_berkas_wa (pemberkasan_checklist) kemungkinan juga
--    redundan dgn idx_pemberkasan_wa_tahap bila kolom pertama index lama = wa.
--    Tabel kecil (±5 baris) → dampak ~nol; cek dulu sebelum drop:
--      SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_pemberkasan_wa_tahap';
--    Kalau definisinya (wa, ...) → jalankan: DROP INDEX IF EXISTS idx_berkas_wa;

-- =============================================================================
-- VERIFIKASI (jalankan setelah index dibuat)
-- -----------------------------------------------------------------------------
-- 1) Pastikan index benar-benar dipakai (idx_scan naik, seq_scan turun):
--
--    SELECT relname, seq_scan, idx_scan, seq_tup_read
--    FROM pg_stat_user_tables
--    WHERE relname IN ('database_candidate','database_asj_form',
--                      'pemberkasan_checklist','master_database_candidate')
--    ORDER BY seq_scan DESC;
--
-- 2) Cek rencana eksekusi query utama (sebelum vs sesudah index):
--
--    EXPLAIN (ANALYZE, BUFFERS)
--    SELECT id, timestamp, code_job, kategory, nama_lengkap, no_wa, status
--    FROM database_asj_form
--    ORDER BY timestamp DESC LIMIT 500;
--
--    EXPLAIN (ANALYZE, BUFFERS)
--    SELECT id, id_kandidat, nama_lengkap, no_wa, status_kandidat,
--           updated_at, created_at, tanggal_daftar
--    FROM database_candidate
--    ORDER BY updated_at DESC;
--
--    EXPLAIN (ANALYZE, BUFFERS)
--    SELECT * FROM database_candidate
--    WHERE id_loker_pilihan ILIKE '%TG9ASJ%' LIMIT 500;
-- =============================================================================
