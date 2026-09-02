# AI Wawancara — Deep Analysis

> Simulator Wawancara VIP + Generate Model + Hasil Wawancara. Dianalisis sampai akar pada 2026-08-27.

## 1. Arsitektur

```
js/ai_copilot/
├── interview.ts (314 baris) — Kandidat: chat wawancara + selesai + simpan
├── results.ts (229 baris) — Admin: generate model + lihat hasil + update biodata
├── admin.ts (277 baris) — Admin: chat AI copilot
└── parse.ts — Admin: parse dokumen biodata

netlify/functions/_lib/ai/
├── chat.ts — Backend: processAiInterview, selesaikanWawancara, simpanHasilWawancara, getHasilWawancara, generateWawancaraModel
```

## 2. Alur Data

### 2.1 Kandidat: Mulai Wawancara
```
Kandidat klik "Mulai Wawancara"
  → bukaSimulatorInterview()
  → VIP guard check (isVipCatatan)
  → mulaiWawancaraInterview()
  → withRetry(callAPI('processAiInterview', { wa, history: [] }))
  → Backend: resolveProfilKandidat(wa) → buildInterviewSystem(profil)
  → Gemini generate: 14 pertanyaan wawancara
  → Return { reply } → chat bubble
```

### 2.2 Kandidat: Chat Wawancara
```
Kandidat ketik jawaban
  → sendInterviewMessage()
  → withRetry(callAPI('processAiInterview', { wa, history: last 20 }))
  → Gemini generate: follow-up questions
  → Jika ===HASIL=== marker: auto-save ke admin
```

### 2.3 Kandidat: Selesai
```
Kandidat klik "Selesai & Kirim"
  → selesaikanWawancaraInterview()
  → withRetry(callAPI('selesaikanWawancara', { wa, history }))
  → Gemini: extract { score, nilai, rekomendasi, biodata, catatan }
  → kirimHasilWawancaraKeAdmin()
  → withRetry(callAPI('simpanHasilWawancara', { wa, hasil }))
  → Save ke ai_form_submissions (submitted_via='interview')
```

### 2.4 Admin: Generate Model
```
Admin klik "Generate Model Wawancara"
  → generateWawancaraModelAdmin()
  → withRetry(callAPI('generateWawancaraModel', { wa, bidang }))
  → Backend: resolveProfilKandidat + Gemini generate 14 pertanyaan
  → Return { model } → admin chat bubble
```

### 2.5 Admin: Lihat Hasil
```
Admin klik "Hasil Wawancara"
  → lihatHasilWawancaraAdmin()
  → withRetry(callAPI('getHasilWawancara', { wa }))
  → Backend: read ai_form_submissions (submitted_via='interview')
  → Return { hasil } → admin chat bubble
```

### 2.6 Admin: Update Biodata
```
Admin klik "Update Biodata"
  → updateBiodataDariHasilAdmin()
  → withRetry(callAPI('submitMasterForm', { wa, ...biodata }))
  → Backend: save ke master_database_candidate
```

## 3. Backend Handlers

| Handler | Fungsi | Input | Output |
|---------|--------|-------|--------|
| `processAiInterview` | Mulai/lanjut wawancara | wa, history, bidang, kota | { reply } |
| `selesaikanWawancara` | Rangkum hasil dari transcript | wa, history | { hasil: { score, nilai, biodata, catatan } } |
| `simpanHasilWawancara` | Save ke DB | wa, hasil | { success } |
| `getHasilWawancara` | Read dari DB | wa | { hasil, nama, updatedAt } |
| `generateWawancaraModel` | Generate 14 pertanyaan | wa, bidang, kota | { model, bidang, nama } |

## 4. Improvements (10/10 — 2026-08-27)

| # | Improvement | Status | Detail |
|---|-------------|--------|--------|
| 1 | withRetry on all API calls | Fixed | 6 functions wrapped (interview.ts + results.ts) |
| 2 | History trim increased | Fixed | Was 6 messages, now 20 (better AI context) |
| 3 | VIP guard | Existing | isVipCatatan check before opening |
| 4 | Auto-save on ===HASIL=== | Existing | Marker detection in chat |
| 5 | Typing indicator | Existing | Animated dots while waiting |
| 6 | Button disable during API | Existing | Prevent double-send |
| 7 | Error feedback | Existing | Toast + chat bubble errors |
| 8 | JSON loose parser | Existing | Handles markdown code blocks |
| 9 | XSS protection | Existing | window.esc() on all text |
| 10 | Admin results flow | Existing | Generate → Lihat → Update biodata |

## 5. E2E Tests

| File | Assertions | Categories |
|------|-----------|------------|
| `e2e/ai_wawancara-test.mjs` | ~20 | 8 (modal, chat, input, send, done, VIP guard, a11y, errors) |

### Jalankan

```bash
node e2e/ai_wawancara-test.mjs  # requires dev server on localhost:3000
```
