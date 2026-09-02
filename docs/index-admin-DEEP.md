# index.html + admin.html — Deep Analysis (Bundle Pages)

> Dua halaman utama yang memakai JS bundle (assets/app-*.js). Dianalisis sampai akar pada 2026-08-27.

## 1. Perbedaan index.html vs admin.html

| Aspek | index.html | admin.html |
|-------|-----------|------------|
| Baris | 1215 | 1223 |
| Flag | — | `window.IS_ADMIN_PORTAL = true` |
| Banner image | Supabase storage | Unsplash |
| Default view | page-public | page-public (same) |
| Footer | Identical | Identical |
| JS bundle | app-c20d359256.js | app-c20d359256.js (same) |

**Kesimpulan:** admin.html adalah **copy index.html** dengan flag `IS_ADMIN_PORTAL` + perbedaan minor styling. Keduanya memakai **bundle JS yang sama**.

---

## 2. Arsitektur Halaman

```
index.html / admin.html (1215-1223 baris)
├── <head> — Meta, PWA manifest, CSS
├── <body>
│   ├── GLOBAL LOADER — Splash screen
│   ├── HEADER (sticky) — Logo + Nav buttons
│   │   ├── Nav Mode (belum login) — Login | Daftar | Admin
│   │   ├── Nav Admin Mode — Bell | AI HR | Publik | Admin | Keluar
│   │   └── Nav Kandidat Mode — Bell | Nama | Dashboard | Keluar
│   ├── MOBILE NAV OVERLAY — Hamburger menu
│   ├── GLOBAL ANNOUNCEMENT — Marquee
│   ├── MAIN CONTENT
│   │   ├── PAGE PUBLIC
│   │   │   ├── Tab Bar — Loker | Program & Layanan
│   │   │   ├── Loker Section — Filter + Table
│   │   │   └── Layanan Section — 3 cards + Maps
│   │   ├── PAGE ADMIN
│   │   │   ├── Dashboard — Agenda + Task Board
│   │   │   ├── Sidebar (drawer) — 8 tabs
│   │   │   ├── Tab: Kelola Loker — Table + Search
│   │   │   ├── Tab: DB Job Internal — Table + Sort + Filter
│   │   │   ├── Tab: Tambah Loker — Form
│   │   │   ├── Tab: Data Pelamar — Table + Filter + Export
│   │   │   ├── Tab: Jadwal Agenda — Table + Form
│   │   │   ├── Tab: Mail Inbox — Table + Filter + Status
│   │   │   ├── Tab: WA Pintar — Template editor + List
│   │   │   └── Tab: Pengaturan — Config + Migration
│   │   └── PAGE KANDIDAT
│   │       ├── Welcome + Student Card (VIP)
│   │       ├── Progress Bars (CV Mini + CV Master)
│   │       ├── Schedule Panel
│   │       ├── Application History
│   │       ├── Action Buttons (7 buttons)
│   │       └── Revision Upload Area
│   ├── FOOTER — Social links + Copyright
│   ├── BOTTOM NAV (mobile) — Admin | Kandidat
│   ├── MODALS (lazy loaded from modals-shared.html)
│   └── SCRIPTS — QR code + Bundle + Anti-cache
```

---

## 3. Dependensi Lengkap

### 3.1 CSS

| File | Tipe | Keterangan |
|------|------|------------|
| `/vendor/font-awesome/css/all.min.css` | External | Ikon Font Awesome |
| `/fonts/fonts.css` | Local | Custom fonts (Montserrat) |
| `/assets/main.css` | Build | Tailwind CSS bundle |

### 3.2 JavaScript (Bundle)

| File | Tipe | Fungsi |
|------|------|--------|
| `/assets/app-c20d359256.js` | Bundle | SEMUA modul init/render/admin_ops digabung |
| `/vendor/qrcode-generator.min.js` | Vendor | QR code generation |
| `/pwa.ts` | Core | Service worker + PWA features |
| `/assets/modals-shared.html` | Partial | Modal templates (loaded via XHR) |

### 3.3 Bundle Structure (app-*.js)

