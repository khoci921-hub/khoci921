# ASJ-PORTAL.md — Referensi Utama ASJ Portal

> **Repo:** `khociagus-png/Asjpow4v7` → `khoci921-hub/khoci921`
> **Produk:** Portal lowongan kerja ke Jepang — PT Amanah Sakura Japan
> **Live:** `asjportal.netlify.app` · **Bundle:** `app-8ce5007ed1.js`
> **Status:** PRODUCTION READY · 285/285 test · TS clean · Bundle 374KB

---

## 1. Stack & Arsitektur

```
Frontend:  HTML statis + vanilla JS (ESM) → esbuild → 1 bundel (assets/app-<hash>.js)
Backend:   Netlify Functions (pre-bundled CJS) → _lib/handlers.js → actions-*.js → Supabase
Storage:   Supabase (DB) + Cloudinary (file, unsigned upload)
Styling:   Tailwind v4 (src/main.css → assets/main.css)
Test:      Vitest (unit) + Playwright (E2E)
Deploy:    Netlify (manual, butuh izin pemilik)
```

### Peta Struktur

| Bagian             | Lokasi                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| Halaman utama      | `index.html` (publik+kandidat), `admin.html` (admin)                                   |
| Halaman mandiri    | `apply-full.html`, `master-full.html`, `ai_form.html`, `share.html`, `siswa-baru.html` |
| Logika frontend    | `js/*.js` (ESM) → bundel via `js/main.js` + esbuild                                    |
| Bridge ESM→classic | `js/core/bridge.js` — `registerSeamAliases()`                                          |
| Modal              | `partials/modals-shared.html` → `assets/modals-shared.html` (runtime loader)           |
| Backend            | `netlify/functions/**` + `_lib/` (handlers, actions, db, storage, session, rate-limit) |
| Build              | `scripts/build-{js,html,css}.mjs`                                                      |
| Shared JS          | `api-client.js` (callAPI), `i18n.js` (tr/LANG), `pwa.js`                               |

### Build Commands

```bash
bun install                          # Install dependencies
bun run build                        # Full build (check:globals + build:css + build:html + build:js)
bun run build:css                    # Tailwind only
bun run build:html                   # Modal partial → assets
bun run build:js                     # JS bundle (entry js/main.js → assets/app-<hash>.js)
bun run test                         # Vitest unit tests
bun run lint                         # ESLint
bun run format                       # Prettier
bun run check:globals                # Audit global pollution
bun run check:handlers               # Scan handler inline vs seam registry
bun run check:i18n                   # i18n key parity check
node serve-static.mjs                # Preview lokal :3000
```

> ⚠️ **WAJIB `bun run build` setelah ubah JS/HTML/CSS** — artefak di-commit (Netlify tidak build).
> ⚠️ Edit `assets/*`, `sw.js`, atau `<!--SHARED_MODALS-->` — **jangan pernah** manual.

---

## 2. Data Model & Konvensi

### Tabel Supabase

| Tabel                       | Isi                                | Kunci               |
| --------------------------- | ---------------------------------- | ------------------- |
| `database_asj_form`         | Lamaran (1 kandidat × code_job)    | `(no_wa, code_job)` |
| `database_candidate`        | Kandidat (biodata, status, folder) | `no_wa`             |
| `pemberkasan_checklist`     | Berkas upload per tahap            | `(wa, tahap)`       |
| `jobs` / `loker` / `lokers` | Lowongan                           | `code_job`          |
| `master_database_candidate` | Master biodata / riwayat (CV)      | per kandidat        |

### Normalisasi WA — JANGAN PERNAH dilanggar

- Format baku: **`628…`** (12-14 digit, awalan HP)
- Gate login/daftar: hanya `/^628\d{9,11}$/`
- `normalizeWa(v)` di `supabase.js`: buang non-digit, `0xx…` → `628xx…`
- WA typo (mis. `6223…` vs `6282…`) **ditolak** — mencegah kandidat duplikat

### Dedupe

- `bun run dedupe` = dry-run (read-only)
- `bun run dedupe:apply` = backup JSON → merge → hapus
- Rule merge: keeper by status (LULUS > GAGAL > REVIEW > UPDATE > MENUNGGU)
- Fuzzy: nama lengkap sama + jarak edit WA ≤ 2 → 1 kandidat

