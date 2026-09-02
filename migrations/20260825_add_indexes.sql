-- ============================================================
-- Migration: Add performance indexes for ASJ Portal
-- Date: 2026-08-25
-- Author: Codebuff AI audit
-- Impact: ~17 indexes across 10 tables
-- ============================================================

-- CRITICAL: database_candidate (50+ queries/day per candidate)
CREATE INDEX IF NOT EXISTS idx_cand_no_wa ON database_candidate (no_wa);
CREATE INDEX IF NOT EXISTS idx_cand_loker ON database_candidate (id_loker_pilihan);
CREATE INDEX IF NOT EXISTS idx_cand_id_kandidat ON database_candidate (id_kandidat);

-- CRITICAL: database_asj_form (mail inbox queries)
-- [REMOVED: duplicate of existing index]
-- [REMOVED: duplicate of existing index]
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_wa_job ON database_asj_form (no_wa, code_job);

-- CRITICAL: master_database_candidate (CV/AI lookups)
CREATE INDEX IF NOT EXISTS idx_master_no_wa ON master_database_candidate (no_wa);
CREATE INDEX IF NOT EXISTS idx_master_id_kandidat ON master_database_candidate (id_kandidat);

-- HIGH: pemberkasan_checklist (upload flow)
CREATE INDEX IF NOT EXISTS idx_berkas_wa ON pemberkasan_checklist (wa);
-- [REMOVED: duplicate of existing index]

-- HIGH: job_database (job lookups)
CREATE INDEX IF NOT EXISTS idx_job_code ON job_database (code_job);

-- MEDIUM: fcm_tokens (push notification)
-- [REMOVED: duplicate of existing index]

-- MEDIUM: esignatures (e-sign lookups)
-- [REMOVED: duplicate of existing index]

-- MEDIUM: ai_form_submissions (AI chat lookups)
CREATE INDEX IF NOT EXISTS idx_ai_sub_wa ON ai_form_submissions (wa);

-- MEDIUM: schedule & tugas (sort by date)
CREATE INDEX IF NOT EXISTS idx_schedule_created ON database_schedule (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tugas_created ON database_tugas (created_at DESC);
