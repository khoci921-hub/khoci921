# PROGRESS.md — Ringkasan Pekerjaan Selesai

> Riwayat detail sesi: **PROGRESS2.md**. Riwayat per commit: **CHANGELOG2.md**.
> Riwayat penuh: `git log`.

---

## Status Sekarang

- **Live:** `asjportal.netlify.app`
- **Bundle:** `app-8ce5007ed1.js` (374KB)
- **Tests:** 285/285 lulus
- **Stack:** Vanilla JS (ESM), Netlify Functions (pre-bundled CJS), Supabase, Cloudinary, Tailwind v4

---

## Yang Sudah Selesai (reverse chronological)

### 2026-08-27

- Fix fetch limit 500 di backend AI (`findMasterByWa`, `handleSubmitDataAsj`, `handleSimpanDataTtdNaitei`)
- Fitur Download Biodata Lengkap (tombol di modal CV Admin)
- Fix Service Worker caching HTML (network-first untuk modals-shared.html)
- Notifikasi push biodata untuk semua pembaruan (dipindah ke `syncBiodataKeMail`)

### 2026-08-26

- PWA FCM Badge & Ikon Status ASJ (buildPushPayload, handler FCM, App Badging API)
- Fix Form AI CV Data Hilang saat login ulang (`JSON.parse(AIDATAJSON)`)
- Fix FCM Admin Push Notification ditolak server (registerFcmToken routing)
- Fix missing `window.showToast` di standalone pages (`externalizeSharedDeps` fix)
- Fix CSP Cloudinary + util import

### 2026-08-22

- Smart Ingestion (Gemini parse → upsert master_database_candidate)
- Bundle optimization (functions 106MB → 26.7MB, -75%)
- SW reload loop fix (max 2 auto-reloads per session)
- Fix laporan bulanan (`getMonthlyReport` + regression tests)
- Security review + Supabase/Postgres review + Tailwind v4 review

### 2026-08-21

- Sentry lazy load dari CDN (bundle 1.2MB → 461KB, -62%)
- FCM Push Notifications (notificationclick + fcm-client init)
- Anti-cache 7 layer (_headers + updateViaCache + self-invalidating SW + skipWaiting)
- Mail Inbox fix (UMUM→UPDATE, folder guard, dedup docs)
- Netlify deploy fix (pre-bundle functions ke CJS)
- PostHog session replay
- i18n lazy load JP locale (464KB → 374KB, -19.5%)

### 2026-08-20

- TypeScript migration (136+ file JS→TS)
- Performance optimization (debounce 250ms, infinite scroll, sessionStorage cache)
- Admin UX (sidebar navigation, hash-based routing, auto-refresh 30s)
- API docs (OpenAPI 3.1 auto-generated)

### 2026-08-19

- Fix shareLinkFor URL generation + FCM routing
- Data Pelamar Excel-style (toggle view, column filters, CSV export)
- Filter Admin Sederhana + Validasi Email
- Push Notification FCM (Firebase Cloud Messaging v1)
- Security headers (HSTS, CSP, Referrer-Policy)
- Dependency audit & update

### 2026-08-18

- Scanner check-handlers.mjs (self-validating, build+CI)
- Sesi admin permanen (refresh token auto-login)
- Theme per user (admin/kandidat/guest)
- Auto-update versi anti-cache
- Fix 3 handler inline tidak ter-expose (filterKelolaLoker, filterCbx, cariKandidatManual)
- HTML partial (Fase 5) + build entry eksplisit (Fase 6)
- i18n split per domain (Fase 4)
- Guard runtime handler (bridge.js)
- Deploy otomatis via build hook
- Env Netlify update + DEPLOY

### 2026-08-17

- Keep-alive ping (anti cold-start)
- Cloudinary direct unsigned upload (semua alur)
- Sourcemap bundel + laporan ukuran per-modul
- Pre-commit hooks + CI check
- Format semua file (Prettier)

### 2026-08-16

- ESM Fase 3 (semua JS → ES Modules)
- Bundel 1 file via esbuild
- Halaman standalone ENTRY ESM
- i18n modular

### 2026-08-15

- Rebuild + keamanan (rate limit, XSS escape, PII protection)
- UI solid light/dark
- Dedupe kandidat (30 duplikat dihapus)
- Cleanup 195 file yatim
- Deploy pertama ke Netlify

### 2026-08-14

- Refactor besar backend (handlers.js dispatcher, actions-extra.js dipecah)

### 2026-08-13

- Bootstrap proyek + backend Netlify Functions & Supabase

---

## Keputusan Penting

- WA format: selalu 628… (gate `/^628\d{9,11}$/`)
- Upload: browser → Cloudinary → URL string (bukan base64)
- Modal: edit di `partials/modals-shared.html` saja
- Build: `bun run build` setelah ubah JS/HTML/CSS
- Deploy: JANGAN tanpa izin pemilik
- Pipeline bisnis: JANGAN ubah urutan tahapan
- Tanpa branch: kerja langsung di `main`
- Gender: normalizeGender → `LAKI-LAKI`/`PEREMPUAN`
