# DEBUG-TODO.md — Debug Checklist Lengkap Semua Kode ASJ Portal

> **Cara pakai:** Setiap sesi kerja, ambil 1-2 part dari daftar ini. Centang ✅
> yang sudah selesai. Kalau sesi terputus, lanjut dari part berikutnya.
> Update header sesi di bawah setiap kali mulai/mengakhiri sesi.

### Log Sesi

| Tgl        | Pengerja | Part dikerjakan                         | Hash commit |
| ---------- | -------- | --------------------------------------- | ----------- |
| 2026-08-20 | Buffy    | A1-A5 Core ESM + B1-B5 Frontend (10/10) | pending     |
| 2026-08-27 | AI Agent | Debug fix fetch limit 500 in ai/cv.ts   | pending     |

---

## A. CORE ESM (Foundation)### A1. `api-client.js` (389 baris) — API Bridge ✅ DIVERIFIKASI (2026-08-20)

- [x] Cek semua action di `CANDIDATE_ACTIONS` & `ADMIN_ACTIONS` ada di `action-registry.js` — 77/77 matched
- [x] Cek `NETLIFY_FUNCTIONS` mapping lengkap — semua action punya route
- [x] SWR cache: `CACHEABLE_READS` TTL 5 menit — benar
- [x] SWR invalidation: semua non-read action invalidate cache — benar
- [x] Session attachment: admin priority saat dual login — benar
- [x] `sessionInvalid` handling: toast + clear + reload — benar
- [x] `esc()` dan `escJs()`: tested via `xss-escape.test.js` — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-api-client-debug.md`### A2. `i18n.js` + `i18n/` — Terjemahan ✅ DIVERIFIKASI (2026-08-20)
- [x] `tr()` fallback ke key mentah — benar, tidak crash
- [x] `LANG.id` & `LANG.jp` 1160 keys, parity perfect 1:1
- [x] `trOption()` handle undefined/null + fuzzy matching (emoji, casing)
- [x] `bun run check:i18n` — 0 missing keys, 15 domain
- [x] **Audit detail**: `docs/evals/2026-08-20-i18n-debug.md`### A3. `js/core/bridge.js` (468 baris) — ESM→Legacy Bridge ✅ DIVERIFIKASI (2026-08-20)
- [x] `registerSeamAliases()`: collision guard + idempotent — benar
- [x] `dispatchSeamAction()`: registry + window fallback — benar
- [x] `checkInlineHandlers()`: lazy flush +3detik, preview-only — benar
- [x] `initSentry()`: tidak crash kalau DSN kosong — benar
- [x] `initWebVitals()`: tidak crash di environment tanpa Performance API — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-bridge-debug.md`### A4. `js/core/sentry.js` + `js/core/sentry-dummy.js` — Error Tracking ✅ DIVERIFIKASI (2026-08-20)
- [x] DSN real dari Sentry project `lpk-amanah-sakura-japan` — benar
- [x] Filter noise (ResizeObserver, empty rejection) — benar
- [x] User context (setSentryUser) — FIXED: tambah call di initApp() admin + kandidat
- [x] sentry-dummy.js — FIXED: dihapus (dead code, tidak di-import)
- [x] **Audit detail**: `docs/evals/2026-08-20-sentry-debug.md`### A5. `js/init/state.js` (310 baris) — Global State ✅ DIVERIFIKASI (2026-08-20)
- [x] 29 state vars + 36 bridgeState accessor — benar, tidak ada stale binding
- [x] `limitKan` awal = 50 — benar (updated dari 10)
- [x] `AUTO_REFRESH_TIMER` bisa di-cleanup — benar (sudah ada di nav.js)
- [x] `bun run check:globals` — 462 symbols, zero collisions
- [x] **Audit detail**: `docs/evals/2026-08-20-state-debug.md`

---

## B. FRONTEND — Core Pages

### B1. `js/engine/init.js` (518 baris) — Engine Utama ✅ RE-AUDITED (2026-08-20)

- [x] `refreshDataDinamis()`: retry 1x via `muatData(percobaan)` before error toast ✅
- [x] `initApp()`: admin priority wins over kandidat (lines 54-56) ✅
- [x] Auto-refresh 30s: `AUTO_REFRESH_TIMER` cleared on session invalid ✅
- [x] `visibilitychange`: guarded by `_visibilityChangeInit` flag ✅
- [x] Datalist `list-kode-job`: rendered once, duplicate removed (FIX 2026-08-20) ✅
- [x] Hash-based routing: guarded by `_hashChangeInit` flag ✅
- [x] Session check: token kosong → clear + reload with toast ✅### B2. `js/04_auth.js` (319 baris) — Authentication ✅ DIVERIFIKASI (2026-08-20)
- [x] `normalizeWaInput()` → shared/wa-rules.js → 628xxx format — benar
- [x] `isValidWaInput()` → regex `/^628\d{9,11}$/` — benar
- [x] Login flow: admin 3-step + kandidat WA+PIN — benar
- [x] Session storage: server-generated HMAC token — benar
- [x] Auto-login guard: clear + reload — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-auth-debug.md`

### B3. `js/init/nav.js` — Navigation & Logout ✅ DIVERIFIKASI (2026-08-20)

- [x] `logoutApp()`: AUTO_REFRESH_TIMER cleanup — benar
- [x] `logoutApp()`: 10 localStorage keys dihapus — benar
- [x] Mobile nav toggle: CSS class + requestAnimationFrame — benar
- [x] `changePage()`: page switch + re-render public — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-nav-debug.md`### B4. `js/init/theme.js` (291 baris) — Theme System ✅ DIVERIFIKASI (2026-08-20)
- [x] `getSavedTheme()`: fallback ke global key → default null → TOKYO — benar
- [x] `applyTheme()`: guard `if (!cfg) return` — benar
- [x] Per-user theme storage (admin/kandidat/guest) — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-theme-debug.md`
- [x] CSS class injection: all classes from hardcoded THEMES config, no user input ✅

### B5. `js/init/util.js` (298 baris) — Utilities ✅ DIVERIFIKASI (2026-08-20)

- [x] 19 functions exported + 19 registered via `registerSeamAliases` — benar
- [x] All DOM getters have null checks — benar
- [x] Dynamic innerHTML uses `esc()` — benar
- [x] All callers use `tr()` for toast messages — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-util-debug.md`

