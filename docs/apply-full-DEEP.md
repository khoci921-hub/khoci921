# apply-full.html — Deep Analysis

> Halaman form lamaran loker 3 langkah. Dianalisis sampai akar pada 2026-08-27.

## 1. Arsitektur Halaman

```
apply-full.html (365 baris)
├── <head> — Meta, CSS inline, shared partials
├── <body> — Form wizard 3 langkah
│   ├── HERO SECTION — Logo + background
│   ├── STEP 1: Data Diri — Form input
│   ├── STEP 2: Upload Dokumen — File upload cards
│   ├── STEP 3: Konfirmasi — Checkbox + submit
│   └── STICKY NAV — Prev/Next/Submit buttons
├── MODALS — Loading + Success
└── SCRIPTS — ESM modules
```

## 2. Dependensi Lengkap

### 2.1 CSS

| File | Tipe | Keterangan |
|------|------|------------|
| `/vendor/font-awesome/css/all.min.css` | External | Ikon Font Awesome |
| `/fonts/fonts.css` | Local | Custom fonts (Montserrat) |
| `/assets/main.css` | Build | Tailwind CSS bundle |
| `<style>` inline | Inline | ~120 baris CSS kustom |

### 2.2 JavaScript (ESM)

| File | Tipe | Fungsi |
|------|------|--------|
| `/js/pages/apply_full.ts` | Entry point | Form wizard, validation, submit |
| `/js/apply-docs.ts` | Helper | Model dokumen (apa saja yang perlu di-upload) |
| `/js/upload-guard.ts` | Helper | Validasi file (format + ukuran) |
| `/js/cloudinary.ts` | Helper | Upload langsung ke Cloudinary |
| `/js/core/bridge.ts` | Core | ESM bridge → window.* aliases |
| `/pwa.ts` | Core | Service worker + PWA features |

### 2.3 Backend Actions

| Action | Fungsi | Endpoint |
|--------|--------|----------|
| `cekDataPelamar` | Cek riwayat lamaran | `candidates` |
| `submitApply` | Submit lamaran | `apply` |

### 2.4 Database Tables

| Tabel | Operasi | Keterangan |
|-------|---------|------------|
| `database_asj_form` | INSERT/UPDATE | Lamaran (1 kandidat × code_job) |
| `database_candidate` | PATCH | Sync photo/JFT/SSW/CV |
| `master_database_candidate` | PATCH | Carry-over dokumen TSK |

---

## 3. Alur Data (Flow)

### 3.1 Page Load

```
1. Browser load apply-full.html
2. Theme init (THEME_INIT_SCRIPT)
3. Back button rendered (fixed top-left)
4. Skip link for accessibility
5. Hero section renders
6. Form wizard renders (Step 1 active)
7. Scripts load:
   a. apply-docs.js — load document model
   b. upload-guard.js — load file validation
   c. apply_full.js — load form logic
   d. pwa.js — load PWA features
8. window.onload fires:
   a. Read URL params (?job=&bidang=&wa=&nama=&req=)
   b. Apply document plan from req param
   c. Show/hide upload cards based on plan
   d. If WA exists (from portal), auto-fill + lock fields
   e. Call cekRiwayat() to check existing data
```

### 3.2 Form Submission

```
1. User fills Step 1 (Data Diri)
2. User clicks "Lanjut" → validateStep1()
3. User fills Step 2 (Upload Dokumen)
4. User clicks "Lanjut" → validateStep2()
5. User checks agreement checkbox
6. User clicks "KIRIM LAMARAN" → submitApply()
7. submitApply():
   a. Validate agreement checkbox
   b. Validate file extensions
   c. Show loading modal
   d. Upload files to Cloudinary (if new)
   e. Call backend: submitApply([payload])
   f. Backend:
      - Normalize WA
      - Validate job exists
      - Check document completeness
      - Insert/Update database_asj_form
      - Sync to database_candidate
      - Carry-over to master_database_candidate
      - Send push notification to admin
   g. Show success modal
```

---

```html
<!-- BACK TO PORTAL -->
<a href="/" class="fixed top-4 left-4 z-[100] flex items-center gap-2 px-4 py-2 bg-black/70 hover:bg-black/90 text-white text-xs font-bold rounded-full border border-white/20 backdrop-blur-sm transition-all shadow-lg hover:scale-105" aria-label="Kembali ke Portal">
  <i class="fas fa-arrow-left"></i>
  <span class="hidden sm:inline">Portal</span>
</a>
```

**Posisi**: Fixed top-left, z-index 100
**Responsif**: Icon saja di mobile, icon + teks di desktop
**Aksesibilitas**: aria-label untuk screen reader

---

## 4. Backend Flow Detail

### 6.1 submitApply Action

```
Input: payload[0] = {
  job: string (code_job),
  bidang: string,
  nama: string,
  wa: string,
  email: string,
  gender: string,
  usia: string,
  tb: string,
  bb: string,
  photoFile: string (URL),
  oldPhoto: string,
  cvFile: string (URL),
  jftFile: string (URL),
  oldJft: string,
  sswFile: string (URL),
  oldSsw: string,
  extraFiles: [{name, url}]
}

Output: {
  success: boolean,
  message: string
}

Processing:
1. Normalize WA (628xxx format)
2. Validate job exists in database
3. Check document completeness vs dokumen_share
4. Upsert to database_asj_form (dedup per WA+job)
5. Sync photo/JFT/SSW/CV to database_candidate
6. Carry-over extra files to master_database_candidate
7. Send push notification to admin
8. Return success/failure
```

---

| Test File | Coverage |
|-----------|----------|
| `scripts/__tests__/apply-docs.test.js` | applyDocsPlan function |

| Test File | Coverage |
|-----------|----------|
| `e2e/upload-check.mjs` | Upload flow |
| `e2e/biodata-check.mjs` | Biodata sync |

---

- **CSS**: ~120 baris inline + Tailwind bundle
- **JS load**: 4 module scripts (parallel)
- **Upload**: Direct to Cloudinary (no backend processing)
- **Cache**: SW caches page for offline access

---

- **Backend validation**: Document completeness check
- **WA normalization**: Prevents duplicate candidates
- **No auth required**: Public form (anyone can apply)
- **Rate limiting**: Not implemented on submitApply

---

2. **Add error boundary**: Catch and display errors gracefully
3. **Add abort controller**: Allow users to cancel uploads
4. **Add save draft**: Save form to localStorage
5. **Add rate limiting**: Prevent spam submissions

## 5. E2E Tests

| Test File | Coverage |
|-----------|----------|
| `e2e/apply-full-test.mjs` | Page load, back button, form inputs+aria, URL auto-fill, stepper, toast, draft, file upload, i18n, PWA, modals, aria-live |

Run: `node e2e/apply-full-test.mjs` (14 categories, 40+ assertions)
