# AGENTS_REFERENCE.md — Reference Lengkap untuk AI Agent

> File ini berisi SEMUA informasi yang dibutuhkan AI agent saat mengerjakan ASJ Portal.
> Untuk skill dispatch & workflow rules, lihat juga AGENTS.md.

---

## Status Sekarang

- **Live:** asjportal.netlify.app
- **Bundle:** app-8ce5007ed1.js (374KB)
- **Tests:** 285/285 lulus
- **Stack:** Vanilla JS (ESM), Netlify Functions (pre-bundled CJS), Supabase, Cloudinary, Tailwind v4

---

## Peta Struktur

```
root/
├── index.html, admin.html, apply-full.html, master-full.html,
│   share.html, siswa-baru.html, ai_form.html   # SPA statis (vanilla JS, no framework)
├── js/*.js, js/{init,engine,render,api,admin_modal,admin_ops,ai_copilot,pages,core}/
│   # logika frontend (sumber)
├── api-client.js, i18n.js   # client API + terjemahan — ESM (export + alias window.*)
├── js/core/bridge.js        # bridge ESM→legacy: window.PortalBridge
├── pwa.js                   # service worker helper (classic)
├── partials/modals-shared.html                 # SATU-SATUNYA sumber semua modal (~30 modal)
├── src/main.css                                # input Tailwind v4
├── netlify/functions/_lib/
│   ├── handlers.js      # DISPATCHER semua action backend
│   ├── supabase.js      # akses DB Supabase + normalisasi WA
│   ├── session.js       # token sesi HMAC
│   ├── env.js           # whitelist env var
│   └── rate-limit.js    # rate limit login/AI/Fonnte/admin
├── scripts/build-*.mjs  # build pipeline (css, html, js)
├── scripts/dedupe-duplicates.mjs  # dedupe kandidat duplikat
├── e2e/*.mjs            # test end-to-end Playwright
└── skills/              # Agent skills library
```

---

## Golden Rule Build

**Edit SOURCE → bun run build → restart preview → verifikasi.**