---

## C. FRONTEND — Admin Panel

### C1. `js/render/admin.js` (357 baris) — Admin Render ✅ DIVERIFIKASI (2026-08-20)

- [x] `adminSwitchTab()`: hash routing + `aria-current="page"` — benar
- [x] `renderAdminFull()`: calls 10+ renderers, all guarded — benar
- [x] XSS: all dynamic values use `esc()`/`escJs()` — benar
- [x] i18n: all UI text via `tr()`/`trOption()` — benar
- [x] `filterDbJob()`: O(n²) FIXED — pre-computed candidate count Map
- [x] **Audit detail**: `docs/evals/2026-08-20-admin-render-debug.md`

### C2. `js/render/candidate.js` (930 baris) — Kandidat Table ✅ DIVERIFIKASI (2026-08-20)

- [x] `filterKandidat()`: debounce 250ms + NULL guard — benar
- [x] `renderKandidatTable()`: `limitKan` = 50 awal, +25 increment — benar
- [x] `toggleViewKandidat()`: auto-switch simple mode ≤768px — benar
- [x] DRY: filter logic extracted to `matchesCandidateFilters()` — FIXED
- [x] `showMonthlyReport()`: hardcoded string FIXED → `tr('admin.report_empty')`
- [x] Column filter: debounced 250ms — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-candidate-render-debug.md`

### C3. `js/render/mail.js` (371 baris) — Mail Inbox ✅ DIVERIFIKASI (2026-08-20)

- [x] Duplicate `class` attribute on checkbox FIXED — merged `mail-check w-4 h-4 accent-rose-500 cursor-pointer`
- [x] Hardcoded Indonesian empty messages FIXED → `tr('admin.report_empty_mail')` + `tr('admin.report_empty_mail_status')`
- [x] `MAIL_BUCKET()` legacy status mapping — 12 variants covered correctly
- [x] `MAIL_SELECTED` accessor — bridge pattern, no stale binding
- [x] XSS: all dynamic values use `esc()`/`escJs()` — benar
- [x] i18n: all UI text via `tr()` — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-mail-render-debug.md`

### C4. `js/admin_ops/candidates.js` (368 baris) — Admin Candidates ✅ DIVERIFIKASI (2026-08-20)

- [x] Missing DOM null checks FIXED — all getElementById guarded
- [x] Hardcoded 'Gagal' button FIXED → `tr('ui.btn_gagal')`
- [x] Hardcoded confirm() FIXED → `tr('ui.confirm_remove_cand_from_job')`
- [x] `parseDaftarOrtu()`: WA validation via normalizeWaInput + isValidWaInput — benar
- [x] `kirimUndanganKelas()`: batch via `kirimTawaranMassal` — benar
- [x] XSS: all dynamic values use `esc()`/`escJs()` — benar
- [x] i18n: all UI text via `tr()` — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-admin-candidates-debug.md`

### C5. `js/admin_ops/drive.js` — Drive Migration ✅ DIHAPUS (2026-08-20)

- [x] Feature removed — one-time migration tool tidak dipakai lagi
- [x] `js/admin_ops/drive.js` deleted (245 baris)
- [x] `netlify/functions/_lib/actions-drive.js` deleted (~100 baris)
- [x] `handleRunMigration` dipindah ke `actions-config.js` (generic DB migration)
- [x] Banner HTML removed dari admin.html + index.html
- [x] Modal removed dari partials/modals-shared.html
- [x] 6 i18n keys removed (drive_migrate, drive_migrate_desc, drive_missing_hint, zero_drive_cands, no_drive_links, migrate_now)
- [x] 181/181 tests pass

### C6. `js/admin_ops/schedule.js` — Schedule Management ✅ DIVERIFIKASI (2026-08-20)

- [x] `getStatusWaktu()`: 6 status badges rendered correctly
- [x] `renderDashboardAgenda()`: DOM null check + XSS-safe + i18n
- [x] `renderJadwal()`: DOM null check + XSS-safe + limit pagination
- [x] No callAPI calls (render-only file)
- [x] **Audit detail**: `docs/evals/2026-08-20-schedule-debug.md`

### C7. `js/admin_ops/sysconfig.js` — System Config ✅ DIVERIFIKASI (2026-08-20)

- [x] Missing null check FIXED → `tambahConfigItem()` input guard
- [x] `renderSysConfig()`: DOM null check + XSS-safe
- [x] `simpanConfigKeServer()`: admin session via `currentAdminName`
- [x] `hapusConfigItem()`: confirm() via `tr()`
- [x] Duplicate check via `trOptionId()` — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-sysconfig-debug.md`

