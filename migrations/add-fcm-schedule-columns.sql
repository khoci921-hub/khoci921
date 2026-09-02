-- ===========================================================================
-- Migration: Tambah kolom reminder multi-level di database_schedule
-- Tanggal: 2026-08-26
-- ===========================================================================

-- Reminder H-7 (7 hari sebelum jadwal)
ALTER TABLE database_schedule
  ADD COLUMN IF NOT EXISTS reminder_h7_sent BOOLEAN DEFAULT false;

-- Reminder H-1 (1 hari sebelum jadwal)
ALTER TABLE database_schedule
  ADD COLUMN IF NOT EXISTS reminder_h1_sent BOOLEAN DEFAULT false;

-- ===========================================================================
-- CATATAN:
-- Kolom reminder_sent (H-0) sudah ada sebelumnya.
-- Kolom baru ini memungkinkan reminder bertingkat:
--   H-7 (6-8 hari) → H-1 (20-28 jam) → H-0 (≤60 menit)
-- ===========================================================================