### Konvensi Lain

- **Gender:** `normalizeGender` → `LAKI-LAKI` / `PEREMPUAN` (kanonikal)
- **Upload:** browser → Cloudinary (unsigned, `asjportal` preset) → URL string ke backend
- **Modal:** edit HANYA di `partials/modals-shared.html`
- **i18n:** semua teks UI lewat `tr('ui.key')` — key di `i18n.js`
- **WA Pintar:** Fonnte API untuk blast

---

## 3. Backend

### Dispatcher Pattern

`netlify/functions/_lib/handlers.js` → `handleAction(payload)` → `dispatchAction(action, payload)`

Tambah action:

1. Buat `handleXxx(payload)` di file yang sesuai (`actions-*.js`)
2. Daftarkan di switch `dispatchAction`
3. Tambah ke rate limit group jika perlu (`LOGIN_ACTIONS` / `AI_ACTIONS` / `FONNTE_ACTIONS`)

### Auth & Session

- Admin: 3-step login (master PIN → user selection → PIN) → HMAC session token
- Kandidat: WA+PIN → bcrypt compare → HMAC token
- Refresh token: `refreshAdminSession` / `refreshKandidatSession` (auto-login persist)
- `requireRole(token, 'admin')` — guard backend

### Rate Limiting

- Login admin: 5/menit + lockout
- AI: 10/menit
- Fonnte: 2/menit

---

## 4. ESM & Bridge

### Arsitektur

- Semua JS = ES Modules
- Bundel admin/index: `js/main.js` → esbuild → `assets/app-<hash>.js` (IIFE)
- Halaman standalone: ENTRY ESM sendiri (`<script type="module" src="/js/pages/*.js">`)
- Bridge: `js/core/bridge.js` → `window.PortalBridge` + `registerSeamAliases()`

### Aturan Wajib Patch Frontend

1. Modul ESM baru: export publik + `registerSeamAliases()` — jangan `window.X = X` manual
2. HTML onclick/onchange: nama fungsi harus di registry seam
3. Scan wajib: `bunx eslint --rule 'no-undef: error'` → 0 error
4. Build setelah ubah: `bun run build`

---

## 5. Team Work Rules

### Commit Convention

```
<Kategori>: <ringkasan>

<detail 1-3 baris>
```

- Kategori: `Fix`, `Feat`, `Optimasi`, `Refactor`, `Docs`, `Test`, dll.
- Dilarang pesan generik tanpa keterangan.

### Cek Identitas

```bash
git config user.name   # harus sesuai pengerja
git config user.email
```

### Update Riwayat

Setiap sesi WAJIB menambah entri di `PROGRESS2.md` dengan header: **tanggal, nama pengerja, hash commit, ringkasan**.

### Rules untuk AI Assistant

1. **Commit + push ke `main`** — tidak ada branch lain
2. **JANGAN `git push` tanpa izin user** — push = makan kuota build Netlify
3. **JANGAN deploy Netlify tanpa izin eksplisit pemilik** — lihat §6
4. Jangan hapus/ubah data user yang sudah ada
5. Jangan edit `.env*`
6. Jangan menulis ulang async/await jadi `.then()`
7. Jejak kerja wajib jelas (siapa & kapan)

---

## 6. Deploy Policy

### Aturan

1. **GitHub = satu-satunya sumber kode** — semua perubahan lewat repo `main`
2. **Netlify: DILARANG deploy KECUALI diizinkan eksplisit oleh pemilik** pada sesi itu
3. "Diizinkan" = pemilik berikan token `NETLIFY_AUTH_TOKEN` atau perintah tertulis
4. Live tidak otomatis sinkron dengan repo — hanya berubah setelah deploy yang diizinkan
5. Build hook ada (`.github/workflows/deploy-netlify.yml`), tapi `workflow_dispatch` (manual)

### Deploy Checklist

```bash
git pull origin main                    # 1. Pastikan di commit terbaru
bun run build                           # 2. Build + commit asset
npx netlify-cli env:list                # 3. Env vars lengkap
# 4. Verifikasi site = Public
curl -s -o /dev/null -w "%{http_code}" https://<site>.netlify.app/  # 200
```