### C8. `js/admin_ops/loading.js` — Loading States ✅ DIVERIFIKASI (2026-08-20)

- [x] `setSkeletonLoading()`: DOM null check + random width variation
- [x] `jalankanSemuaSkeleton()`: all 6 DOM refs guarded
- [x] No callAPI, no tr() — pure DOM skeleton renderer
- [x] **Audit detail**: `docs/evals/2026-08-20-loading-debug.md`

### C9. `js/admin_modal/cv.js` (671 baris) — CV Preview Modal ✅ DIVERIFIKASI (2026-08-20)

- [x] `bukaDigitalCV()`: data loading + render complete
- [x] All 60 DOM refs null-guarded
- [x] All innerHTML XSS-safe with esc()/escJs()
- [x] 20 tr() calls — well i18n'd
- [x] **Audit detail**: `docs/evals/2026-08-20-cv-modal-debug.md`

### C10. `js/admin_modal/dbfilter.js` — DB Filter Modal ✅ DIVERIFIKASI (2026-08-20)

- [x] Filter setters: DOM null checks present
- [x] `renderDbFilters()`: XSS-safe with esc()
- [x] No callAPI (render-only)
- [x] **Audit detail**: `docs/evals/2026-08-20-dbfilter-debug.md`

### C11. `js/admin_modal/job.js` — Job Modal ✅ DIVERIFIKASI (2026-08-20)

- [x] `lamarJob()`: simple helper, no DOM
- [x] `copyInfoLoker()`: clipboard copy
- [x] No callAPI, no DOM refs — minimal file
- [x] **Audit detail**: `docs/evals/2026-08-20-job-modal-debug.md`

- [x] Create/Edit job: mapped via `mapJob()` in db/jobs.js (25+ columns) ✅
- [x] Status change: via `aksiAdmin()` in admin_ops.js ✅

---

## D. FRONTEND — Candidate Features

### D1. `js/03_candidate.js` (801 baris) — Candidate Core ✅ DIVERIFIKASI (2026-08-20)

- [x] Upload flow: sequential retry 3x + skip failed file (continue) — benar
- [x] `bukaMasterEksternal()`: VIP guard via `isVipCatatan()` — benar
- [x] Hardcoded 'Upload Berkas Tahap 1/2' FIXED → `tr('ui.upload_berkas_tahap_1/2')`
- [x] `isVipCatatan()`: regex `[VIP]` + `[KELAS ...]` — benar
- [x] Gender canonical: `LAKI-LAKI`/`PEREMPUAN` per AGENTS.md §6 — benar
- [x] XSS: all innerHTML uses esc()/escJs() — benar
- [x] **Audit detail**: `docs/evals/2026-08-20-candidate-core-debug.md`

### D2. `js/08_wa_pintar.js` (517 baris) — WA Pintar ✅ DIVERIFIKASI (2026-08-20)

- [x] XSS in renderWaTemplates FIXED — `t.nama`/`t.isi` now use `esc()`
- [x] Hardcoded button labels FIXED → `tr('ui.template_send/edit/delete')`
- [x] Hardcoded empty state FIXED → `tr('ui.template_empty')`
- [x] Hardcoded form title FIXED → `tr('ui.template_edit_title')`
- [x] Hardcoded action button FIXED → `tr('ui.wa_open_send')`
- [x] **Audit detail**: `docs/evals/2026-08-20-wa-pintar-debug.md`

### D3. `js/10_cv_rirekisho.js` — CV Rirekisho Builder ✅ DIVERIFIKASI (2026-08-20)

- [x] 5 exports, all verified
- [x] Error handling: backend error shown to user
- [x] Photo URL: uses master data (not stale candidate data)
- [x] **Audit detail**: `docs/evals/2026-08-20-rirekisho-debug.md`

### D4. `js/10b_cv_builders.js` (496 baris) — CV Builders ✅ DIVERIFIKASI (2026-08-20)

- [x] Pure HTML builder (0 callAPI, 0 DOM, 0 tr())
- [x] 5 builder functions: edu/job/fam/identitas/kertasA4
- [x] Gender canonical per AGENTS.md §6
- [x] **Audit detail**: `docs/evals/2026-08-20-cv-builders-debug.md`

### D5. `js/12_esign_match.js` (583 baris) — E-Sign & Naitei ✅ DIVERIFIKASI (2026-08-20)

- [x] Tahapan gate regex per AGENTS.md §6 — 20+ statuses covered
- [x] `renderStudentCard()`: VIP/KELAS guard per AGENTS.md §6
- [x] Hardcoded canvas hint FIXED → `tr('ui.draw_hint')`
- [x] **Audit detail**: `docs/evals/2026-08-20-esign-debug.md`

### D6. `js/13_rincian_builder.js` (516 baris) — Rincian Biaya Builder ✅ DIVERIFIKASI (2026-08-20)

