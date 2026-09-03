# PROGRESS2.md — Riwayat Sesi Terbaru

> Riwayat detail per-hari di bawah. Riwayat per commit: **CHANGELOG2.md**.

---

## Sesi 2026-09-03 — Kirim batch ketahan rate limit Fonnte (Buffy)

1. **Gejala user** — setelah fix D12, kirim undangan grup (21 ortu) tidak
   ada WA yang tiba. Investigasi: POST whatsapp balas 200 semua, kuota
   Fonnte hanya used=1 → hanya 1 pesan yang benar-benar terkirim.
2. **Root cause** — rate limiter server `FONNTE_ACTIONS {limit:2,
   windowMs:60000}` per admin (handlers.ts) → nomor ke-3 dst dibalas
   `{success:false, rateLimited:true, retryAfter}`. `kirimBertahap` lama
   tidak mengenal flag itu → mencatat semua sisa sebagai gagal diam-diam.
   (Kirim massal lama `kirimTawaranMassal` pasti kena batas yang sama —
   turut menjelaskan bug historis "cuma kirim 1x".)
3. **Fix** — `kirimBertahap`: saat respons punya `rateLimited` → tunggu
   `retryAfter + 1` dtk, ulangi nomor yang sama (maks 3×). Semua nomor
   akhirnya terkirim dengan pace mengikuti batas server (~1 pesan/30 dtk).
4. **UI** — label tombol "Menunggu jeda server… {n} dtk (i/n)" saat retry
   (i18n id+jp `sending_wait_rl`); toast akhir kini menyertakan jumlah gagal
   bila ada (`toast_invites_done_failed_n`). Berlaku di 3 jalur: Undang Grup
   Kelas, Undang Grup DB, blast matchmaking.
5. **Verifikasi** — tsc 0 error · vitest 344/344 (3 test baru
   candidates.test.ts: retry sampai sukses, maks 3 percobaan, info progres)
   · check-globals nol kolisi ✓ · bundel `assets/app-2179a5baf1.js`.

---

## Sesi 2026-09-03 — Tombol Auto-Varian Anti-Ban (Buffy)

1. **Masalah** — template tanpa varian `---` → pesan identik ke semua
   penerima (risiko banned). Solusi: tombol di modal Undangan Grup Kelas
   yang mengubah 1 template jadi 2-4 variasi otomatis.
