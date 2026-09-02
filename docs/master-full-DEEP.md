# master-full.html — Deep Analysis

> Halaman form master biodata 5 langkah + gerbang login kandidat. Dianalisis sampai akar pada 2026-08-27.

## 1. Arsitektur Halaman

```
master-full.html (372 baris)
├── <head> — Meta, CSS inline, shared partials
├── <body> — Form wizard 5 langkah
│   ├── HERO SECTION — Logo + background + language toggle
│   ├── LOGIN GATE — Password verification modal
│   ├── STEPPER — 5 langkah (Identitas → Medis → Riwayat → Keluarga → Dokumen)
│   ├── STEP 1: Identitas Dasar — Form input (40+ field)
│   ├── STEP 2: Medis & Wawancara — Medical + interview fields
│   ├── STEP 3: Riwayat — Pendidikan (5) + Pekerjaan (3)
│   ├── STEP 4: Keluarga — Anggota keluarga (5) + Kontak darurat + Kenalan di Jepang
│   └── STEP 5: Dokumen — Paspor + Sertifikasi + Upload (9 file)
├── NAV BAR — Prev/Draft/Next/Submit buttons
└── SCRIPTS — ESM modules
```

## 2. Dependensi Lengkap

### 2.1 CSS

| File | Tipe | Keterangan |
|------|------|------------|
| `/vendor/font-awesome/css/all.min.css` | External | Ikon Font Awesome |
| `/fonts/fonts.css` | Local | Custom fonts (Montserrat) |
| `/assets/main.css` | Build | Tailwind CSS bundle |
| `<style>` inline | Inline | ~80 baris CSS kustom |

### 2.2 JavaScript (ESM)

| File | Tipe | Fungsi |
|------|------|--------|
| `/js/pages/master_full.ts` | Entry point | Form wizard, validation, submit (812 baris) |
| `/js/upload-guard.ts` | Helper | Validasi file (format + ukuran) |
| `/js/cloudinary.ts` | Helper | Upload langsung ke Cloudinary |
| `/js/core/bridge.ts` | Core | ESM bridge → window.* aliases |
| `/pwa.ts` | Core | Service worker + PWA features |

### 2.3 Backend Actions

| Action | Fungsi | Endpoint |
|--------|--------|----------|
| `loginKandidat` | Login kandidat | `auth` |
| `getMasterDataByWa` | Load master data | `master-data` |
| `submitMasterForm` | Submit master data | `master-data` |

### 2.4 Database Tables

| Tabel | Operasi | Keterangan |
|-------|---------|------------|
| `master_database_candidate` | INSERT/UPDATE | Master biodata (154 kolom) |
| `database_candidate` | PATCH | Sync ringkasan ke dashboard |

---

## 3. Alur Data (Flow)

### 3.1 Page Load

```
1. Browser load master-full.html
2. Theme init (THEME_INIT_SCRIPT)
3. Back button rendered (fixed top-left)
4. Language toggle rendered (JP/ID)
5. Login gate modal (hidden by default)
6. Hero section renders
7. Form wizard renders (Step 1 active)
8. Scripts load:
   a. upload-guard.js — load file validation
   b. master_full.js — load form logic
   c. pwa.js — load PWA features
9. window.onload fires:
   a. Render dynamic fields (edu/job/fam containers)
   b. Build dropdown SSW + Pekerjaan
   c. Read URL params (?wa=&nama=)
   d. If WA exists:
      - Check session (localStorage)
      - If no session → show login gate
      - If session exists → load master data from backend
      - Auto-fill all fields from database
   e. If no WA → preview mode (no auto-fill)
```

### 3.2 Login Gate Flow

```
1. User opens form without session
2. Login gate modal appears
3. User enters password
4. gateLogin() calls backend: loginKandidat([wa, pass])
5. Backend:
   a. Normalize WA
   b. Find candidate by WA
   c. Verify password (bcrypt)
   d. Generate session token (HMAC)
   e. Return success + sessionToken
6. Frontend:
   a. Save session to localStorage
   b. Reload page
   c. Page load detects session → loads master data
```

### 3.3 Form Submission