- [x] 7 callAPI calls (preset CRUD + save)
- [x] 17 tr() calls — well i18n'd
- [x] Previous fix: favorite save/remove FAILED → tr() (commit a6efd79)
- [x] Preset tahapan: domain data, not UI text
- [x] **Audit detail**: `docs/evals/2026-08-20-rincian-debug.md` (N/A — clean)

### D7. `js/cloudinary.js` — Cloudinary Upload ✅ DIVERIFIKASI (2026-08-20)

- [x] 104 lines, 0 callAPI/DOM — pure upload helper
- [x] Timeout 30s + retry 3x + AbortController — benar
- [x] 4xx fatal, 5xx retry — benar

### D8. `js/apply-docs.js` — Apply Documents ✅ DIVERIFIKASI (2026-08-20)

- [x] 57 lines, 0 callAPI/DOM — pure checklist helper
- [x] Document types cover all berkas

### D9. `js/fcm-client.js` — FCM Push Notifications ✅ DIVERIFIKASI (2026-08-20)

- [x] 107 lines, 2 DOM refs — FCM token registration
- [x] Notification permission handled gracefully

### D10. `js/upload-guard.js` — Upload Guard ✅ DIVERIFIKASI (2026-08-20)

- [x] 105 lines, 0 callAPI/DOM — pure validation helper
- [x] MAX_FILE_BYTES + ALLOWED_FILE_EXT — benar

### D11. PWA FCM Badge & Ikon Status ASJ

- [ ] Background: push menampilkan notifikasi dengan emblem ASJ monokrom di status bar.
- [ ] Badge: perangkat PWA yang ditutup menerima badge lokal; launcher dapat memilih titik atau angka.
- [ ] Multi-device: membuka portal di desktop tidak menghapus badge di HP.
- [ ] Clear: membuka portal pada HP menghapus badge HP saja.
- [ ] Fallback: tanpa Badging API, notifikasi tetap tampil.

---

## E. FRONTEND — AI Features

### E1. `js/ai_copilot/admin.js` — AI Copilot Admin ✅ DIVERIFIKASI (2026-08-20)

- [x] 244 lines, admin AI chat with context loading
- [x] 27 DOM refs, all guarded
- [x] Chat responses: conversational, acceptable as-is

### E2. `js/ai_copilot/interview.js` — Interview Simulator ✅ DIVERIFIKASI (2026-08-20)

- [x] 291 lines, VIP guard via `isVipCatatan()`
- [x] 4 callAPI calls, all guarded
- [x] AI response parsing with fallback

### E3. `js/ai_copilot/parse.js` — AI Response Parser ✅ DIVERIFIKASI (2026-08-20)

- [x] 150 lines, JSON parsing with loose fallback
- [x] Handles malformed AI responses gracefully

### E4. `js/ai_copilot/results.js` — AI Results Display ✅ DIVERIFIKASI (2026-08-20)

- [x] 214 lines, render + save results
- [x] Error handling with user-facing messages

---

## F. FRONTEND — Public Pages

### F1. `js/01_public.js` (622 baris) — Public Dashboard ✅ RE-AUDITED (2026-08-20)

- [x] `switchPublicTab()`: DOM elements exist in HTML
- [x] `renderRincianSections()`: local esc() helper — XSS-safe
- [x] `bukaDetailLoker()`: all dynamic values use window.esc()/window.escJs()
- [x] i18n: all labels via window.tr()

### F2. `js/render/public.js` (308 baris) — Public Render ✅ RE-AUDITED (2026-08-20)

- [x] `renderPublicFiltered()`: XSS-safe — window.esc() on code/pekerjaan
- [x] `renderPublicFilterUI()`: DOM null checks on all btns
- [x] i18n: all labels via tr()

### F3. `js/render/share.js` — Share View ✅ RE-AUDITED (2026-08-20)

- [x] `bukaModalShare()`: DOM null checks
- [x] `templateShareWa()`: no innerHTML — plain text
- [x] i18n: tr() via bridge import

### F4. `js/pages/share.js` (581 baris) — Share Page ✅ RE-AUDITED (2026-08-20)

- [x] XSS FIXED: safeName now escapes backslash + single quote + double quote
- [x] `renderGrid()`: uses escapeHtml() for onclick attributes
- [x] Local SHARE_LANG fallback (not dependent on main i18n.js)

### F5. `js/pages/ai_form.js` (1220 baris) — AI Form Page ✅ RE-AUDITED (2026-08-20)

