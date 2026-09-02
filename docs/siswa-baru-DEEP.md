# siswa-baru.html — Reference

> Pendaftaran siswa baru via chat AI (Qween Jeklin) + form + upload berkas.

---

## 1. Arsitektur Halaman

```
siswa-baru.html (130 baris)
├── <head> — Meta, CSS inline, shared partials
├── <body data-page="siswa-baru"> — Split view (chat + form)
│   ├── BACK TO PORTAL — Tombol kembali (fixed top-left)
│   ├── SKIP LINK — Aksesibilitas
│   ├── MOBILE TAB BAR — Chat Jeklin | Form Siswa (mobile only)
│   ├── CHAT PANEL (40% desktop / full mobile)
│   │   ├── Chat Header — Logo Jeklin + status
│   │   ├── Chat Box — Daftar pesan (aria-live="polite")
│   │   └── Chat Input — Text input + send button
│   └── FORM PANEL (60% desktop / full mobile)
│       ├── Header — Logo ASJ + SUBMIT DATA button
│       ├── AI Typing Status — Loading indicator
│       ├── BIODATA BOX — 9 fields (readonly → editable)
│       └── UPLOAD BOX — 3 file uploads (KTP, KK, Ijazah)
├── SCRIPTS — ESM modules
└── END
```

---

## 2. Dependensi

### CSS

| File | Tipe | Keterangan |
|------|------|------------|
| `/vendor/font-awesome/css/all.min.css` | External | Ikon Font Awesome |
| `/fonts/fonts.css` | Local | Custom fonts (Montserrat) |
| `/assets/main.css` | Build | Tailwind CSS bundle |
| `<style>` inline | Inline | ~20 baris CSS kustom (responsive) |

### JavaScript (ESM)

| File | Tipe | Fungsi |
|------|------|--------|
| `/js/pages/siswa_baru.ts` | Entry point | Chat AI, form, upload, draft (~547 baris) |
| `/js/upload-guard.ts` | Helper | Validasi file (format + ukuran) |
| `/js/cloudinary.ts` | Helper | Upload langsung ke Cloudinary (retry + backoff) |
| `/js/core/bridge.ts` | Core | ESM bridge → window.* aliases |
| `/pwa.ts` | Core | Service worker + PWA features |

### Backend Actions

| Action | Fungsi | Netlify Function |
|--------|--------|-----------------|
| `processSiswaAIChat` | Chat AI untuk pendaftaran siswa (Gemini) | `ai-chat` |
| `submitDaftarSiswa` | Simpan data pendaftaran + upload files | `ai-form-submit` |

### Database Tables

| Tabel | Operasi | Keterangan |
|-------|---------|------------|
| `respon_siswa_baru` | INSERT | Data pendaftaran siswa baru |

### External Services

| Service | Fungsi |
|---------|--------|
| Cloudinary | Upload KTP, KK, Ijazah (unsigned, retry 3x) |
| Google Gemini (via backend) | Chat AI untuk pengisian form |

---

## 3. Alur Data

### Page Load

```
1. Browser load siswa-baru.html
2. Theme init (THEME_INIT_SCRIPT)
3. Back button rendered (fixed top-left)
4. Import map injected (Sentry dummy)
5. Scripts load (type=module):
   a. upload-guard.js — file validation
   b. siswa_baru.js — form logic + chat AI
   c. pwa.js — PWA features
6. window.onload → initApp():
   a. Enable manual editing (remove readonly + input listener)
   b. Show loading skeleton in chatBox
   c. Check localStorage for saved draft
   d. If draft exists:
      - Restore chatHistory + candidateData + uploadedFiles
      - Check staleness (>24h → warn)
      - Re-render chat messages
      - Show file upload status
   e. If no draft → sendWelcomeMessage()
   f. Update form UI
   g. Register resize listener
```

### Chat Flow

```
1. User types message in #userInput
2. Enter key or send button → sendMessage()
3. Append user message to chat box
4. Save chat history to localStorage
5. Show typing indicator
6. Abort previous chat if still running
7. Call backend: processSiswaAIChat({history, currentData})
8. Backend (ai-chat.ts → handleProcessSiswaAIChat):
   a. System prompt: "Kamu adalah Dede Jeklin..."
   b. Send history to Gemini AI
   c. Parse AI response (JSON with reply + data)
   d. Return { reply, data }
9. Frontend (with retry: 2 attempts, 2s delay):
   a. Parse reply (handle nested JSON)
   b. Append AI message to chat box
   c. Merge data updates → candidateData
   d. Update form UI
   e. Save to localStorage
```

### Save to DB Flow