```
1. User fills Step 1-5
2. User clicks "Simpan Final" → submitMaster(false)
3. submitMaster():
   a. Check session exists
   b. Validate nama (required for final submit)
   c. Show loading modal
   d. Collect all form data (50+ fields)
   e. Upload files to Cloudinary (if new)
   f. Call backend: submitMasterForm([payload])
   g. Backend:
      - Verify session (admin or kandidat)
      - Normalize WA
      - Find/create master row
      - Upload files (if any)
      - Auto-translate ID → JP (Gemini)
      - Compare old vs new values
      - Update master_database_candidate
      - Sync to database_candidate
      - Send mail inbox (if biodata changed)
   h. Show success/failure alert
```

---

```html
<!-- BACK TO PORTAL -->
<a href="/" class="fixed top-4 left-4 z-[100] flex items-center gap-2 px-4 py-2 bg-black/70 hover:bg-black/90 text-white text-xs font-bold rounded-full border border-white/20 backdrop-blur-sm transition-all shadow-lg hover:scale-105" aria-label="Kembali ke Portal">
  <i class="fas fa-arrow-left"></i>
  <span class="hidden sm:inline">Portal</span>
</a>
```

---

## 4. Backend Flow Detail

### 6.1 submitMasterForm Action

```
Input: payload[0] = {
  wa: string,
  nama: string,
  furigana: string,
  panggilan: string,
  panggilanKatakana: string,
  gender: string,
  tempatLahir: string,
  tglLahir: string,
  usia: string,
  agama: string,
  statusNikah: string,
  anak: string,
  ktp: string,
  sim: string,
  alamat: string,
  email: string,
  tb: string,
  bb: string,
  goldar: string,
  tangan: string,
  baju: string,
  sepatu: string,
  topi: string,
  tahanAc: string,
  mataKiri: string,
  mataKanan: string,
  kacamata: string,
  butaWarna: string,
  tato: string,
  tindik: string,
  merokok: string,
  alkohol: string,
  penyakit: string,
  alergi: string,
  laka: string,
  promosi: string,
  kelebihan: string,
  kekurangan: string,
  keahlianKhusus: string,
  hobi: string,
  alasanBidang: string,
  motivasiJepang: string,
  keinginan: string,
  rencanaPulang: string,
  tujuanJepang: string,
  lamaJepang: string,
  gajiYen: string,
  tabungan: string,
  bhsJepang: string,
  nilai: string,
  lisensi: string,
  eksJepang: string,
  daruratNama: string,
  daruratHubungan: string,
  daruratWa: string,
  kenalanNama: string,
  kenalanHubungan: string,
  kenalanPekerjaan: string,
  kenalanUsia: string,
  kenalanAlamat: string,
  pendidikan: [{tingkat, namaSekolah, jurusan, tahunMasuk, tahunLulus}] (5 items),
  pekerjaan: [{namaPt, tahunMasuk, tahunKeluar, jabatan, gaji}] (3 items),
  keluarga: [{hubungan, nama, usia, pekerjaan, pendapatan}] (5 items),
  noPaspor: string,
  tglTerbitPaspor: string,
  expPaspor: string,
  kotaPaspor: string,
  noCoe: string,
  photoFile: string (URL),
  jftFile: string (URL),
  sswFile: string (URL),
  ijazahSdFile: string (URL),
  ijazahSmpFile: string (URL),
  ijazahSmaFile: string (URL),
  univFile: string (URL),
  ktpFile: string (URL),
  kkFile: string (URL)
}

Output: {
  success: boolean,
  sessionInvalid: boolean,
  message: string,
  translationSkipped: boolean
}

Processing:
1. Verify session (admin or kandidat)
2. Normalize WA
3. Find/create master row
4. Upload files (if any) to Cloudinary
5. Auto-translate ID → JP via Gemini
6. Compare old vs new values (changedLabels)
7. Update master_database_candidate (154 kolom)
8. Sync to database_candidate
9. Send mail inbox (if biodata changed)
10. Return success/failure
```

---

| Test File | Coverage |
|-----------|----------|
| `scripts/__tests__/apply-docs.test.js` | applyDocsPlan function |

| Test File | Coverage |

## 5. E2E Tests

| Test File | Coverage |
|-----------|----------|
| `e2e/master-full-test.mjs` | Page load, back button, form inputs+aria, URL auto-fill, stepper, nav buttons, login gate, i18n, PWA, theme, key functions |

Run: `node e2e/master-full-test.mjs` (15 categories, 30+ assertions)