### Netlify Account

| Item    | Nilai                                                   |
| ------- | ------------------------------------------------------- |
| Akun    | `nerazzurri190889@gmail.com` (tim `asjamnag`)           |
| URL     | `asjportal.netlify.app`                                 |
| Site ID | `129e4532-ac7e-4bd9-bdc1-9117666681ba` (baru, khoci921) |

### Env Vars (Production)

| Key                                                                 | Status                |
| ------------------------------------------------------------------- | --------------------- |
| `SUPABASE_URL` / `SERVICE_ROLE_KEY` / `ANON_KEY` / `STORAGE_BUCKET` | ✅ OK                 |
| `ADMIN_MASTER_PIN` / `PIN_KHOCI` / `ASJ_ADMINS` / `ADMIN_NUMBERS`   | ✅ OK                 |
| `SESSION_SECRET`                                                    | ✅ 64-hex             |
| `GEMINI_API_KEY` / `FONNTE_TOKEN` / `NETLIFY_SITE_URL`              | ✅ OK                 |
| `GROQ_API_KEY` / `LOG_DRAIN_TOKEN`                                  | ✅ Belum dipakai kode |

### Netlify Free Plan Limitations

- ❌ `POST /api/v1/sites/{id}/env` → "Not Found" (harus lewat Dashboard UI)
- ❌ Function upload via API → "Not Found" (harus connect GitHub repo)
- ✅ GET site info, list deploys, POST manual deploy

### PELAJARAN DEPLOY

- **netlify-cli v27** crash di Windows+Node22 → downgrade atau deploy via Dashboard
- **Free plan** memblokir API env vars → set lewat Dashboard UI
- Deploy berhasil via: `scripts/deploy-netlify.mts` (saat CLI compatible), atau manual push ke GitHub → auto-build

### Riwayat Deploy Ringkas

| Tanggal                      | Catatan                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| 2026-08-15                   | Deploy pertama `asjportal-379` (237 file, 19 functions, 12 env)  |
| 2026-08-16                   | Deploy fix `14c2661` (CHECK constraint fix)                      |
| 2026-08-17                   | Deploy `7796fb7` (i18n JP fix +                                  |
| undangan pindah ke panel WA) |
| 2026-08-17                   | Deploy 83f5ebf (SW anti-cache: skipWaiting + badge versi)        |
| 2026-08-18                   | Deploy acb299b (refresh token + theme per user + ASJ_ADMINS fix) |
| 2026-08-18                   | Deploy aaac6ac (8 fix + refactor backend)                        |
| 2026-08-19                   | Deploy f18f6c7 (fix shareLinkFor URL + FCM routing)              |
| 2026-08-19                   | Deploy da38977 (fix registerFcmToken routing)                    |
| 2026-08-19                   | Deploy 4f0f938 (Data Pelamar Excel-style)                        |
| 2026-08-19                   | Deploy d279b80 (Filter Admin + Validasi Email)                   |
| 2026-08-21                   | Deploy 032e71a ke asjportal-terbaru (TS migration)               |
| 2026-08-22                   | Deploy ke asjportal-baru (static files only, functions gagal)    |
| 2026-08-26                   | Deploy b9730fa (pindah ke akun Netlify baru)                     |
| 2026-08-26                   | Deploy fix CSP Cloudinary + util import                          |

> Detail lengkap deploy: git log --format="%h %ad %s" --date=short

---

## 7. Pipeline Bisnis (JANGAN UBAH!)

> Portal hanya mendigitalkan/mengotomasi alur ini — TIDAK BOLEH mengubah urutan/sifat alur lapangan.

### Fase A — Rekrutmen & Seleksi

| #   | Tahapan    | Arti                                                 |
| --- | ---------- | ---------------------------------------------------- |
| 1   | list-check | Daftar kandidat diverifikasi (umur, gender, dokumen) |
| 2   | kaiwa      | Tes percakapan bahasa Jepang                         |
| 3   | mendan     | Wawancara pendahuluan                                |
| 4   | mensetsu   | Wawancara formal (dengan pihak Jepang)               |
| 5   | lolos user | Dinyatakan lulus seleksi                             |