- [x] Hardcoded alert() FIXED → showToast() + tr() keys (8 new i18n keys)
- [x] `appendHTML()`: XSS-safe — escapeHtml() + template literal escaping
- [x] `sendMessage()`: DOM null checks on inputEl/btnEl
- [x] `saveToDatabase()`: ext validation with proper error messages
- [x] **BUG 2026-09-02 — "klik SIMPAN DB tidak muncul apa-apa"** (laporan siswa)
  - Root cause: `#toast-container` hanya ada di `index.html` & `admin.html`.
    `showToast()` (js/init/util.ts) `return` diam-diam kalau wadahnya tidak ada
    → SEMUA pesan (sukses/gagal/peringatan) hilang di halaman standalone
    (ai_form, apply-full, master-full, share, siswa-baru).
  - Fix 1 `js/init/util.ts`: `showToast()` sekarang membuat wadahnya sendiri
    (`ensureToastContainer()`) kalau belum ada di DOM.
  - Fix 2 `partials/scripts-shared.html`: wadah toast disuntik ke semua halaman
    standalone saat `bun run build:html`.
  - Fix 3 `js/pages/ai_form.ts`: guard `nama_lengkap` kosong → toast tipe
    `error` (bukan `info`), field nama ditandai merah + difokuskan, dan ada
    jejak `console.warn`; fallback baca nama dari DOM `#f_nama` kalau state
    kosong; `console.error` di semua jalur gagal.
  - Fix 4 `netlify/functions/_lib/ai/cv.ts`: `writeAiSubmission()` — tulis
    `ai_form_submissions` ulang sekali tanpa kolom opsional
    (`submitted_by`, `ai_updated_at`) kalau PostgREST menolak (HTTP 400 kolom
    tidak dikenal); pesan error asli Supabase kini ikut dikembalikan.
  - Fix 5 `netlify/functions/_lib/ai/cv.ts` (revisi setelah diagnostik DB):
    kolom opsional kini diingat di modul (`aiSubColEnabled`) — begitu PostgREST
    menolak dengan PGRST204, kolom itu dilewati untuk seterusnya (tidak ada
    percobaan gagal berulang tiap siswa menekan SIMPAN DB).
  - Migration: `migrations/20260902_add_ai_form_submission_cols.sql`
  - **TERKONFIRMASI 2026-09-02 via information_schema** (tabel
    `ai_form_submissions` produksi): `submitted_by` **TIDAK ADA** → setiap
    INSERT/PATCH ditolak HTTP 400 PGRST204 → simpan gagal TOTAL untuk semua
    kandidat. `ai_updated_at` **sudah ada** (timestamptz). `ai_data_json`
    jsonb (kode kirim JSON.stringify = konvensi yang sama dengan
    `master_database_candidate`, dibaca dengan JSON.parse → tidak diubah).
  - [ ] TODO: jalankan migration di Supabase SQL Editor, lalu
        `bun install && bun run build`, deploy, dan tes SIMPAN DB di HP kandidat.
  - [ ] TODO: pastikan tidak ada kolom lain di `ai_form_submissions` /
        `master_database_candidate` yang dipakai kode tapi belum ada di DB
        (pola yang sama dengan MASTER_COLUMN_MISSING di actions-master.ts).

### F6. `js/pages/master_full.js` (803 baris) — Master Form ✅ RE-AUDITED (2026-08-20)

- [x] Hardcoded "File Tersimpan" FIXED → `tr('form.mf_file_saved')` + extracted variable
- [x] Missing DOM null checks FIXED — wa-display/wa/nama IIFE guarded
- [x] `submitMaster()`: all field reads use `valSafe()` (null-safe) ✅
- [x] `changeStep()`: alert() in catch — acceptable error boundary

### F7. `js/pages/share.js` (581 baris) — Share Page ✅ RE-AUDITED (2026-08-20)

- [x] XSS FIXED in Sesi 21: safeName escapes \, ', "
- [x] `renderGrid()`: uses `escapeHtml()` for onclick ✅
- [x] Local SHARE_LANG fallback ✅

### F8. `js/pages/siswa_baru.js` (503 baris) — Siswa Baru Page ✅ RE-AUDITED (2026-08-20)

- [x] XSS FIXED: `hasil.name` in `handleDocUpload()` now uses `escapeHtml()`
- [x] Hardcoded alert() FIXED → `showToast()` + `tr()` keys (18 new i18n keys)
- [x] Hardcoded button labels FIXED → `tr()` keys (MENGIRIM/BERHASIL/SUBMIT DATA)
- [x] Missing null check FIXED — `$('aiTypingStatus')` guarded
- [x] Welcome message FIXED → `tr('form.siswa_welcome')`

---

## G. BACKEND — Core

### G1. `handlers.js` — Dispatcher Pusat ✅ RE-AUDITED (2026-08-20)

- [x] `dispatchAction()`: error boundary FIXED — try/catch wrapping handler
- [x] `handleAction()`: rate limit check + lockout — verified correct
- [x] `ping` action: early return SEBELUM rate limit — correct
- [x] Login lockout: `rateLimit.fail()` dipanggil saat gagal — correct

### G2. `action-registry.js` — Action Registry ✅ RE-AUDITED (2026-08-20)

- [x] Table-based dispatch (bukan switch) — clean pattern
- [x] `LOGIN_ACTIONS`, `AI_ACTIONS`, `FONNTE_ACTIONS` — all 3 Sets verified
- [x] 77 actions registered — all match frontend callAPI calls

### G3. `session.js` — HMAC Session ✅ RE-AUDITED (2026-08-20)

- [x] HMAC-SHA256 + timingSafeEqual — secure
- [x] `verifyToken()`: returns null for invalid tokens — correct
- [x] Fallback secret appropriate for dev only

### G4. `rate-limit.js` — Rate Limiter ✅ RE-AUDITED (2026-08-20)

- [x] In-memory buckets with pruning (MAX_BUCKETS = 20000)
- [x] `check()`: returns `{ ok, retryAfter, locked }` — correct
- [x] `fail()`: lockout counter + lockoutMs — correct

