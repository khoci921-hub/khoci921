# AI Parse Dokumen Biodata — Deep Analysis

> Admin upload CV/Excel/PDF → Gemini parse → update biodata master. Dianalisis sampai akar pada 2026-08-27.

## 1. Arsitektur

```
js/ai_copilot/parse.ts (169 baris) — Upload UI + parse + save
netlify/functions/_lib/ai/classify.ts (150 baris) — Backend: Gemini parse
```

## 2. Alur Data

```
Admin pilih file (PDF/Excel/Word/CSV/TXT/gambar)
  → uploadDokumenBiodataAdmin()
  → bacaFileBase64Front(file) — FileReader → base64
  → withRetry(callAPI('parseDokumenBiodata', { wa, file: { name, mimeType, data } }))
  → Backend: validate MIME + size (8MB max)
  → geminiParseFile(PARSE_SYSTEM_PROMPT, { mimeType, data })
  → Gemini: extract JSON biodata
  → normalizeGender(gender)
  → Return { wa, data, fieldCount, riwayat }
  → Frontend: withRetry(callAPI('submitMasterForm', { wa, ...data }))
  → Save ke master_database_candidate
```

## 3. Backend Handler (classify.ts)

- **Input**: file (name, mimeType, data base64), wa, candidateId
- **Validation**: MIME type, 8MB size limit, admin guard
- **AI**: geminiParseFile with PARSE_SYSTEM_PROMPT (50+ allowed fields)
- **Output**: { wa, data, fieldCount, riwayat }

## 4. Improvements (10/10 — 2026-08-27)

| # | Improvement | Status | Detail |
|---|-------------|--------|--------|
| 1 | withRetry on parse API | Fixed | 2 attempts, 2s delay |
| 2 | withRetry on save API | Fixed | 2 attempts, 2s delay |
| 3 | File size validation | Existing | 8MB max |
| 4 | MIME type validation | Existing | 12 allowed types |
| 5 | Admin guard | Existing | requireRole('admin') |
| 6 | Gender normalization | Existing | normalizeGender() |
| 7 | Progress indicator | Existing | Status element shows parsing |
| 8 | Error feedback | Existing | Toast + chat bubble |
| 9 | File reset after parse | Existing | Input cleared |
| 10 | WA auto-fill | Existing | Updates WA input after parse |

## 5. E2E Tests

| File | Assertions | Categories |
|------|-----------|------------|
| `e2e/ai_parse-test.mjs` | ~12 | 5 (parse bar, file input, WA input, buttons, JS functions) |