```
assets/app-*.js (bundle)
├── api-client.ts — callAPI, esc, escJs, resolveSelfUrl
├── js/core/bridge.ts — ESM bridge (registerSeamAliases)
├── js/init/boot.ts — App initialization
├── js/init/nav.ts — changePage, toggleMobileMenu, logoutApp
├── js/init/state.ts — Global state (ALL_JOBS, DROPDOWNS, etc.)
├── js/init/theme.ts — Theme toggle, sakura particles
├── js/init/util.ts — showToast, populate, format helpers
├── js/init/preview.ts — Document preview (lazy vendor libs)
├── js/render/public.ts — Render loker table
├── js/render/admin.ts — Render admin tabs
├── js/render/candidate.ts — Render kandidat dashboard
├── js/admin_ops/candidates.ts — Candidate operations
├── js/admin_ops/jobs.ts — Job operations
├── js/admin_ops/mail.ts — Mail inbox operations
├── js/admin_ops/schedule.ts — Schedule operations
├── js/admin_ops/wa.ts — WA template operations
├── js/admin_ops/config.ts — System config operations
├── js/pages/cv.ts — CV modal operations
├── js/pages/apply-docs.ts — Apply document model
└── i18n/core.js — Translation system
```

### 3.4 Backend Actions (via bundle)

| Action | Netlify Function | Digunakan di |
|--------|-----------------|--------------|
| `getAppData` | `get-app-data` | Semua page |
| `getAppConfig` | `config` | Config tab |
| `getCandidatesPage` | `candidates` | Pelamar tab |
| `loginKandidat` | `auth` | Login modal |
| `daftarKandidat` | `auth` | Register modal |
| `approveForm` | `candidates` | Mail inbox |
| `rejectForm` | `candidates` | Mail inbox |
| `reviewForm` | `candidates` | Mail inbox |
| `editLokerFull` | `jobs` | Kelola tab |
| `simpanJobBaru` | `jobs` | Tambah tab |
| `simpanJadwalBaru` | `schedule-reminders` | Jadwal tab |
| `simpanWaTemplate` | `whatsapp` | WA tab |
| `updateSysConfig` | `config` | Config tab |
| `runMigration` | `run-migration` | Config tab |
| `processAdminAIChat` | `ai-chat` | AI Copilot |
| `processUploadDoc` | `ingest` | Upload parser |

---

## 4. Alur Data (Flow)

### 4.1 Page Load

```
1. Browser load index.html
2. PWA manifest + theme init
3. Anti-cache check (2s delay)
4. Bundle load: app-c20d359256.js
5. boot.ts → init:
   a. loadHandler() — fetch getAppData + getAppConfig
   b. Render public table (ALL_JOBS)
   c. Check login status (localStorage)
   d. If admin → show nav-admin-mode, render admin tabs
   e. If kandidat → show nav-kandidat-mode, render dashboard
   f. If neither → show nav-mode (login/register)
   g. Load modals-shared.html via XHR
   h. Register service worker
```

### 4.2 Navigation (SPA-like)

```
changePage(page):
  1. Hide all pages (page-public, page-admin, page-kandidat)
  2. Show requested page
  3. Update mobile bottom nav
  4. If admin → render admin tab content
  5. If kandidat → render dashboard data
```

### 4.3 Admin Tab Switching

```
adminSwitchTab(tab):
  1. Hide all admin tab content
  2. Show requested tab
  3. Update sidebar active state
  4. If tab needs data → fetch from API
  5. Render tab content
```

---

## 5. State Management

### 5.1 Global State (state.ts)

| Variable | Type | Fungsi |
|----------|------|--------|
| `ALL_JOBS` | Array | Semua pekerjaan |
| `DROPDOWNS` | Object | Dropdown options (TSK, kategori, dll) |
| `CURRENT_THEME` | String | Theme aktif |
| `CURRENT_LANG` | String | Bahasa aktif |
| `AUTO_REFRESH_TIMER` | Number | Timer auto-refresh |

### 5.2 localStorage Keys

| Key | Isi |
|-----|-----|
| `asj_admin_login` | Admin login status |
| `asj_admin_session` | Admin session token |
| `asj_kandidat_login` | Kandidat login status |
| `asj_kandidat_session` | Kandidat session token |
| `asj_kandidat_wa` | Kandidat WA number |
| `asj_kandidat_name` | Kandidat name |
| `asj_theme` | Theme preference |
| `asj_lang` | Language preference |
| `asj_ac_v` | Anti-cache version |

---

#
## 9. E2E Tests

| File | Assertions | Categories |
|------|-----------|------------|
| `e2e/index-admin-test.mjs` | ~35 | 14 (load, header, nav, public, loker, filter, admin, candidate, bottom-nav, anti-cache, pwa, i18n, theme, errors) |

### Jalankan
Node e2e/index-admin-test.mjs membutuhkan dev server di localhost:3000.
