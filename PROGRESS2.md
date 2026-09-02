# PROGRESS2.md — Riwayat Sesi Terbaru

> Riwayat detail per-hari di bawah. Riwayat per commit: **CHANGELOG2.md**.

---

## Sesi 2026-08-27 (Siang) — Fitur Unduh Biodata & Fix SW Cache (AI Agent)

1. **Download Biodata Lengkap Admin** — tombol di modal CV Admin (`partials/modals-shared.html`), fungsi `downloadBiodataLengkap` di `js/admin_modal/cv.ts` (render HTML siap print → PDF di tab baru)
2. **Fix SW caching HTML** — `sw.js` line 184: `req.mode === 'navigate' || url.pathname.endsWith('.html')` → network-first untuk modals-shared.html
3. **Notifikasi push biodata** — pindahkan `notifyAdmins` dari `actions-master.ts` ke `syncBiodataKeMail` di `actions-mail.ts` → kapan pun biodata di-update, admin dapat notifikasi

## Sesi 2026-08-27 (Pagi) — Fix fetch limit 500 di backend (AI Agent)

1. `findMasterByWa` → pakai `fetchMasterByWa` dari `db/master.ts` (sudah difilter per WA sebelum limit)
2. `handleSubmitDataAsj` → tambah `wa: eq.${wa}` + `limit: 10`
3. `handleSimpanDataTtdNaitei` → difilter per WA

## Sesi 2026-08-26 (Malam) — PWA FCM Badge & Ikon Status ASJ (AI Agent)

1. FCM payload data-only (`buildPushPayload` di `fcm-server.ts` + unit test)
2. SW FCM handler injeksi (`src/sw-fcm-notification.js` → `build-js.mts`)
3. PWA App Badging API (`navigator.setAppBadge` di SW + `clearAppBadge` di frontend)
4. FCM client handler update (fallback message dari tipe data)

## Sesi 2026-08-26 (Sore) — Fix Form AI CV & FCM Admin Push (AI Agent)

1. Fix data AI CV hilang saat login ulang — root cause: `getDrafCvMaster` response tidak diparsed → `JSON.parse(res.AIDATAJSON)` ditambahkan
2. Fix FCM admin ditolak — registerFcmToken ditambahkan ke `CANDIDATE_ACTIONS`, bypass normalisasi jika role admin

## Sesi 2026-08-26 — Fix missing window.showToast (AI Agent)

1. `externalizeSharedDeps` di `build-js.mts` salah externalized `util.ts` → fix: target hanya `bridge.ts` + `cloudinary.ts`
2. FCM push notifications — `FIREBASE_SERVICE_ACCOUNT` kosong di Netlify → set via CLI

## Sesi 2026-08-22 (Sore) — Fix Laporan Bulanan + Regression Tests (Buffy)

1. `getMonthlyReport` tidak ada di `ADMIN_ACTIONS` → tambahkan
2. Hapus stale entries (`getDriveLinkCandidates`, `uploadDriveReplacement`)
3. +2 regression tests (action-registry)
4. Security review: 2 findings (`ingest.js` no rate limit + CORS wildcard)

## Sesi 2026-08-22 (Pagi) — Smart Ingestion + Bundle Optimization (Buffy)

1. Smart Ingestion: 3 jalur upload → `actions-ingest.ts` (Gemini parse → upsert master)
2. Bundle: functions 106MB → 26.7MB (-75%)
3. SW reload loop fix: max 2 auto-reloads + 30s cooldown

## Sesi 2026-08-21 — Sentry + FCM + Anti-cache + Deploy (Buffy)

18 commits: Sentry lazy load (bundle -62%), FCM push notifications, anti-cache 7 layer, mail inbox fix, Netlify deploy fix (pre-bundle CJS), PostHog session replay, i18n lazy load (-19.5%)

## Sesi 2026-08-20 — TypeScript Migration + Performance

- TS migration: 136+ file JS→TS, `tsc --noEmit` = 0 errors
- Performance: debounce 250ms, infinite scroll, sessionStorage cache
- Admin UX: sidebar navigation, hash routing, auto-refresh 30s
- API docs: OpenAPI 3.1 auto-generated

## Sesi 2026-08-18 (ringkasan gabungan) — Bug Hunt + Refactor Fase 4-6 + Deploy

### Commits utama:

- Scanner `check-handlers.mjs` (self-validating, build+CI)
- Sesi admin permanen (refresh token auto-login)
- Theme per user + auto-update versi anti-cache
- Fix 3 handler inline (filterKelolaLoker, filterCbx, cariKandidatManual)
- HTML partial Fase 5 + build entry eksplisit Fase 6 (47 modul)
- i18n split per domain Fase 4 (15 domain/bahasa)
- Guard runtime handler (bridge.js)
- Env Netlify update (14 var) + DEPLOY `acb299b`
- Deploy paket 8 fix `aaac6ac`
- WA Pintar seragam dengan model Undang Grup Kelas
- Audit mail: label update biodata + admin edit sync ke mail

## Sesi 2026-08-17 (ringkasan)

- Keep-alive ping (anti cold-start, workflow cron 5 menit)
- Cloudinary direct unsigned upload (semua alur upload)
- Sourcemap bundel + laporan ukuran per-modul
- Pre-commit hooks + CI check GitHub
- Format semua file (Prettier)

## Sesi 2026-08-16 (ringkasan)

- ESM Fase 3: semua JS → ES Modules, bundel 1 file via esbuild
- Halaman standalone ENTRY ESM
- i18n modular: `i18n/locales/{id,jp}.js`

## Sesi 2026-08-15 (ringkasan)

- Rebuild + keamanan (rate limit, XSS escape, PII protection)
- UI solid light/dark, 27 modal → partials/modals-shared.html
- Dedupe kandidat (30 duplikat dihapus)
- Cleanup 195 file yatim
- Deploy pertama ke Netlify

## Sesi 2026-08-14 (ringkasan)

- Refactor besar backend: handlers.js jadi dispatcher, actions-extra.js dipecah per domain

## Sesi 2026-08-13 (ringkasan)

- Bootstrap proyek + backend Netlify Functions & Supabase