| Yang diubah     | Sumber                                  | Build wajib        | Artifact                  |
| --------------- | --------------------------------------- | ------------------ | ------------------------- |
| Logika frontend | js/*.js, api-client.js, i18n.js, pwa.js | bun run build:js   | assets/app-<hash>.js      |
| Modal           | partials/modals-shared.html             | bun run build:html | assets/modals-shared.html |
| Styling         | src/main.css + kelas Tailwind           | bun run build:css  | assets/main.css           |
| Backend         | netlify/functions/_lib/*.js             | tidak perlu build  | — (restart preview)       |

> Jangan pernah edit assets/*, sw.js, atau wilayah SHARED_MODALS secara manual.

---

## Data Model & Konvensi WA

### Tabel Supabase

| Tabel                     | Isi                                | Kunci unik        |
| ------------------------- | ---------------------------------- | ----------------- |
| database_asj_form         | Lamaran (1 kandidat × code_job)    | (no_wa, code_job) |
| database_candidate        | Kandidat (biodata, status, folder) | no_wa             |
| pemberkasan_checklist     | Berkas upload per tahap            | (wa, tahap)       |
| jobs / loker / lokers     | Lowongan                           | code_job          |
| master_database_candidate | Master biodata / riwayat (CV)      | per kandidat      |

### Normalisasi WA — JANGAN PERNAH dilanggar

- Format baku: **628…** (12-14 digit, awalan HP)
- Gate login/daftar: hanya /^628\d{9,11}$/
- normalizeWa(v) di supabase.js: buang non-digit, 0xx… → 628xx…
- WA typo ditolak — mencegah kandidat duplikat

### Dedupe

- bun run dedupe = dry-run
- bun run dedupe:apply = backup → merge → hapus
- Rule: keeper by status (LULUS > GAGAL > REVIEW > UPDATE > MENUNGGU)
- Fuzzy: nama sama + jarak edit WA ≤ 2 → 1 kandidat

---

## Konvensi Kode

### Frontend

- Panggilan backend: callAPI('namaAction', [arg1, arg2])
- i18n: semua teks UI lewat tr('ui.key')
- Jangan menulis ulang async/await jadi callback .then()

### Backend (handlers.js)

- Tambah action baru = 1 fungsi handleXxx(payload) + daftarkan di switch dispatchAction
- Action yang butuh rate limit: tambahkan ke LOGIN_ACTIONS / AI_ACTIONS / FONNTE_ACTIONS
- Semua mutasi lewat supabase.supabaseJson(...) / helper di supabase.js

### Modal

- SEMUA modal di partials/modals-shared.html — edit SATU tempat, lalu bun run build:html

### ESM & Bridge

- Semua JS = ES Modules
- Modul baru: export publik + registerSeamAliases() — jangan window.X = X manual
- HTML onclick/onchange: nama fungsi harus di registry seam
- Scan wajib: bunx eslint --rule 'no-undef: error' → 0 error
- Build setelah ubah: bun run build

---

## Fitur Lock (Jangan Longgarkan)

| Fitur             | Entry point            | Terbuka untuk                         | Lock kalau                 |
| ----------------- | ---------------------- | ------------------------------------- | -------------------------- |
| E-Sign & Naitei   | bukaModalTtd           | Admin ATAU kandidat lolos/pemberkasan | Tahapan belum masuk daftar |
| AI CV Master      | bukaMasterEksternal    | Admin ATAU VIP/KELAS                  | Non-VIP                    |
| Latihan Interview | bukaSimulatorInterview | Admin ATAU VIP/KELAS                  | Non-VIP                    |

---

## Performance Guidelines

1. Debounce Filter: minimal 250ms untuk semua input pencarian
2. Infinite Scroll: render 25 baris awal + IntersectionObserver
3. SessionStorage Cache: getAppData/getCandidatesPage cache 5 menit, invalidasi pada mutasi

---

## Build Commands

```bash
bun install
bun run build              # full build
bun run build:css          # Tailwind only
bun run build:html         # Modal partial → assets
bun run build:js           # JS bundle
bun run test               # Vitest unit tests
bun run lint               # ESLint
bun run format             # Prettier
bun run check:globals      # Audit global pollution
bun run check:handlers     # Scan handler inline vs seam registry
bun run check:i18n         # i18n key parity check
node serve-static.mjs      # Preview lokal :3000
```

### Verifikasi syntax

```bash
node --check js/04_auth.js && node --check netlify/functions/_lib/handlers.js
node --check --input-type=module < api-client.js
bunx eslint --no-warn-ignored --rule 'no-undef: error' --rule 'no-unused-vars: off' api-client.js i18n.js js/core/bridge.js
```

### E2E regresi

```bash
BASE_URL="http://localhost:3000" node e2e/upload-check.mjs
BASE_URL="http://localhost:3000" node e2e/biodata-check.mjs
BASE_URL="http://localhost:3000" node e2e/login-check.mjs
```

---

## Aturan Umum

1. WA: selalu 628xxxxxxxxxxxx (12-14 digit)
2. Upload: browser → Cloudinary → URL string
3. Modal: edit di partials/modals-shared.html saja
4. Build: bun run build setelah ubah JS/HTML/CSS
5. Deploy: JANGAN tanpa izin pemilik
6. Gender: normalizeGender → LAKI-LAKI / PEREMPUAN
7. Pipeline bisnis: JANGAN ubah urutan tahapan

---

## Peta Dokumen

| Dokumen             | Isi                                   | Kapan dibaca             |
| ------------------- | ------------------------------------- | ------------------------ |
| AGENTS.md           | Skill dispatch + quick reference      | Setiap sesi              |
| AGENTS_REFERENCE.md | File ini — reference lengkap          | Saat butuh detail        |
| ASJ-PORTAL.md       | Konsolidasi (deploy, infra, pipeline) | Saat butuh context       |
| PROGRESS2.md        | Riwayat sesi terbaru                  | Saat butuh history       |
| CHANGELOG2.md       | Riwayat per commit                    | Saat butuh detail commit |
| MEMORY.md           | Keputusan, known issues               | Saat butuh konteks       |
| TODO.md             | Items terbuka                         | Saat planning            |
| DEBUG-TODO.md       | Debug checklist (92 parts)            | Setiap sesi debug        |
| skills/SKILLS.md    | Skills index                          | Setiap sesi (dispatch)   |
| docs/api.json       | OpenAPI spec                          | Saat kerja backend API   |
