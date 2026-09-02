# CHANGELOG2 — Riwayat Commit

> Format: hash — deskripsi. Riwayat detail sesi: PROGRESS2.md.

## 2026-08-27

- `?` fix(backend): perbaiki fetch limit 500 di ai/cv.ts (findMasterByWa, handleSubmitDataAsj, handleSimpanDataTtdNaitei)
- `?` feat: Download Biodata Lengkap Admin (modal CV → HTML print)
- `?` fix(sw): network-first untuk modals-shared.html
- `?` feat: notifikasi push biodata untuk semua pembaruan

## 2026-08-26

- `?` feat(fcm): PWA badge + App Badging API + FCM data-only payload
- `?` fix: Form AI CV data hilang saat login ulang (JSON.parse AIDATAJSON)
- `?` fix: FCM admin push notification ditolak server (registerFcmToken routing)
- `?` fix: window.showToast undefined di standalone pages (externalizeSharedDeps)
- `5d3a7f0` fix(core): import util.ts di ai_form, whitelist CSP Cloudinary

## 2026-08-22

- `b317d57` fix: laporan bulanan + regression tests + stale entries
- `70d84ac` feat: Smart Ingestion + fix toggle mobile + FCM graceful degrade
- `bc39b1d` feat: optimize bundle + fix SW reload loop + Smart Ingestion E2E

## 2026-08-21

- `0197c57` fix(netlify): pre-bundle functions + DEPLOY LIVE (asjportal-terbaru)
- `d43c9ca` perf(sentry): lazy load SDK dari CDN (bundle -62%)
- `2a04444` feat(fcm): push notifications activate
- `ad710f0` fix(pwa): _headers + build-system anti-cache
- +14 commits: mail fix, XSS test fix, bundle-analyze TS fix, PostHog, i18n lazy load

## 2026-08-20

- `17f09ac` TypeScript migration (136+ file JS→TS)
- Performance optimization (debounce, infinite scroll, sessionStorage cache)

## 2026-08-19

- `f18f6c7` fix: shareLinkFor URL generation + FCM routing
- `da38977` fix: registerFcmToken routing
- `4f0f938` feat: Data Pelamar Excel-style
- `d279b80` feat: Filter Admin Sederhana + Validasi Email
- `?` feat: Push Notification FCM (Firebase Cloud Messaging v1)
- Security headers (HSTS, CSP, Referrer-Policy)
- Dependency audit & update

## 2026-08-18

- `aaac6ac` Deploy paket 8 fix + refactor backend
- `acb299b` Refresh token kandidat + auto-update versi + theme per user
- `8511014` Sesi admin permanen (refresh token) + theme per user
- `8769ef5` Undangan Wali terbukti LIVE + kartu dipindah ke puncak WA Pintar
- Scanner `check-handlers.mjs` (self-validating, build+CI)
- Fix 3 handler inline (filterKelolaLoker, filterCbx, cariKandidatManual)
- HTML partial Fase 5 + build entry eksplisit Fase 6
- i18n split per domain Fase 4
- Guard runtime handler (bridge.js)
- Env Netlify update (14 var)

## 2026-08-17

- `941b01a` keep-alive ping + Cloudinary direct unsigned upload
- `36373f3` Cloudinary migration (master-full, apply-full, ai_form, siswa-baru)
- `26f2a91` Tes preset Cloudinary + penanda versi header → footer
- `dcb6938` Rapikan repo: dokumen point-form + format kode seragam
- `02cc74f` Pengaman format: pre-commit hook + CI check GitHub

## 2026-08-16

- ESM Fase 3: semua JS → ES Modules, bundel 1 file via esbuild
- Halaman standalone ENTRY ESM
- i18n modular

## 2026-08-15

- Rebuild + keamanan + UI solid light/dark
- Dedupe kandidat (30 duplikat dihapus)
- Deploy pertama ke Netlify (`asjportal-379`)

## 2026-08-14

- `00e5ebb` Refactor besar backend

## 2026-08-13

- Bootstrap proyek