### G5. `cache.js` — TTL Cache ✅ RE-AUDITED (2026-08-20)

- [x] In-memory Map with TTL, eviction (MAX_ENTRIES = 50)
- [x] `cacheGet()` / `cacheSet()` / `cacheClear()` — all clean

### G6. `env.js` — Environment Variables ✅ RE-AUDITED (2026-08-20)

- [x] Whitelist-based — only approved keys read
- [x] Lazy file load + alias normalization — clean
- [x] Secret never leaked in response — correct

---

## H. BACKEND — Domain Actions

### H1. `actions-public.js` (531 baris) — Public Data ✅ RE-AUDITED (2026-08-20)

- [x] `requireAdmin` NOT IMPORTED FIXED — added import from actions-auth.js
- [x] `handleGetAppData()`: parallel queries verified correct
- [x] `loadCandidatesUnik()`: dedupe + cache + fallback — verified
- [x] `loadPublicBase()`: 20s TTL cache — verified

### H2. `actions-auth.js` (386 baris) — Authentication ✅ RE-AUDITED (2026-08-20)

- [x] `handleLoginKandidat()`: bcrypt compare + fallback — correct
- [x] `handleDaftarKandidat()`: WA normalized + duplicate check — correct
- [x] `handleCheckAdminMaster()`: PIN comparison via env — correct
- [x] `registerFcmToken()`: upsert with on_conflict — correct

### H3. `actions-job.js` — Job Management ✅ RE-AUDITED (2026-08-20)

- [x] `requireRole` imported ✅
- [x] All handlers use `requireRole(sessionToken, 'admin')` guard

### H4. `actions-candidate.js` — Candidate Management ✅ RE-AUDITED (2026-08-20)

- [x] `requireAdmin` imported ✅
- [x] `handleGetCandidatesPage()`: pagination + parallel fetch — correct
- [x] `cacheClear()` on mutations — correct

### H5. `actions-mail.js` (396 baris) — Mail Inbox ✅ RE-AUDITED (2026-08-20)

- [x] `requireAdmin` imported ✅
- [x] `handleApproveForm()` → `syncCandidateDariForm()` — creates/updates candidate on LULUS
- [x] `handleRejectForm()` → `syncCandidateDariForm()` — sets GAGAL + detaches job
- [x] `handleDeleteForm()`: requireAdmin + findFormByIndexFiltered + DELETE ✅

### H6. `actions-upload.js` (826 baris) — Upload & Files

- [x] `handleSubmitApply()`: validates wa/code/nama + dokumen_share check + INSERT ✅
- [x] `handleSimpanBerkasTahapan()`: session verify + WA ownership + Cloudinary/base64 + mail sync ✅
- [x] `handleGetUploadUrls()`: signed URL via storageRequest + anti-duplicate cleanup ✅

### H7. `actions-master.js` (1161 baris) — Master Data ✅ RE-AUDITED (2026-08-20)

- [x] `requireRole` imported ✅
- [x] `handleSubmitMasterForm()`: column mapping complete
- [x] `handleSimpanUpdateMaster()`: partial update with mail sync

### H8. `actions-schedule.js` (180 baris) — Schedule & Tasks ✅ RE-AUDITED (2026-08-20)

- [x] `requireRole` imported ✅
- [x] All CRUD operations guarded by admin role

### H9. `actions-wa.js` (197 baris) — WhatsApp (Fonnte) ✅ RE-AUDITED (2026-08-20)

- [x] `requireRole` imported ✅
- [x] Template CRUD + Fonnte send verified

### H10. `actions-config.js` (148 baris) — System Config ✅ RE-AUDITED (2026-08-20)

- [x] `requireRole` imported ✅
- [x] sys_config update + rincian presets clean

### H11. `actions-register.js` (158 baris) — Siswa Baru ✅ RE-AUDITED (2026-08-20)

- [x] Public endpoints (no auth needed) ✅
- [x] `cacheClear()` on registration ✅

### H12. `actions-share.js` (232 baris) — Share View ✅ RE-AUDITED (2026-08-20)

- [x] Public share view (no auth needed) ✅
- [x] Storage folder listing + doc type mapping

### H13. `actions-drive.js` — DIHAPUS (Sesi 16)

- [x] Feature removed, code deleted

### H14. `actions-diagnostics.js` (126 baris) — Diagnostics ✅ RE-AUDITED (2026-08-20)

- [x] `requireAdmin` imported ✅
- [x] Returns sensitive DB info — admin-only, correct

---

## I. BACKEND — AI

### I1. `ai/chat.js` (601 baris) — AI Chat ✅ RE-AUDITED (2026-08-20)

- [x] `handleProcessAIChat()`: VIP guard server-side — fail-open on lookup error ✅
- [x] `handleProcessAdminAIChat()`: requireRole admin ✅
- [x] `handleProcessAiInterview()`: requireRole kandidat ✅
- [x] Interview model per bidang SSW — 7 bidang + default ✅
- [x] **FIXED**: 4 error handlers leaked `e.message` → replaced with generic messages ✅
- [x] **FIXED**: `handleGetHasilWawancara` error now generic ✅
- [x] Detailed audit: `docs/evals/2026-08-20-i-backend-ai-reaudit.md`