2. **Generator murni** `buatVarianPesanOtomatis(tpl, max)` di
   `shared/wa-text.ts` (+unit test): varian #1 = teks asli; variasi lain
   mengganti baris sambutan (Halo/Assalamu'alaikum/Kak … yang baik/Salam)
   & kalimat penutup, tanda tangan organisasi ("AMANAH SAKURA JAPAN.")
   dipertahankan; {nama}/{link_grup}/isi tidak diubah. Varian dengan pembuka
   sama (kloning kosmetik) dilewati.
3. **UI** — tombol + hint di partials/modals-shared.html (data-lang
   autovarian_* id+jp); `generateVarianOtomatisKelas()` di candidates.ts
   (baca daftar penerima → target varian = min(jumlah penerima, 4); template
   multi-varian tidak ditimpa, toast peringatan); alias window + globals.d.ts.
4. **Gates** — tsc 0 · vitest 341/341 · check-globals ✓ · check:i18n ✓ ·
   bundel `assets/app-b7b565b412.js` + assets/modals-shared.html di-rebuild.
   Belum deploy.

## Sesi 2026-09-03 — Izinkan nomor internasional untuk undangan grup (Buffy)

1. **Keputusan** — nomor eksplisit luar negeri (`+81 80-4204-5600`, `+65 …`)
   diterima di daftar Undangan Grup Kelas; gate 628… identitas kandidat
   (shared/wa-rules: login/daftar/SATRIA dedupe) TIDAK berubah.
2. **Parser** `shared/wa-list.ts` — prefiks '+' → digit apa adanya (tanpa
   konversi 0xx/8xx), validasi panjang 8-15 digit (E.164); `+62` eksplisit
   tetap masuk bentuk 628…; tanpa '+' tetap asumsi domestik (8180… polos
   tidak bisa dibedakan dari 0818…).
3. **Backend kirim** `actions-wa.ts` — helper `waKirim` menggantikan
   `normalizeWa` pada ketiga handler kirim: 0xx & 8xx-domestik pendek
   (≤11 digit) dinormalisasi 62…, nomor internasional 8-led panjang
   (mis. 818042045600 = +81 80…) TIDAK lagi di-62-kan (sebelumnya
   berubah jadi 62818042045600 → salah kirim).
4. **Tes** — wa-list (+81/+65 valid, +62 eksplisit, malformed invalid) &
   waKirim; 21 baris riil kini 21/21 valid (#15 → 818042045600).
   Gates: tsc 0 · vitest 336/336 · check-globals ✓ · bundel
   `assets/app-c1c263ef38.js`. Belum deploy.

## Sesi 2026-09-03 — Parsing daftar tempelan WhatsApp di Undangan Grup Kelas (Buffy)

1. **Laporan user** — paste hasil copy daftar anggota WA (nomor urut +
   nama + nomor berformat `+62 831-9187-1783` / `0857-1382-4104`) di modal
   Undangan Grup Kelas: parser lama hanya membaca baris berdigit kontigu di
   akhir (1/21 baris) dan menyisakan nomor urut di nama.
2. **Fix** — parser murni `parseDaftarOrtuRows` di `shared/wa-list.ts`
   (normalisasi/gate dari shared/wa-rules): nomor urut dibuang dari nama,
   separator WA diabaikan, format lama tetap jalan; kode negara eksplisit
   non-`+62` ditolak (bug laten: `+81 80-…` lolos gate 628 karena digit awal
   8 terlihat domestik). `parseDaftarOrtu` di candidates.ts jadi delegasi.
3. **Tes** — `shared/wa-list.test.ts`; 21 baris riil → 20 valid + 1 invalid
   (#15 nomor Jepang +81, di luar gate 628 oleh desain).
4. **Gates** — tsc 0 error · vitest 326/326 · check-globals nol kolisi ✓ ·
   bundel baru `assets/app-fca4c360a7.js`. Belum deploy.

## Sesi 2026-09-03 — Audit duplikasi helper & pemusatan (Buffy)

1. **Audit** — enumerasi semua deklarasi top-level (js/, netlify/functions/_lib/,
   shared/: 828 deklarasi) + diff body tiap nama yang muncul di 2+ file.
   35 nama duplikat; mayoritas = fork halaman (ai_form↔siswa_baru,
   apply_full↔master_full) yang body-nya identik TAPI terikat state modul
   masing-masing halaman → dilaporkan, tidak dipaksa gabung.
2. **Dipusatkan** (3 kelompok):
   - Parsing varian pesan `---`: `parseVarianPesan` (candidates.js, preview)
     ≡ `splitPesanVariants` (actions-wa.js, kirim) → `shared/wa-text.ts`;
     alias `parseVarianPesan` dipertahankan utk seam window.*;
     kontrak test `shared/wa-text.test.ts`.
   - `escapeHtml` fork ai_form/siswa_baru → `js/core/html.ts` (kanonikal
     null-safe; drift siswa_baru: 0/false ikut dikosongkan — dikoreksi).
   - `base64ToBlob` + `downscaleScanImage` (byte-identik, murni) →
     `js/core/file.ts` (+test).
3. **Tidak digabung (dengan alasan)** — replacer placeholder 08_wa_pintar
   (subset sengaja, token tak dikenal dibiarkan utk diedit user) vs server
   applyTemplatePlaceholders (superset — penggantian <<LINK>> kosong akan
   mengubah perilaku); sleepAcak client (jitter) vs tidur server (fixed);
   3 teks default pesan undangan (audiens beda); helper backend identik
   APPLY_WA_COLS/CAND_WA_COLS/findMasterByWa/handleShareData (lapisan
   terpisah — kandidat refactor lanjutan).
4. **Gates** — tsc 0 error, vitest 318/318, check-globals nol kolisi ✓,
   bundel baru `assets/app-e3ab3cbb74.js` + ai_form.js/siswa_baru.js
   di-compile ulang. Belum deploy.

## Sesi 2026-09-03 — Fix check-globals: kolisi withRetry (Buffy)

1. `withRetry` diduplikasi top-level di 4 modul ai_copilot (admin, interview,
   parse, results) → check-globals gagal (kolisi global exit 1) & berisiko
   di-rename esbuild.
2. Helper dipusatkan di `js/core/retry.ts` (import ESM) — deklarasi ganda
   dihapus dari 4 modul ai_copilot; kemudian juga dari 3 halaman standalone
   (ai_form/share/siswa_baru; call site curried share.ts diseragamkan ke
   semantik standar).
3. Unit test `js/core/retry.test.ts` (4 kasus). Hasil: check-globals nol
   kolisi ✓, tsc 0 error, vitest 307/307, bundel baru
   `assets/app-b5a46f5dea.js`.

## Sesi 2026-09-03 — Fix Kirim WA Massal "Cuma 1x Lalu Berhenti" (Buffy)

1. **Root cause** — `handleKirimTawaranMassal` (actions-wa.js) tidur `interval`
   detik ANTAR pesan DI DALAM satu invokasi fungsi Netlify; fungsi sinkron
   Netlify dibunuh platform ±10 dtk → hanya pesan pertama terkirim (regresi
   refactor 2026-08-09 yang memindahkan loop client → satu panggilan server).
2. **Fix backend** — handler baru `handleKirimSatuTawaran` (1 pesan = 1
   panggilan stateless, tanpa jeda/DB read; `templateIsi` dikirim frontend);
   parsing varian `---` dipusatkan `splitPesanVariants`; terdaftar di
   action-registry + FONNTE_ACTIONS + api-client (`kirimSatuTawaran`).
3. **Fix frontend** — helper `kirimBertahap` di `js/admin_ops/candidates.ts`
   (jeda acak anti-ban `interval`–`interval+50%` dijalankan browser, progres
   `(i/n)` di tombol, gagal 1 nomor tidak menghentikan sisanya); dipakai oleh
   `kirimUndanganKelas` (WA Pintar), `mulaiKirimUndanganGrup` (DB job), dan
   blast AI Matchmaking (`kirimTawaranMassal` di 12_esign_match.ts).
4. **Tes** — +unit test `splitPesanVariants` & komposisi per-nomor identik
   massal; tsc 0 error, 303/303 vitest pass, check:handlers ✅. Bundel baru
   `assets/app-b45b69041f.js` (admin/index/sw.js di-update).

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
