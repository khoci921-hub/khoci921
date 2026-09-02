# Re-Audit: J. Backend DB (J1-J8) — 2026-08-20

## Method

Read every line of code in all 8 DB files (1349 total lines). Cross-reference with AGENTS.md §3 (WA normalization), §6 (feature locks), §7 (performance).

## J1. `db/client.js` (191 lines) — Supabase Client

**Status: CLEAN** — No fixes needed.

Key points:

- normalizeWa imported from `shared/wa-rules.js` (single source of truth) ✅
- normalizeGender canonical: `LAKI-LAKI`/`PEREMPUAN` per AGENTS.md §6 ✅
- supabaseJson: error text truncated to 200 chars (server-side only) ✅
- supabasePaged: correct Range header + Content-Range parsing ✅

## J2. `db/candidates.js` (281 lines) — Candidate Queries

**Status: CLEAN** — No fixes needed.

Key points:

- mapCandidate: comprehensive 25+ column mapping with aliases ✅
- findCandidateByWaFiltered: parallel probing of 3 WA columns (Phase 3.18) ✅
- maxCandidateIdNumber: checks BOTH tables (critical fix 2026-08-16) ✅
- attachApplications: sorts by timestamp desc ✅
- findAllCandidatesLight: pagination without 300-row limit ✅

## J3. `db/forms.js` (196 lines) — Form/Application Queries

**Status: CLEAN** — No fixes needed.

Key points:

- mapForm: comprehensive column mapping with docs parsing ✅
- parseDocs: validates URL format with regex ✅
- upsertFormRow: handles 42P10 constraint-not-found gracefully ✅
- findFormsByWaList: proper in-filter with light/full fallback ✅

## J4. `db/jobs.js` (144 lines) — Job Queries

**Status: CLEAN** — No fixes needed.

Key points:

- mapJob: comprehensive column mapping, preserves raw status ✅
- findJobByCodeFiltered: tries code_job then code columns ✅
- maxJobCodeNumber: proper TG###ASJ regex extraction ✅

## J5. `db/berkas.js` (191 lines) — Berkas/Upload Queries

**Status: CLEAN** — No fixes needed.

Key points:

- BERKAS_COLUMNS: 18 doc types with multi-column fallback ✅
- attachBerkasBio: parallel fetch (berkas + master) Phase 3.18 ✅
- Map-based O(1) lookup per candidate ✅
- listStorageFolder: graceful error handling ✅

## J6. `db/master.js` (76 lines) — Master Data Queries

**Status: CLEAN** — No fixes needed.

Key points:

- fetchMasterByWa: or= query with fallback ✅
- fetchMasterLightByWa: 16-column projection (vs 154 full) ✅

## J7. `db/misc.js` (114 lines) — Assets & Settings

**Status: CLEAN** — No fixes needed.

Key points:

- queryPaged: correct Range implementation ✅
- findAssets: comprehensive nested object extraction ✅
- findPengumuman: settings fallback ✅

## J8. `candidate-helpers.js` (56 lines) — Candidate Helpers

**Status: CLEAN** — No fixes needed.

Key points:

- nextCandidateId: checks both tables (critical fix 2026-08-16) ✅
- findCandidateByWa: fast path + scan fallback ✅

## Summary

| Severity     | Count | Action           |
| ------------ | ----- | ---------------- |
| **CRITICAL** | 0     | —                |
| **MEDIUM**   | 0     | —                |
| **LOW**      | 0     | —                |
| **CLEAN**    | 8     | No action needed |

All 8 DB files are well-structured with:

- Proper error handling (try/catch with graceful fallback)
- Correct WA normalization (always via normalizeWa)
- Performance optimizations (parallel fetch, projection, pagination)
- No XSS vectors (pure data layer, no HTML rendering)
- No hardcoded strings exposed to users
