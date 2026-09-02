# ai_form.html — Deep Analysis

> Halaman AI CV (Qween Jeklin) — Chat AI + Form CV Bilingual. Dianalisis sampai akar pada 2026-08-27.

## 1. Arsitektur Halaman

```
ai_form.html (412 baris)
├── <head> — Meta, CSS inline, shared partials
├── <body data-page="ai-form"> — Split view (chat + form)
│   ├── BACK TO PORTAL — Tombol kembali (fixed top-left)
│   ├── SKIP LINK — Aksesibilitas
│   ├── MOBILE TAB BAR — Chat Jeklin | Preview CV (mobile only)
│   ├── CHAT PANEL (35% desktop / full mobile)
│   │   ├── Chat Header — Logo Jeklin + status
│   │   ├── Chat Box — Daftar pesan
│   │   └── Chat Input — Text input + send button
│   └── FORM PANEL (65% desktop / full mobile)
│       ├── Header — Logo ASJ + mode label + Simpan DB + Language toggle
│       ├── AI Typing Status — Loading indicator
│       ├── Section 1: Identitas & Kontak — 22 field (readonly)
│       ├── Section 2: Fisik & Ukuran — 7 field
│       ├── Section 3: Medis & Kebiasaan — 12 field (bilingual ID/JP)
│       ├── Section 4: Jiko PR & Wawancara — 20 field (bilingual ID/JP)
│       ├── Section 5: Pendidikan — Dynamic array
│       ├── Section 6: Pekerjaan — Dynamic array
│       ├── Section 7: Keluarga — Dynamic array
│       ├── Section 8: Kenalan di Jepang — 8 field (bilingual)
│       └── Upload Section — 9 file uploads (foto + 8 documents)
├── SCRIPTS — ESM modules
└── DATA LISTS — JFT, SSW, Pekerjaan options
```

---

## 2. Dependensi Lengkap

### 2.1 CSS

| File | Tipe | Keterangan |
|------|------|------------|
| `/vendor/font-awesome/css/all.min.css` | External | Ikon Font Awesome |
| `/fonts/fonts.css` | Local | Custom fonts (Montserrat) |
| `/assets/main.css` | Build | Tailwind CSS bundle |
| `<style>` inline | Inline | ~80 baris CSS kustom (label, input, responsive) |

### 2.2 JavaScript (ESM)

| File | Tipe | Fungsi |
|------|------|--------|
| `/js/pages/ai_form.ts` | Entry point | Chat AI, form CV, upload, autofill (900+ baris) |
| `/js/upload-guard.ts` | Helper | Validasi file (format + ukuran) |
| `/js/cloudinary.ts` | Helper | Upload langsung ke Cloudinary (retry + backoff) |
| `/js/core/bridge.ts` | Core | ESM bridge → window.* aliases |
| `/pwa.ts` | Core | Service worker + PWA features |

### 2.3 Backend Actions

| Action | Fungsi | Netlify Function |
|--------|--------|-----------------|
| `processAIChat` | Chat dengan AI (Gemini) + auto-update data | `ai-chat` |
| `getDrafCvMaster` | Load master data (nested format) | `master-data` |
| `getAppData` | Cek VIP status kandidat | `get-app-data` |
| `submitDataAsj` | Simpan data + upload files ke Cloudinary | `ai-form-submit` |

### 2.4 Database Tables

| Tabel | Operasi | Keterangan |
|-------|---------|------------|
| `master_database_candidate` | READ/WRITE | Master biodata (154 kolom) |
| `database_candidate` | SYNC | Sync ringkasan ke dashboard |

### 2.5 External Services

| Service | Fungsi |
|---------|--------|
| Cloudinary | Upload foto + dokumen (unsigned, retry 3x) |
| Google Gemini (via backend) | Chat AI + auto-translate ID→JP |

---

## 3. Alur Data (Flow)

### 3.1 Page Load

```
1. Browser load ai_form.html
2. Theme init (THEME_INIT_SCRIPT)
3. Back button rendered (fixed top-left)
4. Import map injected (Sentry dummy)
5. Scripts load (type=module):
   a. upload-guard.js — file validation
   b. ai_form.js — form logic + chat AI
   c. pwa.js — PWA features
6. Inline IIFE: Parse URL params → window.AI_FORM_CONTEXT
7. window.onload → initApp():
   a. Set logo ASJ
   b. Render language (renderLanguageLight)
   c. Enable manual editing (enableManualPreview)
   d. Clean old base64 drafts (bersihkanDraftLamaBase64)
   e. Restore saved draft from localStorage
   f. Apply portal context (WA + nama from URL)
   g. If flow=master + WA exists:
      - Verify VIP access (verifikasiAksesAiCv)
      - If VIP → auto-fill from DB (jalankanAutoFill)
      - If not VIP → redirect to master-full.html
   h. If flow=apply + WA exists → auto-fill from DB
   i. If no WA → welcome message (sendWelcomeMessage)
   j. Update form UI
   k. Show saved photo/JFT/SSW from DB
   l. Register resize listener
```

