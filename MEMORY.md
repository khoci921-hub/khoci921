# MEMORY.md — History & Keputusan ASJ Portal

> File ini untuk konteks yang belum covered di ASJ-PORTAL.md.
> Baca hanya saat butuh konteks lengkap.

---

## Arsitektur Cepat

```
Live: asjportal.netlify.app
index.html (publik) ← js/main.js → assets/app-<hash>.js
admin.html (admin)  ← js/main.js → assets/app-<hash>.js
5 halaman standalone (apply-full, master-full, share, siswa-baru, ai_form)

Backend: netlify/functions/*.js → _lib/handlers → actions-*.js
Bridge: js/core/bridge.js → registerSeamAliases() → window.*
Deploy: pre-bundle functions → netlify deploy → live
Build: bun run build (check:globals + check:handlers + build:css + build:html + build:js)
```

## Keputusan yang Sudah Diambil

- Tanpa branch — kerja langsung di main
- Cloudinary untuk upload file (bukan Supabase Storage)
- ESM modules — semua modul sudah ESM, bridge ke window via registerSeamAliases
- Prettier: single quote, semi, 2-spasi, LF
- Sentry: lazy load dari CDN (bukan bundle)
- PostHog: lazy load dari CDN — session replay + analytics
- FCM: Firebase FCM (gratis unlimited)
- Netlify functions: pre-bundled ke CJS
- Anti-cache: 7 layer defense-in-depth
- Deploy: scripts/deploy-netlify.mts atau manual

## Dev Tooling

- Bundle analyzer: bun run bundle:analyze
- Conventional commits: .githooks/commit-msg
- E2E di CI: .github/workflows/e2e.yml
- Issue templates: .github/ISSUE_TEMPLATE/
- Build functions: scripts/build-netlify-functions.sh
- Deploy: scripts/deploy-netlify.mts

## Yang Perlu Dilanjutkan

1. FIREBASE_SERVICE_ACCOUNT perlu di-set di Netlify production
2. Migrasi ke repo baru (khoci921-hub)
3. Hapus @ts-nocheck bertahap

## Pelajaran Penting

- netlify-cli v27 crash di Windows+Node22 → downgrade atau deploy via Dashboard
- Free plan memblokir API env vars → set lewat Dashboard UI
- JANGAN ASSUME sebelum baca kode — baca source file dulu
- Jika fix tidak jalan setelah 2 percobaan → STOP, tanya user
