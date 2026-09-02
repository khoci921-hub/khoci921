# share.html — Deep Analysis

> Public Share Viewer untuk Kaisha (klien PT ASJ). Dianalisis sampai akar pada 2026-08-27.

## 1. Arsitektur Halaman

```
share.html (180 baris)
├── <head> — Meta, CSS inline, shared partials
├── <body data-page="share"> — Full-page viewer
│   ├── BACK TO PORTAL — Tombol kembali (fixed top-left)
│   ├── SKIP LINK — Aksesibilitas
│   ├── AMBIENT BACKGROUND — Gradient blobs + dot pattern
│   ├── HEADER (sticky) — Logo ASJ + Job Info + Language Toggle
│   ├── MAIN CONTENT
│   │   ├── LOADING STATE — 3 skeleton cards
│   │   ├── ERROR STATE — Access denied / not found
│   │   ├── FILTER BAR — Gender | Age | JFT Level
│   │   ├── CANDIDATES GRID — Responsive cards (1-3 columns)
│   │   └── EMPTY STATE — No candidates
│   ├── DOCUMENT PREVIEW MODAL — iframe + img + pptx host
│   ├── FLOATING SELECTION BAR — Count + "Kirim Pilihan" (WhatsApp)
│   └── SCRIPTS — ESM modules + vendor libs
```

---

## 2. Dependensi Lengkap

### 2.1 CSS

| File | Tipe | Keterangan |
|------|------|------------|
| `/vendor/font-awesome/css/all.min.css` | External | Ikon Font Awesome |
| `/fonts/fonts.css` | Local | Custom fonts (Montserrat) |
| `/assets/main.css` | Build | Tailwind CSS bundle |
| `<style>` inline | Inline | ~40 baris CSS kustom (glass-card, skeleton, layer) |

### 2.2 JavaScript (ESM + Vendor)

| File | Tipe | Fungsi |
|------|------|--------|
| `/js/pages/share.ts` | Entry point | Grid rendering, preview, selection (500+ baris) |
| `/js/core/bridge.ts` | Core | ESM bridge → window.* aliases |
| `/pwa.ts` | Core | Service worker + PWA features |
| `/vendor/xlsx.full.min.js` | Vendor | Excel rendering (SheetJS) |
| `/vendor/mammoth.browser.min.js` | Vendor | Word rendering (mammoth) |
| `/vendor/pptx-preview.umd.js` | Vendor | PowerPoint rendering (pptx-preview) |

### 2.3 API Endpoint

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/share-data?job=CODE` | GET | Load job info + candidates + documents |

### 2.4 Database Tables (READ)

| Tabel | Operasi | Keterangan |
|-------|---------|------------|
| `database_candidate` | READ | Kandidat ter-approve untuk job |
| `database_asj_form` | READ | Dokumen dari lamaran (fallback) |
| `pemberkasan_checklist` | READ | Dokumen pemberkasan |
| `master_database_candidate` | READ | Master biodata (foto fallback) |
| `jobs` | READ | Info pekerjaan |

### 2.5 External Services

| Service | Fungsi |
|---------|--------|
| Supabase Storage | List folder master kandidat |
| WhatsApp API | Kirim pilihan ke kaisha |

---

## 3. Alur Data (Flow)

### 3.1 Page Load

```
1. Browser load share.html?job=CODE
2. Theme init (THEME_INIT_SCRIPT)
3. Back button rendered (fixed top-left)
4. Import map injected (Sentry dummy)
5. Scripts load:
   a. share.js — grid logic + preview
   b. pwa.js — PWA features
   c. xlsx.full.min.js — Excel rendering
   d. mammoth.browser.min.js — Word rendering
   e. pptx-preview.umd.js — PowerPoint rendering
6. DOMContentLoaded → async init:
   a. Set language toggle state (from localStorage)
   b. Update static text (ID/JP)
   c. Parse URL params → jobCode
   d. If no jobCode → showError()
   e. Fetch: GET /api/share-data?job=CODE
   f. Backend (handleShareData):
      - Find job by code
      - Find approved candidates for job
      - For each candidate:
        - Map candidate data
        - List storage folder master/<NAMA>/
        - Classify docs (CV/JFT/SSW/extra)
        - Filter by dokumen_share setting
        - Merge from forms + pemberkasan + master
        - Fallback photo from folder/form
      - Return { job, candidates }
   g. If error → showError()
   h. If no candidates → show empty state
   i. If candidates → show filter bar + grid + renderGrid()
```

### 3.2 Grid Rendering

```
1. renderGrid() called
2. Read filter values (gender, age, JFT)
3. Filter allCandidates:
   - Gender: L/P/all
   - Age: <20 / 20-25 / >25 / all
   - JFT: A2/N4 / B1/N3 / all
4. For each candidate:
   a. Build card HTML:
      - Photo (with fallback to ui-avatars)
      - Name, gender, age, height, weight
      - JFT level badge
      - SSW badge
      - Document buttons (CV, JFT, SSW, extras)
      - Selection checkbox
   b. Insert into grid
```

### 3.3 Document Preview

```
1. User clicks document button → openPreview(url, title)
2. Set modal title + download link
3. Show loading spinner
4. Determine file type:
   a. Image (jpg/png/gif/webp) → <img> tag
   b. PDF → <iframe> with URL
   c. Excel (xls/xlsx/csv) → renderExcelKeFrame() (SheetJS)
   d. Word (docx) → renderDocxKeFrame() (mammoth)
   e. PowerPoint (pptx) → renderPptxKeDiv() (pptx-preview)
   f. Unsupported → pesanPreviewTidakTersedia() + download button
