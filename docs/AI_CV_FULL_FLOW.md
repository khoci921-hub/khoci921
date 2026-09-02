# AI CV Full Flow — Dari Kandidat Chat Sampai Admin Review

> Dokumentasi lengkap alur data AI CV, termasuk upload dokumen, notifikasi, dan storage.

---

## Overview

```
KANDIDAT (ai_form.html)
    ↓ chat dengan AI
    ↓ AI return data
    ↓ form auto-fill
    ↓ upload dokumen (Cloudinary)
    ↓ klik "SIMPAN DB"
    ↓
BACKEND (handleSubmitDataAsj)
    ├→ ai_form_submissions (status: MENUNGGU)
    ├→ master_database_candidate (ai_data_json + doc URLs)
    ├→ database_candidate (sync pas_photo/jft/ssw/ktp)
    ├→ syncBiodataKeMail → database_asj_form.feedback_berkas
    └→ notifyAdmins → FCM push ke admin
    ↓
ADMIN (admin.html / mail)
    ↓ lihat kandidat di mail (status: MENUNGGU atau UPDATE)
    ↓ klik review → buka ai_form.html
    ↓ approve/reject
```

---

## 1. Kandidat Chat dengan AI (Frontend)

### Flow
1. Kandidat buka `ai_form.html?flow=ai&wa=628xxx&nama=Agus`
2. Smart welcome message muncul (cek 17 field yang kosong)
3. Kandidat ketik pesan → AI return JSON `{reply, data}`
4. Data di-merge ke form via `o = L(o, i.data)`
5. Form auto-fill dari `latestCandidateData` (localStorage)

### Auto-Translate
- Setelah AI return data, `autoTranslateMissingJp(p.currentData)` jalan
- Cek 24 ID→JP pairs (termasuk array fields)
- Jika `_id` ada tapi `_jp` kosong → Gemini translate
- Translated JP fields di-merge kembali ke response

### Storage
- `chatHistory` → localStorage (max 20 messages)
- `latestCandidateData` → localStorage
- `currentPhotoBase64` → localStorage (compressed 600px)

---

## 2. Upload Dokumen

### Flow
1. Kandidat pilih file (pas_photo, JFT, SSW, KTP, KK, ijazah, dll)
2. Frontend compress image (800px, JPEG 0.8)
3. `Le()` upload ke **Cloudinary** via `uploadToCloudinary()`
4. Cloudinary return URL
5. URL disimpan di `o.uploads.{key}`

### Storage Locations

| Dokumen | Cloudinary Path | DB Column |
|---------|----------------|-----------|
| Pas Photo | `cv-docs/{nama}_PAS_PHOTO.jpg` | `master_database_candidate.pas_photo` |
| JFT (Sertifikat) | `cv-docs/{nama}_JFT.jpg` | `master_database_candidate.jft_url` |
| SSW (Lisensi) | `cv-docs/{nama}_SSW.jpg` | `master_database_candidate.ssw_url` |
| KTP | `cv-docs/{nama}_KTP.pdf` | `master_database_candidate.ktp_url` |
| KK | `cv-docs/{nama}_KK.pdf` | `master_database_candidate.kk_url` |
| Ijazah SD | `cv-docs/{nama}_IJAZAH_SD.pdf` | `master_database_candidate.ijazah_sd_url` |
| Ijazah SMP | `cv-docs/{nama}_IJAZAH_SMP.pdf` | `master_database_candidate.ijazah_smp_url` |
| Ijazah SMA | `cv-docs/{nama}_IJAZAH_SMA.pdf` | `master_database_candidate.ijazah_sma_url` |
| Univ | `cv-docs/{nama}_UNIV.pdf` | `master_database_candidate.univ_url` |

### Penting
- **Dokumen langsung live di Cloudinary** — tidak ada "pending storage"
- URL bisa diakses langsung setelah upload
- Admin bisa lihat dokumen kapan saja (via URL di DB)
- **Tidak ada approval gate untuk akses dokumen** — hanya untuk status kandidat

---

## 3. Simpan ke Database (handleSubmitDataAsj)

### Flow
1. Kandidat klik "SIMPAN DB"
2. Frontend kirim: `{identitas, fisik, medis, pendidikan, pekerjaan, sertifikasi, keluarga, wawancara, context, fotoFile, jftFile, sswFile, ktpFile, kkFile, ijazah*, univFile}`
3. Backend proses:

### 3a. Upsert ke `ai_form_submissions`
```sql
INSERT INTO ai_form_submissions (
  wa, nama_lengkap, mode, job_code, status,
  ai_data_json, photo_url, jft_url, ssw_url,
  submitted_via, created_at, updated_at
) VALUES (...)
ON CONFLICT (wa, submitted_via) DO UPDATE SET ...
```
- `mode`: `'AI_MASTER'`
- `status`: `'MENUNGGU'`
- `submitted_via`: `'ai_form'`