### 3.2 Chat Flow

```
1. User types message in #userInput
2. Enter key or send button → sendMessage()
3. Append user message to chat box
4. Save chat history to localStorage
5. Show typing indicator
6. Call backend: processAIChat({
     flow, history, currentData, lang
   })
7. Backend (ai-chat.ts):
   a. Verify session (admin OR kandidat)
   b. Build context from master data
   c. Send to Gemini AI
   d. Parse AI response (reply + data updates)
   e. Auto-translate new ID→JP fields
   f. Save updated data to master_database_candidate
   g. Return { success, reply, data }
8. Frontend:
   a. Parse reply (handle nested JSON)
   b. Append AI message to chat box
   c. Merge data updates → latestCandidateData
   d. Update form UI
   e. Save to localStorage
```

### 3.3 Save to DB Flow

```
1. User clicks "SIMPAN DB" → saveToDatabase()
2. Validate: nama_lengkap must exist
3. Validate: all file extensions (PDF for docs, JPG/PNG for photos)
4. Upload files to Cloudinary:
   a. fotoFile → base64 to File → Cloudinary
   b. jftFile, sswFile, ktpFile, kkFile → downscale if image → Cloudinary
   c. ijazahSd/Smp/Sma, univ → PDF or downscale image → Cloudinary
5. Call backend: submitDataAsj({
     identitas, fisik, medis, pendidikan, pekerjaan,
     sertifikasi, keluarga, wawancara, context,
     fotoFile, jftFile, sswFile, ktpFile, kkFile,
     ijazahSdFile, ijazahSmpFile, ijazahSmaFile, univFile
   })
6. Backend (ai-form-submit.ts):
   a. Verify session (admin OR kandidat owner)
   b. Normalize WA
   c. Upload files to Supabase Storage
   d. Auto-translate ID→JP via Gemini
   e. Update master_database_candidate
   f. Sync to database_candidate
   g. Return success/failure
7. Frontend: show success/failure toast
```

### 3.4 Auto-Fill Flow

```
1. initApp() calls verifikasiAksesAiCv(wa)
2. If admin session → skip verification (return true)
3. If no kandidat session → skip verification (return true)
4. If kandidat session → call getAppData('kandidat', wa)
   - Check catatanInt for [VIP] badge
   - Return true if VIP, false otherwise
5. If VIP → jalankanAutoFill(wa):
   a. Show loading indicator
   b. Call backend: getDrafCvMaster(wa)
   c. Backend returns nested master data
   d. Merge with AIDATAJSON (if exists)
   e. Merge with existing latestCandidateData
   f. Update form UI
   g. Save to localStorage
   h. Generate smart welcome message (detect missing fields)
   i. Show welcome in chat
```

---

## 4. State Management

### 4.1 Module-Level Variables

| Variable | Type | Fungsi |
|----------|------|--------|
| `chatHistory` | Array | Riwayat chat [{role, content}] |
| `latestCandidateData` | Object | Data kandidat (nested: identitas, fisik, dll) |
| `currentPhotoBase64` | String | Foto profil (compressed 600px JPEG) |
| `currentJftBase64` | String | Sertifikat JFT (base64, TIDAK disimpan ke localStorage) |
| `currentSswBase64` | String | Sertifikat SSW (base64, TIDAK disimpan ke localStorage) |
| `currentJftFile` | Object | JFT file info {data, name, mime} |
| `currentSswFile` | Object | SSW file info {data, name, mime} |
| `currentKtpFile` | Object | KTP file info |
| `currentKkFile` | Object | KK file info |
| `currentIjazahSdFile` | Object | Ijazah SD file info |
| `currentIjazahSmpFile` | Object | Ijazah SMP file info |
| `currentIjazahSmaFile` | Object | Ijazah SMA file info |
| `currentUnivFile` | Object | Ijazah Universitas file info |
| `formContext` | Object | URL params (flow, job, bidang, wa, nama) |
| `fieldPaths` | Object | Mapping field ID → nested path (70+ mappings) |
| `lastMobileTab` | String | Tab terakhir aktif di mobile |
| `wasDesktop` | Boolean | Status desktop/mobile saat ini |

### 4.2 localStorage Keys

| Key Pattern | Isi |
|-------------|-----|
| `asj_qween_cv_data_{wa}_{job}` | Draft: chatHistory + latestCandidateData + currentPhotoBase64 |
| `asj_theme` | Theme preference (dark/SAKURA) |
| `asj_lang` | Language preference (id/jp) |
| `asj_kandidat_login` | Login status ('sukses') |
| `asj_kandidat_session` | Session token |
| `asj_admin_login` |
 Admin login status |
| `asj_admin_session` | Admin session token |

### 4.3 fieldPaths (70+ Mappings)

```
f_nama → identitas.nama_lengkap
f_katakana → identitas.katakana
f_panggilan → identitas.panggilan
f_tb → fisik.tb
f_bb → fisik.bb
f_matakanan → medis.mata_kanan
f_promo_id → wawancara.promosi_id
f_promo_jp → wawancara.promosi_jp
f_bhs_jepang → sertifikasi.bahasa_jepang
f_kenalan_nama_id → kenalan_jepang.nama_id
... (70+ total)
```

