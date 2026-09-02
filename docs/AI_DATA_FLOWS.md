# AI Data Flows — Referensi Lengkap

> Dokumen ini memetakan SEMUA alur data AI di ASJ Portal: dari user action → backend → Supabase → tampilan.
> Dibuat untuk mencegah "update 1 fitur AI, fitur lain rusak."

---

## Ringkasan Fitur AI

| # | Fitur | Halaman | Actor | Gemini? | Persist? |
|---|-------|---------|-------|---------|----------|
| 1 | AI CV Master | ai_form.html | Kandidat VIP + Admin | ✅ | ✅ |
| 2 | AI Admin Chat | admin.html (bundle) | Admin | ✅ | ❌ (chat only) |
| 3 | AI Siswa Baru | siswa-baru.html | Public | ✅ | ✅ |
| 4 | AI Wawancara | ai_form.html | Kandidat | ✅ | ❌ (during chat) |
| 5 | Selesaikan Wawancara | ai_form.html | Kandidat | ✅ | ❌ (returns JSON) |
| 6 | Simpan Hasil Wawancara | ai_form.html | Kandidat | ❌ | ✅ |
| 7 | Generate Wawancara Model | admin.html (bundle) | Admin | ✅ | ❌ (returns text) |
| 8 | Parse Dokumen Biodata | admin.html (bundle) | Admin | ✅ | ❌ (returns JSON) |
| 9 | Submit Data ASJ | ai_form.html | Kandidat + Admin | ❌ | ✅ |
| 10 | Simpan Data TTD Naitei | ai_form.html | Kandidat | ❌ | ✅ |

---

## Detail per Fitur

### 1. AI CV Master (`processAIChat`, flow=master)

**Alur:**
```
User chat di ai_form.html
  → callAPI('processAIChat', { history, currentData, lang, flow:'master' })
  → Netlify Function: ai-chat.ts → handleProcessAIChat()
  → Gemini generate (system prompt + history)
  → AI returns { reply, data: { identitas, wawancara, ... } }
  → autoTranslateMissingJp(aiData) — translate _id → _jp
  → autoTranslateMissingJp(p.currentData) — translate dari DB data juga
  → Return { reply, data } ke frontend
  → Frontend merge: latestCandidateData = { ...latestCandidateData, ...data }
  → Form terisi otomatis
```

**Backend reads:**
- `master_database_candidate` (via `findMasterByWa`) — untuk VIP guard + `buildRingkasData`
- `database_candidate` (via `findCandidateByWaFiltered`) — fallback VIP guard

**Backend writes:** Tidak ada (chat only, tidak persist ke DB)

**Frontend writes:**
- localStorage draft (auto-save)
- Form fields (user input + AI merge)

**Kunci data AI:** `identitas`, `fisik`, `medis`, `sertifikasi`, `wawancara`, `kenalan_jepang`, `pendidikan[]`, `pekerjaan[]`, `keluarga[]`

---

### 2. AI Admin Chat (`processAdminAIChat`)

**Alur:**
```
Admin chat di admin panel
  → callAPI('processAdminAIChat', { message, history, candidateId, adminName })
  → Netlify Function: ai-chat.ts → handleProcessAdminAIChat()
  → Gemini generate (system prompt + history)
  → Return { reply } ke frontend
  → Tidak ada persist — murni chat analisis
```

**Backend reads:** Tidak ada (hanya kirim nama admin + kandidat ID ke AI)

**Backend writes:** Tidak ada

**Catatan:** Tidak ada auto-translate, tidak ada data merge. Pure chat.

---

### 3. AI Siswa Baru (`processSiswaAIChat`)

**Alur:**
```
Siswa chat di siswa-baru.html
  → callAPI('processSiswaAIChat', { history, currentData })
  → Netlify Function: ai-chat.ts → handleProcessSiswaAIChat()
  → Gemini generate (system prompt + history)
  → AI returns { reply, data: { nama, ttl, gender, ... } }
  → Return ke frontend
  → Frontend merge ke data object
  → Form fields terisi
```

**Backend reads:** Tidak ada

**Backend writes:** Tidak ada

**Frontend writes:**
- localStorage draft (`asj_siswa_draft_v1`)
- Form fields

**Kunci data AI:** `nama`, `ttl`, `gender`, `agama`, `alamat`, `email`, `pendidikan`, `wa_siswa`, `wa_ortu`

**Submit:** `submitDaftarSiswa` → writes ke `respon_siswa_baru` (bukan via AI)

---

### 4. AI Wawancara (`processAiInterview`)