5. Show modal
6. Close → closePreview() cleanup
```

### 3.4 Selection + WhatsApp

```
1. User clicks candidate card → toggleSelection(id, name)
2. Update selection bar count
3. Show/hide floating bar
4. User clicks "Kirim Pilihan" → submitSelection()
5. Build WhatsApp message:
   "Halo Admin ASJ, kami tertarik dengan kandidat berikut untuk Job CODE - NAME:
    1. Nama (ID: xxx)
    2. Nama (ID: yyy)
   Mohon tindak lanjutnya."
6. Open wa.me/6287889502004?text=ENCODED_MSG
```

---

## 4. State Management

### 4.1 Module-Level Variables

| Variable | Type | Fungsi |
|----------|------|--------|
| `currentLang` | String | Bahasa aktif (id/jp) |
| `allCandidates` | Array | Semua kandidat dari API |
| `currentJob` | Object | Info pekerjaan (code, name, tsk) |
| `selectedIds` | Set | ID kandidat terpilih |
| `selectedNames` | Object | Map ID → nama kandidat |

### 4.2 localStorage Keys

| Key | Isi |
|-----|-----|
| `asj_lang` | Bahasa preference (id/jp) |
| `asj_theme` | Theme preference (dark/SAKURA) |

### 4.3 i18n (SHARE_LANG)

| Section | Keys |
|---------|------|
| Header | secure, load |
| Error | err_acc, err_msg |
| Empty | empty_t, empty_s |
| Filter | filter, gen_all, gen_l, gen_p, age_all, jft_all |
| Selection | sel_count, sel_btn |
| Preview | prev, loading_doc, prev_unavail, dl, close |
| WhatsApp | wa_greet, wa_closing |

---

## 5. Backend: handleShareData()

### 5.1 Input/Output

```
Input: jobCode (string)
Output: {
  job: { code, name, tsk },
  candidates: [{
    id_kandidat, no_wa, nama_lengkap, gender, usia, tb, bb,
    pas_photo, file_cv, jft, ssw,
    nilai_jft_text, bidang_ssw_text,
    extraDocs: [{ name, url }]
  }]
}
```

### 5.2 Data Sources (4 tables + Storage)

| Source | Data |
|--------|------|
| `database_candidate` | Kandidat ter-approve untuk job |
| `database_asj_form` | Dokumen dari lamaran (fallback CV/JFT/SSW/foto) |
| `pemberkasan_checklist` | Dokumen pemberkasan (KK/KTP/ijazah) |
| `master_database_candidate` | Master biodata (foto fallback) |
| Supabase Storage | Folder master/<NAMA>/ (extra docs) |

### 5.3 Document Classification

```
docTypeOf(filename):
  1. Token panjang (>3 char): FILE_CV→CV, PHOTOFILE→PHOTO, dll
  2. Prefix uppercase: KK, KTP, IJAZAH
  3. Pola lawas "1. X_CV.xlsx": cari token di seluruh nama
  4. Default: uppercase extension
```

### 5.4 Document Filtering

```
allowedDocTypes = job.dokumen_share.split(',')
  - Default: ['CV', 'JFT', 'SSW']
  - 'ALL' = tampilkan semua
  - Filter applied to extraDocs + formDocs + pemberkasanDocs
```

---

```html
<a href="/" class="fixed top-4 left-4 z-[100] flex items-center gap-2 px-4 py-2 bg-black/70 hover:bg-black/90 text-white text-xs font-bold rounded-full border border-white/20 backdrop-blur-sm transition-all shadow-lg hover:scale-105" aria-label="Kembali ke Portal">
  <i class="fas fa-arrow-left"></i>
  <span class="hidden sm:inline">Portal</span>
</a>
```

---

## 6. Build Pipeline

| File | Role |
|------|------|
| share.html | HTML template (180 baris) |
| js/pages/share.ts | Entry point (500+ baris) |
| js/core/bridge.ts | ESM bridge (470 baris) |
| pwa.ts | PWA features (350 baris) |
| vendor/xlsx.full.min.js | Excel rendering |
| vendor/mammoth.browser.min.js | Word rendering |
| vendor/pptx-preview.umd.js | PowerPoint rendering |

---

## 7. Key Functions

| Function | Fungsi |
|----------|--------|
| renderGrid() | Render candidate cards with filters |
| openPreview(url, title) | Open document preview modal |
| closePreview() | Close preview modal + cleanup |
| toggleSelection(id, name) | Select/deselect candidate |
| submitSelection() | Send selection via WhatsApp |
| toggleLang() | Switch ID/JP language |
| updateStaticText() | Update all static text for language |
| showError(msg) | Show error state |
| renderExcelKeFrame() | Render Excel client-side (SheetJS) |
| renderDocxKeFrame() | Render Word client-side (mammoth) |
| renderPptxKeDiv() | Render PowerPoint client-side (pptx-preview) |

## 8. E2E Tests

| Test File | Coverage |
|-----------|----------|
| `e2e/share-test.mjs` | Page load, back button, header, i18n toggle, filters+aria, grid, card content, selection+deselect, preview modal, PWA, theme, loading/error states |

Run: `node e2e/share-test.mjs` (19 categories, 35+ assertions)