Corong: list 30 → lolos kaiwa 7 → mendan 5 → lolos user 3.

### Fase B — Pendokumenan (hanya setelah lolos user)

| #   | Tahapan     |
| --- | ----------- |
| 1   | MCU         |
| 2   | Paspor      |
| 3   | TTD Kontrak |
| 4   | Proses COE  |
| 5   | Siskop      |
| 6   | e-ID        |
| 7   | Visa        |
| 8   | Flight      |

### Hard Rules

1. Status hanya diubah admin/lapangan — sistem tidak auto-lolos
2. Dukung penyimpangan (skip tahap, alur khusus perusahaan, cancel)
3. Cancel = berhenti + alasan, bukan lanjut otomatis
4. Lolos user = gerbang fase — belum lolos user tidak boleh masuk Fase B
5. Berkas tetap di Drive — portal hanya menautkan

### Checklist Sebelum Fitur Baru

- Mencatat/mengotomasi alur yang sudah ada?
- Admin/lapangan tetap yang mengubah status?
- Alur cancel tetap dihormati?
- Semua jawaban harus "ya" — kalau tidak, bahas dulu

---

## 8. Security & Review

### Checklist

| Item                         | Status            |
| ---------------------------- | ----------------- |
| SESSION_SECRET di Netlify    | Terisi            |
| getAppConfig admin-only      | OK                |
| PII jalur publik dibatasi    | OK                |
| Rate limit (login/AI/Fonnte) | Tested            |
| XSS escape (esc()/escJs())   | Menyeluruh        |
| Server-side filtering        | Sebagian besar OK |
| HSTS / CSP headers           | 2026-08-19        |

### Performance Guidelines

1. Debounce: Semua input pencarian — minimal 250ms
2. Infinite Scroll: Tabel besar render 25 baris awal + IntersectionObserver
3. SessionStorage Cache: getAppData/getCandidatesPage cache 5 menit, invalidasi pada mutasi

### Fitur Lock (Jangan Longgarkan)

| Fitur             | Entry                  | Terbuka untuk                         |
| ----------------- | ---------------------- | ------------------------------------- |
| E-Sign & Naitei   | bukaModalTtd           | Admin ATAU kandidat lolos/pemberkasan |
| AI CV Master      | bukaMasterEksternal    | Admin ATAU VIP/KELAS                  |
| Latihan Interview | bukaSimulatorInterview | Admin ATAU VIP/KELAS                  |

---

## 9. Infra Baru (Agustus 2026)

| Item         | Nilai                                     |
| ------------ | ----------------------------------------- |
| GitHub baru  | khoci921-hub/khoci921 (remote: origin-v2) |
| Netlify baru | asjportal.netlify.app                     |
| Site ID      | 129e4532-ac7e-4bd9-bdc1-9117666681ba      |
| Netlify PAT  | nfp_1fba2XWjCEBGMj2jygs8QM75apq8mFS6c4ad  |

> Push ke khoci921-hub → Netlify otomatis build.
> Jangan push ke khociagus-png/Asjpow4v7 lagi (repo lama).

---

## 10. Peta Dokumen Lainnya

| Dokumen       | Isi                                                         |
| ------------- | ----------------------------------------------------------- |
| AGENTS.md     | Quick reference + Mandatory Skill Dispatch (untuk AI agent) |
| PROGRESS2.md  | Riwayat sesi terbaru (detail)                               |
| CHANGELOG2.md | Riwayat per commit                                          |
| MEMORY.md     | History, keputusan, known issues                            |
| TODO.md       | Items terbuka                                               |
| DEBUG-TODO.md | Debug checklist 92 parts                                    |
| docs/api.json | OpenAPI spec (auto-generated)                               |

---

## 11. Debugging Rules

- JANGAN ASSUME sebelum baca kode. Baca source file dulu.
- Jika fix tidak jalan setelah 2 percobaan — STOP, tanya user untuk screenshot.
- Periksa perbedaan index.html vs admin.html — kontennya bisa beda.
- Baca file ini di awal sesi — jangan ulangi fix yang sudah dilakukan.
