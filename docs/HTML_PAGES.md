# HTML Pages — Quick Reference

> Index ringkas semua halaman HTML. Detail lengkap ada di `docs/*-DEEP.md`.

---

## Ringkasan Struktur

```
Halaman Bundle (JS bundle assets/app-*.js):
├── index.html          — Hub utama (publik + kandidat + admin)
└── admin.html          — Panel admin (+ window.IS_ADMIN_PORTAL = true)

Halaman Standalone (type="module", entry sendiri):
├── apply-full.html     — Form lamaran 3 langkah
├── master-full.html    — Form master biodata 5 langkah + login gate
├── ai_form.html        — Chat AI + form CV bilingual (split view)
├── siswa-baru.html     — Chat AI + form pendaftaran siswa (split view)
└── share.html          — Public share viewer untuk kaisha
```

---

## Dependensi per Halaman

| Halaman | Entry Point | Backend Actions | DB Tables | DEEP Doc |
|---------|-------------|-----------------|-----------|----------|
| `index.html` | bundle | 16 actions | multiple | `index-admin-DEEP.md` |
| `admin.html` | bundle (sama) | 16 actions | multiple | `index-admin-DEEP.md` |
| `apply-full.html` | `js/pages/apply_full.ts` | `cekDataPelamar`, `submitApply` | `database_asj_form`, `database_candidate`, `master_database_candidate` | `apply-full-DEEP.md` |
| `master-full.html` | `js/pages/master_full.ts` | `loginKandidat`, `getMasterDataByWa`, `submitMasterForm` | `master_database_candidate`, `database_candidate` | `master-full-DEEP.md` |
| `ai_form.html` | `js/pages/ai_form.ts` | `processAIChat`, `getDrafCvMaster`, `getAppData`, `submitDataAsj` | `master_database_candidate`, `database_candidate` | `ai_form-DEEP.md` |
| `siswa-baru.html` | `js/pages/siswa_baru.ts` | `processSiswaAIChat`, `submitDaftarSiswa` | `respon_siswa_baru` | `siswa-baru-DEEP.md` |
| `share.html` | `js/pages/share.ts` | GET `/api/share-data` | READ: 5 tables | `share-DEEP.md` |

---

## Shared Dependencies

| File | Digunakan Oleh | Fungsi |
|------|----------------|--------|
| `/js/core/bridge.ts` | Semua halaman | ESM bridge → window.* aliases |
| `/js/upload-guard.ts` | apply, master, ai_form, siswa-baru | Validasi file |
| `/js/cloudinary.ts` | apply, master, ai_form, siswa-baru | Upload ke Cloudinary |
| `/pwa.ts` | Semua halaman | SW + PWA features |
| `/vendor/font-awesome/css/all.min.css` | Semua halaman | Ikon |
| `/assets/main.css` | Semua halaman | Tailwind CSS |

---

## Build Pipeline

```
Source (.ts) → esbuild → Output (.js)
├── js/main.ts → assets/app-<hash>.js (bundle untuk index/admin)
├── js/pages/*.ts → js/pages/*.js (standalone pages)
├── js/core/bridge.ts → js/core/bridge.js
├── js/cloudinary.ts → js/cloudinary.js
├── pwa.ts → pwa.js
└── js/upload-guard.ts → js/upload-guard.js

HTML build:
partials/ + module-registry → build-html.mts → *.html
```

---

## PWA & Cache Strategy

| Layer | Strategy | File |
|-------|----------|------|
| SW install | `skipWaiting()` — langsung aktif | `sw.js` |
| SW activate | Delete old cache + `clients.claim()` | `sw.js` |
| SW fetch | Network-first → cache → index.html fallback | `sw.js` |
| SW invalidation | Self-check setiap 5 menit | `sw.js` |
| Client | `ASJ_FORCE_RELOAD` broadcast → auto-reload | `pwa.ts` |
| Client | Offline indicator + error boundary | `pwa.ts` |
| Netlify | `no-cache, no-store, must-revalidate` untuk HTML + SW | `netlify.toml` |
| Netlify | `max-age=31536000, immutable` untuk assets | `_headers` |

---

## Hubungan Antar Halaman

```
index.html (Hub Utama)
├── → apply-full.html     (Form Lamaran — via URL params: ?job=&bidang=&wa=&nama=&req=)
├── → master-full.html    (Form Master — via URL params: ?wa=&nama=)
├── → ai_form.html        (AI CV — via URL params: ?flow=master&job=&bidang=&wa=&nama=)
├── → siswa-baru.html     (Program Kelas)
├── → share.html          (Share View — via URL params: ?job=CODE)
└── → admin.html          (Admin Panel)

share.html (Public)
└── → wa.me/6287889502004  (WhatsApp ke admin)

apply-full.html
└── → index.html           (Back to Portal — via tombol "Portal")
master-full.html
└── → index.html           (Back to Portal)
ai_form.html
└── → index.html           (Back to Portal — via tombol "Portal")
siswa-baru.html
└── → index.html           (Back to Portal — via tombol "Portal")
```

---

## Shared Partials

| Partial | Fungsi | Dipakai |
|---------|--------|---------|
| `partials/head-shared.html` | Meta tags + CSS links | Semua standalone |
| `partials/theme-init.html` | Theme init script | Semua standalone |
| `partials/scripts-shared.html` | Import map + module scripts | Semua standalone |
| `partials/header.html` | Header + nav buttons | index, admin |
| `partials/footer.html` | Footer + social links | index, admin |
| `partials/modals-shared.html` | Modal templates (via XHR) | index, admin |
| `partials/bottom-nav.html` | Mobile bottom navigation | index, admin |

---

## Workflow: Sentuh Kode HTML

1. Baca `docs/HTML_PAGES.md` (index ini) → identifikasi halaman
2. Baca `docs/<halaman>-DEEP.md` → pahami arsitektur + dependensi + flow
3. Plan perubahan → pastikan tidak merusak pipeline atau SW cache
4. Fix kode
5. Update DEEP doc jika ada perubahan struktur
6. `bun run build` → verify tidak ada error
