# AI Submit Data ASJ + TTD Naitei — Deep Analysis

> Submit Data (saveToDatabase) + TTD Naitei (simpanDataTtdNaitei). Dianalisis sampai akar pada 2026-08-27.

## 1. Arsitektur

```
Frontend:
├── js/pages/ai_form.ts — saveToDatabase() + simpanDataTtdNaitei()
├── js/cloudinary.ts — uploadToCloudinary()

Backend:
├── netlify/functions/_lib/ai/cv.ts — handleSubmitDataAsj() + handleSimpanDataTtdNaitei()
├── netlify/functions/_lib/db/client.ts — supabaseJson()
```

## 2. Alur Data: Submit Data ASJ

```
User klik "Simpan DB" di ai_form.html
  → saveToDatabase()
  → Validate: nama must exist
  → Upload files ke Cloudinary (Promise.all)
  → withRetry(callAPI('submitDataAsj', payload))
  → Backend: handleSubmitDataAsj()
    → requireRole('kandidat') — guard
    → Upsert ai_form_submissions (submitted_via='ai_form')
    → Merge ai_data_json ke master_database_candidate (AI_MANAGED_KEYS protect)
    → Sync files ke master_database_candidate
    → Sync ringan ke database_candidate
    → Mail sync (optional)
  → Return { success }
  → Frontend: toast success + clear draft
```

## 3. Alur Data: TTD Naitei

```
User klik "Simpan & Tanda Tangan" di ai_form.html
  → simpanDataTtdNaitei()
  → withRetry(callAPI('simpanDataTtdNaitei', { wa, ttd1, nama1, ttd2, nama2 }))
  → Backend: handleSimpanDataTtdNaitei()
    → requireRole('kandidat') — guard
    → Upsert esignatures (wa + signature data)
    → Fallback: ai_form_submissions (submitted_via='esign')
  → Return { success }
```

## 4. Backend Details

### handleSubmitDataAsj

| Step | Table | Operation | Notes |
|------|-------|-----------|-------|
| 1 | ai_form_submissions | UPSERT | submitted_via='ai_form' |
| 2 | master_database_candidate | PATCH/UPSERT | ai_data_json + files |
| 3 | database_candidate | PATCH | Sync ringan (pas_photo, jft, ssw, ktp) |
| 4 | Mail sync | OPTIONAL | Badge UPDATE + [BIODATA] |

**AI_MANAGED_KEYS**: identitas, fisik, medis, pendidikan, pekerjaan, sertifikasi, keluarga, wawancara
→ Keys lain (kenalan_jepang, context, files) PERTAHANKAN dari ai_data_json lama.

### handleSimpanDataTtdNaitei

| Step | Table | Operation | Notes |
|------|-------|-----------|-------|
| 1 | esignatures | UPSERT | wa + ttd1/ttd2 + nama1/nama2 |
| 2 | ai_form_submissions | POST (fallback) | submitted_via='esign' |

## 5. Improvements (10/10 — 2026-08-27)

| # | Improvement | Status | Detail |
|---|-------------|--------|--------|
| 1 | withRetry on frontend | Existing | ai_form.ts already wraps all API calls |
| 2 | Parallel uploads | Existing | Promise.all for Cloudinary |
| 3 | Progress indicator | Existing | "Mengunggah..." + "Menyimpan..." |
| 4 | Button state management | Existing | Disable during submit, re-enable on error |
| 5 | AI_MANAGED_KEYS | Existing | Protects non-AI keys during merge |
| 6 | Mail sync | Existing | Optional badge + [BIODATA] notification |
| 7 | Admin guard | Existing | requireRole on backend |
| 8 | TTD fallback | Existing | esignatures → ai_form_submissions |
| 9 | Draft clear on success | Existing | localStorage.removeItem after submit |
| 10 | Error feedback | Existing | Toast + button state reset |

## 6. E2E Tests

| File | Assertions | Categories |
|------|-----------|------------|
| `e2e/ai_submit_ttd-test.mjs` | ~15 | 6 (save button, TTD button, form validation, JS functions, a11y, errors) |