```
1. User clicks "SUBMIT DATA" → saveToDatabase()
2. Validate: ALL 12 fields must be filled
   - 9 text fields (nama, ttl, gender, agama, alamat, email, pendidikan, wa_siswa, wa_ortu)
   - 3 files (ktp, kk, ijazah)
3. If any missing → show error toast + switch to form tab (mobile)
4. Upload files to Cloudinary (PARALLEL via Promise.all):
   - Progress: "Mengunggah dokumen..."
   - ktp + kk + ijazah → downscaleScanImage → Cloudinary
5. Progress: "Menyimpan data..."
6. Call backend (with retry: 2 attempts, 2.5s delay):
   submitDaftarSiswa({ nama, ttl, gender, ... ktp: url, kk: url, ijazah: url })
7. Backend (actions-register.ts → handleSubmitDaftarSiswa):
   a. Validate nama not empty
   b. Insert into respon_siswa_baru table
   c. Return success/failure
8. Frontend:
   a. If success → clear localStorage draft + show success toast
   b. If failure → show error toast
```

---

## 4. State Management

### Module-Level Variables

| Variable | Type | Fungsi |
|----------|------|--------|
| `chatHistory` | Array | Riwayat chat [{role, content}] |
| `candidateData` | Object | Data siswa (9 fields, FLAT structure) |
| `uploadedFiles` | Object | File uploads {ktp, kk, ijazah} |
| `DRAFT_KEY` | String | localStorage key: `asj_siswa_draft_v1` |
| `fieldPaths` | Object | Mapping field ID → data key (9 mappings) |
| `lastMobileTab` | String | Tab terakhir aktif di mobile |
| `wasDesktop` | Boolean | Status desktop/mobile saat ini |

### fieldPaths (9 Mappings — FLAT)

```
f_nama → nama
f_ttl → ttl
f_gender → gender
f_agama → agama
f_alamat → alamat
f_email → email
f_pendidikan → pendidikan
f_wa_siswa → wa_siswa
f_wa_ortu → wa_ortu
```

### localStorage Keys

| Key | Isi |
|-----|-----|
| `asj_siswa_draft_v1` | Draft: {chat, data, files, savedAt} |
| `asj_theme` | Theme preference (dark/SAKURA) |

---

## 5. Backend Flow

### submitDaftarSiswa

```
Input: {
  nama, ttl, gender, agama, alamat, email,
  pendidikan, wa_siswa, wa_ortu,
  ktp: string (URL), kk: string (URL), ijazah: string (URL)
}

Output: {
  success: boolean,
  message: string
}

Processing:
1. Validate nama not empty
2. Normalize WA format
3. Insert into respon_siswa_baru table
4. Return success/failure
```

---

## 6. Build Pipeline

| File | Role |
|------|------|
| `siswa-baru.html` | HTML template (130 baris) |
| `js/pages/siswa_baru.ts` | Entry point (~547 baris) |
| `js/upload-guard.ts` | File validation (110 baris) |
| `js/cloudinary.ts` | Cloudinary upload (120 baris) |
| `js/core/bridge.ts` | ESM bridge (470 baris) |
| `pwa.ts` | PWA features (350 baris) |

---

## 7. Key Functions

| Function | Fungsi |
|----------|--------|
| `initApp()` | Entry point: enable editing, restore draft, send welcome |
| `sendMessage()` | Send chat message to AI backend (with retry + abort) |
| `saveToDatabase()` | Validate all fields + parallel upload + submit to DB |
| `updateFormUI()` | Sync form fields with candidateData |
| `handleDocUpload()` | Handle file upload (downscale if image) |
| `switchTab()` | Toggle chat/form panels (mobile) |
| `saveToLocal()` | Save draft to localStorage (with timestamp) |
| `sendWelcomeMessage()` | Show welcome message in chat |
| `downscaleScanImage()` | Compress image to 800px JPEG |
| `withRetry()` | Retry wrapper (max 2 attempts with delay) |

## 8. Improvements (10/10 — 2026-08-27)

| # | Improvement | Status | Detail |
|---|-------------|--------|--------|
| 1 | withRetry fixed | Fixed | CRITICAL: was returning function, now returns Promise |
| 2 | Chat history trim | Fixed | Last 20 messages only (prevent Gemini token overflow) |
| 3 | Auto-save interval | Fixed | 30s interval + on input events |
| 4 | Parallel uploads | Existing | Promise.all for Cloudinary uploads |
| 5 | Progress indicator | Existing | "Mengunggah..." + "Menyimpan..." |
| 6 | Validation | Existing | 12 field checks before submit |
| 7 | Draft restore | Existing | Auto-load from localStorage |
| 8 | Draft staleness | Existing | 24h warning on load |
| 9 | Loading skeleton | Existing | Animated pulse while restoring |
| 10 | i18n | Existing | ID/JP toggle + all labels translated |

---

## 9. E2E Tests

| Test File | Coverage |
|-----------|----------|
| `e2e/siswa-baru-test.mjs` | Page load, back button, split view, chat+aria-live, form inputs+aria, uploads, tabs, submit, draft, i18n, PWA, theme |

Run: `node e2e/siswa-baru-test.mjs` (16 categories, 45+ assertions)