---

### 5.1 UX Issues

| Issue | Severity | Deskripsi |
|-------|----------|-----------|
| No back button (FIXED) | High | ✅ Sudah ditambahkan tombol "Portal" |
| No offline fallback | Medium | Chat + save DB gagal tanpa internet |
| No loading skeleton | Low | Tidak ada skeleton saat fetch data |
| No error boundary | Low | Error JS tidak ditangkap dengan baik |
| No undo | Low | Tidak bisa undo perubahan form |

### 5.2 Technical Issues

| Issue | Severity | Deskripsi |
|-------|----------|-----------|
| window.onload conflict | Low | Bisa conflict dengan script lain |
| No abort controller (chat) | Medium | Tidak bisa cancel chat request |
| localStorage quota | Medium | Draft bisa penuh (photo base64) |
| 9 file uploads | Low | Tidak ada parallel upload |
| VIP guard race condition | Low | Multiple calls possible during verify |

### 5.3 Security Issues

| Issue | Severity | Deskripsi |
|-------|----------|-----------|
| No rate limiting (chat) | Medium | processAIChat tidak dilimit |
| No rate limiting (save) | Medium | submitDataAsj tidak dilimit |
| XSS in chat | Low | escapeHtml applied, but bold regex could leak |
| File type bypass | Low | upload-guard validates, but base64 conversion could bypass |

---

### 6.1 Back Button (2026-08-27)

```html
<a href="/" class="fixed top-4 left-4 z-[100] flex items-center gap-2 px-4 py-2 bg-black/70 hover:bg-black/90 text-white text-xs font-bold rounded-full border border-white/20 backdrop-blur-sm transition-all shadow-lg hover:scale-105" aria-label="Kembali ke Portal">
  <i class="fas fa-arrow-left"></i>
  <span class="hidden sm:inline">Portal</span>
</a>
```

---

## 5. Build Pipeline

| File | Role |
|------|------|
| `ai_form.html` | HTML template (412 baris) |
| `js/pages/ai_form.ts` | Entry point (1267 baris) |
| `js/upload-guard.ts` | File validation (110 baris) |
| `js/cloudinary.ts` | Cloudinary upload (120 baris) |
| `js/core/bridge.ts` | ESM bridge (470 baris) |
| `pwa.ts` | PWA features (350 baris) |

---

## 6. Key Functions

| Function | Fungsi |
|----------|--------|
| `initApp()` | Entry point: load data, verify VIP, auto-fill |
| `sendMessage()` | Send chat message to AI backend |
| `saveToDatabase()` | Upload files + save all data to DB |
| `updateFormUI()` | Sync form fields with latestCandidateData |
| `enableManualPreview()` | Make readonly fields editable |
| `compressImage()` | Compress photo to 600px JPEG |
| `handleDocUpload()` | Handle document upload (downscale if image) |
| `switchTab()` | Toggle chat/form panels (mobile) |
| `verifikasiAksesAiCv()` | Check VIP status before opening AI CV |
| `jalankanAutoFill()` | Load master data from DB |
| `mergeCandidateData()` | Deep merge nested objects |
| `generateSmartWelcomeMessage()` | Detect missing fields + generate welcome (17 fields checked) |
| `withRetry()` | Retry API calls (2 attempts, 2s delay) |
| `saveToLocal()` | Auto-save to localStorage (every 30s + on input) |

## 7. Improvements (10/10 — 2026-08-27)

| # | Improvement | Status | Detail |
|---|-------------|--------|--------|
| 1 | Chat history trim | Fixed | Last 20 messages only (prevents Gemini token overflow) |
| 2 | Smart welcome expanded | Fixed | Checks 17 fields (was 8): kelebihan, kekurangan, motivasi, alasan, rencana, tujuan, sertifikasi |
| 3 | Auto-save interval | Fixed | 30s interval + on input events (prevents data loss) |
| 4 | Button reset in catch | Fixed | saveToDatabase outer catch properly resets button state |
| 5 | Double autoTranslate removed | Fixed | Only runs on aiData (was running twice, doubling Gemini calls) |
| 6 | i18n keys expanded | Fixed | 7 new keys for ID + JP (chat_missing_*) |
| 7 | Retry mechanism | Existing | withRetry (2 attempts, 2s delay) on all API calls |
| 8 | Parallel uploads | Existing | Promise.all for Cloudinary uploads |
| 9 | Progress indicator | Existing | "Mengunggah dokumen..." + "Menyimpan data..." |
| 10 | aria-labels | Existing | 5 elements with aria-label + aria-live |

---

## 8. E2E Tests

| File | Assertions | Categories |
|------|-----------|------------|
| `e2e/ai_form-test.mjs` | ~40 | 14 (load, back, split, chat, form, upload, tab, typing, save, a11y, i18n, pwa, theme, errors) |

### Jalankan
Node e2e/ai_form-test.mjs membutuhkan dev server di localhost:3000.