**Alur:**
```
Kandidat mulai wawancara di ai_form.html
  → callAPI('processAiInterview', { wa, history, bidang, kota })
  → Netlify Function: ai-chat.ts → handleProcessAiInterview()
  → resolveProfilKandidat(wa) — lookup nama + bidang dari DB
  → buildInterviewSystem(profil, kota) — 14 pertanyaan wawancara
  → Gemini generate (system prompt + history)
  → Return { reply } ke frontend
  → Chat wawancara berjalan (tidak persist selama chat)
```

**Backend reads:**
- `master_database_candidate` (via `findMasterByWa`) — nama + bidang
- `database_candidate` (fallback) — nama + bidang

**Backend writes:** Tidak ada (selama chat)

**Catatan:** Hasil wawancara baru di-extract saat user klik "Selesai & Kirim" (fitur 5+6).

---

### 5. Selesaikan Wawancara (`selesaikanWawancara`)

**Alur:**
```
Kandidat klik "Selesai & Kirim Hasil"
  → callAPI('selesaikanWawancara', { wa, history })
  → Netlify Function: ai-chat.ts → handleSelesaikanWawancara()
  → Build transcript dari history
  → Gemini generate: extract { score, nilai, rekomendasi, biodata, catatan }
  → Return { hasil } ke frontend
  → Frontend tampilkan ringkasan
  → User klik "Simpan" → trigger fitur 6
```

**Backend reads:** Chat transcript (dari frontend history)

**Backend writes:** Tidak ada (hanya return JSON)

---

### 6. Simpan Hasil Wawancara (`simpanHasilWawancara`)

**Alur:**
```
Kandidat klik "Simpan Hasil"
  → callAPI('simpanHasilWawancara', { wa, hasil })
  → Netlify Function: ai-chat.ts → handleSimpanHasilWawancara()
  → Upsert ke ai_form_submissions (submitted_via='interview')
  → Return { success }
```

**Backend reads:**
- `ai_form_submissions` — check existing row (wa + submitted_via='interview')

**Backend writes:**
- `ai_form_submissions` (POST atau PATCH)
  - `wa`, `mode='AI_MASTER'`, `job_code='UMUM'`, `bidang='-'`, `status='MENUNGGU'`
  - `submitted_via='interview'`, `ai_data_json=JSON.stringify(hasil)`
  - `nama_lengkap` (dari hasil.biodata.nama)

---

### 7. Generate Wawancara Model (`generateWawancaraModel`)

**Alur:**
```
Admin klik "Generate Model Wawancara"
  → callAPI('generateWawancaraModel', { wa, bidang, kota })
  → Netlify Function: admin-ai-context.ts
  → resolveProfilKandidat(wa) — lookup nama + bidang
  → Gemini generate: 14 pertanyaan wawancara + panduan jawaban
  → Return { model, bidang, nama, wa }
  → Admin copy-paste ke Google Sheet
```

**Backend reads:**
- `master_database_candidate` — nama + bidang
- `database_candidate` (fallback)

**Backend writes:** Tidak ada (return text only)

---

### 8. Parse Dokumen Biodata (`parseDokumenBiodata`)

**Alur:**
```
Admin upload dokumen biodata (PDF/Word/Excel)
  → callAPI('parseDokumenBiodata', { fileUrl, wa })
  → Netlify Function: admin-ai-context.ts
  → Download file → extract text (pdf-parse/mammoth/xlsx)
  → Gemini generate: parse structured biodata dari teks
  → Return { parsed } ke frontend
  → Admin review + merge ke form
```

**Backend reads:** Uploaded file (Supabase Storage URL)

**Backend writes:** Tidak ada (return JSON only)

---

### 9. Submit Data ASJ (`submitDataAsj`)

**Alur:**
```
User klik "Kirim Data" di ai_form.html
  → callAPI('submitDataAsj', { wa, nama, data, files })
  → Netlify Function: ai-form-submit.ts → handleSubmitDataAsj()
  → Upload files ke Cloudinary
  → Save ke ai_form_submissions (submitted_via='ai_form')
  → Sync ke master_database_candidate (ai_data_json + files)
  → Sync ke database_candidate (pas_photo, jft, ssw, ktp_url)
  → Create/update esignatures row
  → Return { success }
```

**Backend reads:**
- `ai_form_submissions` — check existing row
- `master_database_candidate` — merge ai_data_json
- `database_candidate` — check existing

**Backend writes:**
- `ai_form_submissions` (POST atau PATCH)
- `master_database_candidate` (PATCH: ai_data_json + files)
- `database_candidate` (PATCH: pas_photo, jft, ssw, ktp_url)
- `esignatures` (POST atau PATCH)

---

### 10. Simpan Data TTD Naitei (`simpanDataTtdNaitei`)