### 3b. Upsert ke `master_database_candidate`
```sql
-- Jika kandidat sudah ada:
UPDATE master_database_candidate
SET ai_data_json = ..., pas_photo = ..., kk_url = ..., ktp_url = ...,
    ijazah_sd_url = ..., jft_url = ..., ssw_url = ..., ai_updated_at = ...
WHERE no_wa = '628xxx';

-- Jika kandidat baru:
INSERT INTO master_database_candidate (no_wa, nama_lengkap, id_kandidat, ai_data_json, ...)
```

### 3c. Sync ke `database_candidate`
```sql
UPDATE database_candidate
SET pas_photo = ..., jft = ..., ssw = ..., ktp_url = ...
WHERE no_wa = '628xxx';
```

### 3d. Merge ai_data_json
- Jika ada data lama → merge: pertahankan key non-AI (kenalan_jepang, uploads, dll)
- `AI_MANAGED_KEYS`: identitas, fisik, medis, pendidikan, pekerjaan, sertifikasi, keluarga, wawancara

---

## 4. Mail Notification (syncBiodataKeMail)

### Flow
1. Backend bandingkan `ai_data_json` lama vs baru
2. Jika ada perubahan → update `database_asj_form.feedback_berkas`:
   ```
   [[PREV:MENUNGGU]] [BIODATA] identitas, wawancara
   ```
3. Status diubah:
   - Jika status lama: MENUNGGU/MAIL/BARU/PENDING → tetap MENUNGGU
   - Jika status lama: LULUS/GAGAL/REVIEW/APPROVED → berubah ke UPDATE

### AI_SEKSI_LABEL
| Key | Label |
|-----|-------|
| identitas | identitas |
| fisik | fisik & ukuran |
| medis | medis |
| pendidikan | pendidikan |
| pekerjaan | pekerjaan |
| sertifikasi | sertifikasi |
| keluarga | keluarga |
| wawancara | wawancara |

---

## 5. FCM Push Notification ke Admin

### Flow
1. `notifyAdmins('Biodata Lengkap (CV) Diperbarui', body, '/admin.html')`
2. Kirim ke semua admin FCM tokens
3. Body: `"Kandidat Agus (628xxx) memperbarui data: identitas, wawancara."`
4. Klik notifikasi → buka `/admin.html`

### Storage
- Admin FCM tokens: `admin_fcm_tokens` table
- Kandidat FCM tokens: `kandidat_fcm_tokens` table

---

## 6. Admin Review

### Flow
1. Admin buka `admin.html`
2. Lihat kandidat di mail (status: MENUNGGU atau UPDATE)
3. Klik kandidat → buka `ai_form.html` dengan data kandidat
4. Review data + dokumen
5. Approve/reject:
   - LULUS → kandidat lanjut ke tahap berikutnya
   - GAGAL → kandidat ditolak
   - REVIEW → perlu perbaikan

### Admin AI Chat (admin.html)
- Admin bisa chat dengan AI tentang kandidat
- AI punya akses ke `ai_data_json` kandidat
- Admin bisa edit data langsung

---

## 7. Database Schema

### Tables yang Dipakai

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ai_form_submissions` | Record submission | wa, mode, status, ai_data_json, submitted_via |
| `master_database_candidate` | Data lengkap kandidat | no_wa, nama_lengkap, ai_data_json, pas_photo, *_url |
| `database_candidate` | Panel utama | no_wa, pas_photo, jft, ssw, ktp_url |
| `database_asj_form` | Mail/inbox | no_wa, status, feedback_berkas |
| `esignatures` | Tanda tangan | wa, ttd1, ttd2 |

### submitted_via Values
| Value | Source |
|-------|--------|
| `ai_form` | AI CV chat submit |
| `interview` | Hasil wawancara |
| `esign` | Tanda tangan naitei |
| `ttd` | TTD fallback |

---

## 8. Error Handling

| Scenario | Handling |
|----------|----------|
| Cloudinary upload gagal | Error toast, form tetap bisa save (tanpa file) |
| Supabase write gagal | Error toast, data tetap di localStorage |
| Mail sync gagal | Diam saja (try-catch) |
| FCM notification gagal | Diam saja (try-catch) |
| AI response bukan JSON | Fallback ke teks biasa |

---

## 9. Security

- `requireRole(sessionToken, 'kandidat')` — hanya kandidat yang bisa submit
- `normalizeWa()` — validasi format WA
- `AI_MANAGED_KEYS` — protect non-AI keys dari overwrite
- No admin approval needed for data save — tapi status tetap MENUNGGU

---

## 10. Anti-Cache Strategy

- SW: network-first untuk navigasi, stale-while-revalidate untuk aset
- `skipWaiting()` + `clients.claim()` — SW baru langsung aktif
- `setInterval(5 min)` check versi SW dari server
- `ASJ_FORCE_RELOAD` message → auto-reload semua tab
