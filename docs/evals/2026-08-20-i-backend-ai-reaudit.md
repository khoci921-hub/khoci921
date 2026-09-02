# Re-Audit: I. Backend AI (I1-I4) — 2026-08-20

## Method

Read every line of code. Cross-reference with AGENTS.md §3 (WA normalization), §6 (feature locks), §9 (security).

## I1. `ai/chat.js` (601 lines) — AI Chat

| #   | Line | Finding                                                                                                            | Severity   |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | ~470 | `handleSimpanHasilWawancara` — error returns `e.message` directly (`'Gagal simpan hasil wawancara: ' + e.message`) | **MEDIUM** |
| 2   | ~560 | `handleGetHasilWawancara` — same: `error: e.message` leaks DB internals                                            | **MEDIUM** |
| 3   | ~98  | VIP guard error message hardcoded Indonesian: "Fitur AI CV Master eksklusif..."                                    | LOW        |
| 4   | ~163 | `handleProcessAIChat` catch: hardcoded "Maaf, asisten AI sedang sibuk..."                                          | LOW        |
| 5   | ~185 | `handleProcessSiswaAIChat` catch: hardcoded "Maaf, jaringan AI sedang sibuk..."                                    | LOW        |

**Analysis:** Auth guards are solid. VIP guard fail-open on lookup error is documented and intentional. parseJsonLoose fallback is correct. Main issue: 2 error handlers leak `e.message` which can expose DB schema details.

## I2. `ai/classify.js` (155 lines) — Document Classification

| #   | Line | Finding                                                                         | Severity |
| --- | ---- | ------------------------------------------------------------------------------- | -------- |
| 1   | ~105 | Error `'File belum dipilih.'` — hardcoded Indonesian                            | LOW      |
| 2   | ~112 | Error `'File tidak bisa dibaca.'` — hardcoded Indonesian                        | LOW      |
| 3   | ~115 | Error `'File terlalu besar (maks 8 MB).'` — hardcoded Indonesian                | LOW      |
| 4   | ~120 | Error leaks file extension: `'Format tidak didukung: ' + name.split('.').pop()` | LOW      |
| 5   | ~148 | Error `'Nomor WA kandidat tidak ditemukan...'` — hardcoded Indonesian           | LOW      |

**Analysis:** Auth guard correct. 8MB limit + strict MIME allowlist solid. Gender normalization via `normalizeGender()` correct. No XSS vectors (output is JSON, not HTML).

## I3. `ai/cv.js` (397 lines) — AI CV Builder

| #   | Line | Finding                                                                                    | Severity   |
| --- | ---- | ------------------------------------------------------------------------------------------ | ---------- |
| 1   | ~340 | `handleSubmitDataAsj` catch: `message: 'Gagal simpan data: ' + e.message` leaks DB error   | **MEDIUM** |
| 2   | ~390 | `handleSimpanDataTtdNaitei` catch: `error: e.message` leaks DB error                       | **MEDIUM** |
| 3   | ~330 | `syncBiodataKeMail` call has try/catch with comment "sync mail opsional" — correct pattern | OK         |
| 4   | ~300 | `findMasterByWa` does `limit: 500` full scan — acceptable for now                          | OK         |

**Analysis:** Auth guards correct. AI_MANAGED_KEYS deep-merge pattern in handleSubmitDataAsj is solid — prevents data loss when saving AI form. The mail sync fallback is properly isolated. Main issue: 2 error handlers leak `e.message`.

## I4. `ai/providers.js` (136 lines) — AI Providers

| #   | Line | Finding                                                                                       | Severity       |
| --- | ---- | --------------------------------------------------------------------------------------------- | -------------- |
| 1   | ~80  | `fetchGemini` reads entire error response: `(await res.text()).slice(0, 120)` — truncated, OK | OK             |
| 2   | ~50  | Gemini API key passed as URL query param — this is Gemini's API design, not our choice        | OK (by design) |
| 3   | ~130 | `parseJsonLoose` — robust: strips markdown fences, extracts JSON substring                    | OK             |

**Analysis:** MODEL_TIMEOUT_MS = 7000ms is correct for Netlify's 10s function limit. Model fallback chain (flash-lite → flash-lite-latest → flash) is well-documented with dates. parseJsonLoose is defensive and correct. No issues found.

## Summary

| Severity   | Count | Action                                               |
| ---------- | ----- | ---------------------------------------------------- |
| **MEDIUM** | 4     | Fix: replace `e.message` with generic errors         |
| **LOW**    | 9     | i18n: replace hardcoded Indonesian strings with tr() |
| **OK**     | 5     | No action needed                                     |

## Fixes Applied

1. chat.js: 2 error handlers → generic messages (e.message logged server-side only)
2. cv.js: 2 error handlers → generic messages (e.message logged server-side only)