**Alur:**
```
Kandidat klik "Simpan & Tanda Tangan" di ai_form.html
  → callAPI('simpanDataTtdNaitei', { wa, nama, data })
  → Netlify Function: ai-form-submit.ts → handleSimpanDataTtdNaitei()
  → Save ke ai_form_submissions (submitted_via='ttd', mode='ttd')
  → Return { success }
```

**Backend reads:**
- `ai_form_submissions` — check existing row

**Backend writes:**
- `ai_form_submissions` (POST atau PATCH)
  - `mode='ttd'`, `status='TTD'`, `submitted_via='ttd'`

---

## Supabase Tables yang Dipakai AI

### `ai_form_submissions`

| Kolom | Type | Digunakan oleh |
|-------|------|----------------|
| `id` | int8 | Semua (primary key) |
| `wa` | text | Semua (disc
riminator): 'ai_form' / 'interview' / 'ttd' / 'esign' |
| ai_data_json | jsonb | Data utama - nested JSON |
| nama_lengkap | text | Nama kandidat |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

**Siapa tulis apa:**
| Feature | submitted_via | mode | Isi ai_data_json |
|---------|---------------|------|------------------|
| AI CV Submit | ai_form | AI_MASTER | Nested JSON (identitas, wawancara, dll) |
| Wawancara Simpan | interview | AI_MASTER | { score, nilai, rekomendasi, biodata, catatan } |
| TTD Naitei | ttd | ttd | Data kandidat + tanda tangan |

### master_database_candidate

**Kolom yang ditulis AI:** ai_data_json, ai_updated_at, pas_photo, kk_url, ktp_url, ijazah_*_url, univ_url, jft_url, ssw_url
**Kolom yang dibaca AI:** * (semua via buildMasterNested), catatan_internal (VIP guard), bidangssw (wawancara)

### database_candidate

**Kolom yang ditulis AI:** pas_photo, jft, ssw, ktp_url (sync dari master)
**Kolom yang dibaca AI:** no_wa, nama/nama_lengkap, bidang/ssw/bidangssw, catatan_internal

### respon_siswa_baru

**Ditulis oleh:** submitDaftarSiswa
**Kolom:** nama_lengkap, alamat_email, jenis_kelamin, alamat_lengkap, tempat_tanggal_lahir, agama, nomor_wa_peserta, nomor_wa_orangtua, pendidikan_terakhir, file_ktp, file_kk, file_ijazah

### esignatures

**Ditulis oleh:** AI CV Submit (saat kandidat TTD)
**Kolom:** wa, data_json, signature_url, status

---

## Mapping Key Names (Conflict Source!)

| Deskripsi | AI Instructions (AI return) | buildMasterNested (DB -> nested) |
|-----------|---------------------------|--------------------------------|
| Motivasi | motivasi_id / motivasi_jp | motivasi_ke_jepang / motivasi_ke_jepang_jp |
| Alasan Bidang | alasan_bidang_id / alasan_bidang_jp | alasan_memilih_bidang / alasan_memilih_bidang_jp |
| Rencana Pulang | rencana_pulang_id / rencana_pulang_jp | rencana_setelah_pulang / rencana_setelah_pulang_jp |
| Keahlian | keahlian_id / keahlian_jp | keahlian_khusus / keahlian_khusus_jp |

**Solusi:** AI_ID_JP_PAIRS sekarang punya 24 pairs (termasuk aliases). SUDAH DIFIX.

---

## Conflict Matrix

| Fitur A | Fitur B | Shared Resource | Risk | Mitigation |
|---------|---------|----------------|------|------------|
| AI CV Chat | AI CV Submit | latestCandidateData (localStorage) | Medium | Chat merge hati-hati |
| AI CV Submit | Wawancara Simpan | ai_form_submissions | Low | Discriminator submitted_via |
| AI CV Chat | AutoTranslate | AI_ID_JP_PAIRS | HIGH | Key name mismatch (SELESAI DIFIX) |

---

## SQL yang Dibutuhkan

### Tidak perlu SQL baru!

Semua kolom yang dibutuhkan AI sudah ada di Supabase.

---

## Checklist: Sebelum Update Fitur AI

- Cek AI_ID_JP_PAIRS - apakah ada key baru?
- Cek AI_FORM_DATA_INSTRUCTION - apakah AI instructions match?
- Cek buildMasterNested - apakah key output match?
- Cek submitted_via - apakah value unik?
- Cek AI_MANAGED_KEYS - apakah key baru perlu ditambah?
- Jalankan npx esbuild - syntax OK?
- Test chat -> auto-translate -> submit -> cek DB
