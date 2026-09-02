# D1. `js/03_candidate.js` — Candidate Core — Audit Report

**Date:** 2026-08-20
**File:** `js/03_candidate.js` (801 lines)
**Reviewer:** Buffy (Codebuff)

---

## Summary

| Metric        | Value                        |
| ------------- | ---------------------------- |
| Exports       | 20 functions + 3 vars        |
| callAPI calls | 5                            |
| tr() usage    | 35                           |
| DOM refs      | 58                           |
| innerHTML     | 12 (all XSS-safe with esc()) |
| Syntax        | ✅ OK                        |

---

## Findings

### F1: Hardcoded "Upload Berkas Tahap 1/2" button text (LOW)

**Locations:** Lines 653-654, 664-665, 718-719

Appears 3 times — button text hardcoded in Indonesian instead of tr().

### F2: Gender canonical values (SKIP)

`LAKI-LAKI` / `PEREMPUAN` are canonical per AGENTS.md §6 — must NOT be changed.

---

## Verdict

**CLEAN** — 0 critical, 0 medium, 1 low. Well-structured candidate module.

---

## Audit Trail

- 2026-08-20: Initial audit by Buffy