### I2. `ai/classify.js` (155 baris) — Document Classification ✅ RE-AUDITED (2026-08-20)

- [x] `requireRole` admin guard ✅
- [x] 8MB file limit + strict MIME allowlist ✅
- [x] parseJsonLoose handles malformed AI responses ✅

### I3. `ai/cv.js` (397 baris) — AI CV Builder ✅ RE-AUDITED (2026-08-20)

- [x] requireRole on admin endpoints ✅
- [x] buildRingkasData for AI context injection ✅
- [x] submitDataAsj persistence with mail sync ✅
- [x] **FIXED**: 3 error handlers leaked `e.message` → replaced with generic messages ✅

### I4. `ai/providers.js` (136 baris) — AI Providers ✅ RE-AUDITED (2026-08-20)

- [x] Gemini model fallback chain (3 models, 7s timeout) ✅
- [x] parseJsonLoose defensive (markdown fences + JSON extraction) ✅
- [x] Error messages user-friendly, server errors logged ✅

---

## J. BACKEND — Database

### J1. `db/client.js` — Supabase Client ✅ RE-AUDITED (2026-08-20)

- [x] `supabaseJson()`: REST API call benar + error text truncated 200 chars ✅
- [x] `normalizeWa()`: from `shared/wa-rules.js` (single source of truth) ✅
- [x] `normalizeGender()`: kanonikal `LAKI-LAKI`/`PEREMPUAN` per AGENTS.md §6 ✅
- [x] `supabasePaged()`: correct Range header + Content-Range parsing ✅

### J2. `db/candidates.js` — Candidate Queries ✅ RE-AUDITED (2026-08-20)

- [x] `mapCandidate()`: 25+ column mapping with aliases ✅
- [x] `findAllCandidatesLight()`: pagination without 300-row limit ✅
- [x] `findCandidateByWaFiltered()`: parallel probing of 3 WA columns ✅
- [x] `maxCandidateIdNumber()`: checks BOTH tables (critical fix 2026-08-16) ✅

### J3. `db/forms.js` — Form/Application Queries ✅ RE-AUDITED (2026-08-20)

- [x] `findForms()`: timestamp.desc ordering ✅
- [x] `findFormsByWa()`: or= with no_wa fallback ✅
- [x] `upsertFormRow()`: handles 42P10 constraint-not-found ✅

### J4. `db/jobs.js` — Job Queries ✅ RE-AUDITED (2026-08-20)

- [x] `findJobs()`: tries 9 table name variants ✅
- [x] `mapJob()`: preserves raw status for frontend ✅

### J5. `db/berkas.js` — Berkas/Upload Queries ✅ RE-AUDITED (2026-08-20)

- [x] `attachBerkasBio()`: parallel fetch + Map O(1) lookup ✅
- [x] BERKAS_COLUMNS: 18 doc types with multi-column fallback ✅

### J6. `db/master.js` — Master Data Queries ✅ RE-AUDITED (2026-08-20)

- [x] `fetchMasterLightByWa()`: 16-column projection (vs 154 full) ✅

### J7. `db/misc.js` — Assets & Settings ✅ RE-AUDITED (2026-08-20)

- [x] `findAssets()`: comprehensive nested object extraction ✅
- [x] `queryPaged()`: correct Range implementation ✅

### J8. `candidate-helpers.js` — Candidate Helpers ✅ RE-AUDITED (2026-08-20)

- [x] `nextCandidateId()`: checks both tables (critical fix 2026-08-16) ✅
- [x] `findCandidateByWa()`: fast path + scan fallback ✅

---

## K. BUILD & SCRIPTS

### K1. `scripts/build-js.mjs` — JS Bundler ✅ RE-AUDITED (2026-08-20)

- [x] IIFE bundler via esbuild, 2-pass (code+hash → write+sourcemap) ✅
- [x] Content hash + old bundle cleanup + SW shell update ✅
- [x] Idempotent, cleans Vite stubs ✅

### K2. `scripts/build-html.mjs` — HTML Builder ✅ RE-AUDITED (2026-08-20)

- [x] Modal partial copy + inline removal + loader runtime ✅
- [x] Region regeneration from partials ✅

### K3. `scripts/build-css.mjs` — CSS Builder (Tailwind) ✅ RE-AUDITED (2026-08-20)

- [x] Standard Tailwind CLI wrapper ✅

### K4. `scripts/check-handlers.mjs` — Handler Checker ✅ RE-AUDITED (2026-08-20)

- [x] Scans all HTML+JS for on* handlers + data-action ✅
- [x] Self-checks EVENT_NAMES coverage ✅
- [x] Masks strings to avoid false positives ✅

### K5. `scripts/check-globals.mjs` — Global Pollution Checker ✅ RE-AUDITED (2026-08-20)

- [x] Global audit tool ✅

### K6. `scripts/check-i18n.mjs` — i18n Checker ✅ RE-AUDITED (2026-08-20)

- [x] Verifies LANG.id and LANG.jp parity ✅

### K7. `scripts/dedupe-duplicates.mjs` — Dedupe Tool ✅ RE-AUDITED (2026-08-20)

- [x] Backup-first mutation, fuzzy merge (edit distance ≤ 2) ✅

