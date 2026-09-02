# TODO.md — Items Terbuka

> Status terakhir: 2026-08-27. Coret saat selesai.

---

## 🔴 Opsional / Future

- [ ] Token sekali pakai di link `generateFormBridge` (risiko rendah — data di URL non-sensitive, link hanya dipakai admin+kandidat login)
- [ ] FIREBASE_SERVICE_ACCOUNT di-set di Netlify production (sudah di .env.local)
- [ ] Hapus @ts-nocheck bertahap (sudah bersih, tapi perlu verifikasi)
- [ ] Deploy redirect `asjportal.netlify.app` → `asjportal-terbaru.netlify.app` (_redirects file sudah siap)
- [ ] UptimeRobot health check `/ping` endpoint (perlu buat akun)
- [ ] Lazy load i18n inactive language (97KB → bisa async)
- [ ] Backend Sentry integration (`@sentry/node` + wrap handler)

## ✅ Selesai (retained untuk reference)

- Semua items di Review Roadmap (Tier 1-4) sudah selesai 100%
- Session Secret terisi
- Dependency audit & update
- Test coverage 285/285
- Sentry + PostHog terintegrasi
- Performance optimization (debounce, infinite scroll, cache)
- TypeScript migration
- API docs (OpenAPI)
- E2E test expansion
- Backend modularisasi
- Admin UX (sidebar, hash routing, auto-refresh)
- CSV export + monthly report
- Security headers (HSTS, CSP)
- Build hook + CI
- Env vars Netlify terverifikasi (14 var)