### K8. `scripts/generate-api-docs.mjs` — API Docs Generator ✅ RE-AUDITED (2026-08-20)

- [x] Parses action-registry, generates docs ✅

---

## L. TESTS

### L1. Unit Tests (Vitest) ✅ VERIFIED (2026-08-20)

- [x] 181/181 tests pass — 20 test files, 3.4s duration ✅
- [x] All test files: ping, bridge, cv, xss-escape, i18n, mail, registry, auth, mail-action, master, wa, chat, providers, client, handlers, rate-limit, session, storage, dedupe-rules ✅

### L2. E2E Tests (Playwright) ✅ VERIFIED (2026-08-20)

- [x] 5 E2E test files: login-check, upload-check, biodata-check, check-share, share-view ✅
- [x] All require BASE_URL env (preview must be running) — tested in earlier sessions ✅

---

## M. STANDALONE PAGES (HTML + Inline JS)

### M1. `index.html` — Landing Page ✅ VERIFIED (2026-08-20)

- [x] Script loading: single bundle tag (build-js.mjs handles) ✅
- [x] Mobile nav: responsive (init.js handles) ✅
- [x] Footer links: WhatsApp, Instagram, TikTok, Maps ✅

### M2. `admin.html` — Admin Dashboard ✅ VERIFIED (2026-08-20)

- [x] Sidebar nav: 8 tabs + settings ✅
- [x] Modals: loaded via runtime loader from assets/modals-shared.html ✅
- [x] Script: single bundle tag ✅

### M3. `apply-full.html` — Apply Page ✅ VERIFIED (2026-08-20)

- [x] Form validation: via JS (apply.js) ✅
- [x] Job selection: datalist populated from API ✅

### M4. `master-full.html` — Master Form ✅ VERIFIED (2026-08-20)

- [x] Multi-step form: via JS (master_full.js) ✅
- [x] File upload: via Cloudinary ✅

### M5. `ai_form.html` — AI Form ✅ VERIFIED (2026-08-20)

- [x] Chat interface: via JS (ai_form.js) ✅
- [x] VIP guard: server-side in chat.js ✅

### M6. `share.html` — Share View ✅ VERIFIED (2026-08-20)

- [x] Public access: no session required ✅
- [x] Document preview: via Cloudinary URLs ✅

### M7. `siswa-baru.html` — Siswa Baru ✅ VERIFIED (2026-08-20)

- [x] Registration form: via JS (siswa_baru.js) ✅
- [x] Photo upload: via Cloudinary ✅

---

## Summary Counter

| Domain | Total Parts | Status |
| --------------------- | ------------ | ----------- || A. Core ESM | 5 parts | ✅ 5/5 |
| B. Frontend Core | 5 parts | ✅ 5/5 |
| C. Admin Panel | 11 parts | ✅ 11/11 |
| D. Candidate Features | 10 parts | ✅ 10/10 |
| E. AI Features | 4 parts | ✅ 4/4 |
| F. Public Pages | 8 parts | ✅ 8/8 |
| G. Backend Core | 6 parts | ✅ 6/6 |
| H. Backend Actions | 14 parts | ✅ 14/14 |
| I. Backend AI | 4 parts | ✅ 4/4 |
| J. Backend DB | 8 parts | ✅ 8/8 |
| K. Build & Scripts | 8 parts | ✅ 8/8 |
| L. Tests | 2 parts | ✅ 2/2 |
| M. HTML Pages | 7 parts | ✅ 7/7 |
| **TOTAL** | **92 parts** | **✅ 92/92** |

---

## Recommended Session Order

### Sesi 1-2: Foundation (A + G)

Mulai dari core: API client, session, rate-limit, handlers. Ini fondasi semua.

### Sesi 3-4: Auth & Security (B2 + B3 + H2)

Authentication flow, session management, WA normalization.

### Sesi 5-7: Admin Panel (C1-C11)

Admin dashboard, candidate table, mail inbox, modals.

### Sesi 8-10: Candidate Features (D1-D10)

Upload flow, WA Pintar, CV builder, E-Sign, Cloudinary.

### Sesi 11-12: AI Features (E1-E4 + I1-I4)

AI chat, interview simulator, CV builder.

### Sesi 13-14: Public Pages (F1-F8)

Landing page, apply form, share view, siswa baru.

### Sesi 15-16: Database Layer (J1-J8)

All DB queries, mapping, dedupe.

### Sesi 17: Build & Scripts (K1-K8)

Build pipeline, checkers, dedupe tool.

### Sesi 18: Tests (L1-L2)

Run all unit tests + E2E tests.

### Sesi 19: HTML Pages (M1-M7)

All HTML pages, script loading, responsive.

### Sesi 20: Final Verification

Full build, full test, full E2E, deploy check.

### D11. PWA FCM Badge & Ikon Status ASJ

- [ ] Background: push menampilkan notifikasi dengan emblem ASJ monokrom di status bar.
- [ ] Badge: perangkat PWA yang ditutup menerima badge lokal; launcher dapat memilih titik atau angka.
- [ ] Multi-device: membuka portal di desktop tidak menghapus badge di HP.
- [ ] Clear: membuka portal pada HP menghapus badge HP saja.
- [ ] Fallback: tanpa Badging API, notifikasi tetap tampil.
