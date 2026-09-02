import { normalizeWa, pick, supabaseJson } from '../db/client.ts';
import { requireRole } from '../actions-auth.ts';
import * as buildMasterNested from '../actions-master.ts';
import { syncBiodataKeMail, syncFormMailDariUpload } from '../actions-mail.ts';
import { fetchMasterByWa as dbFetchMasterByWa } from '../db/master.ts';
import { findFormsByWa } from '../db/forms.ts';
// ai/cv.js — domain AI master/CV: auto-fill data kandidat (buildMasterNested /
// buildRingkasData), konteks admin AI copilot, & penyimpanan data AI form
// (ai_form_submissions + master_database_candidate). MODUL BARU (Fase 1.4

import {
  findCandidateByIdFiltered,
  findCandidateByWaFiltered,
  findCandidates,
} from '../db/candidates.ts';
// Satu sumber buildMasterNested (dari actions-master.js) supaya konteks AI
// admin tidak pakai salinan lama yang belum merge ai_data_json (kenalan JP/
// alamat & array riwayat tampil kosong di copilot admin).

// Label seksi AI form untuk ringkasan mail ("[BIODATA] fisik & ukuran, medis") —
// samakan dengan fix sync biodata (submitMasterForm/updateKandidatSuper) supaya
// admin tahu bagian mana yang di-update kandidat lewat ai_form.
const AI_SEKSI_LABEL = {
  identitas: 'identitas',
  fisik: 'fisik & ukuran',
  medis: 'medis',
  pendidikan: 'pendidikan',
  pekerjaan: 'pekerjaan',
  sertifikasi: 'sertifikasi',
  keluarga: 'keluarga',
  wawancara: 'wawancara',
};

const APPLY_WA_COLS = ['no_wa', 'wa', 'whatsapp'];

async function findMasterByWa(wa) {
  const want = normalizeWa(wa);
  const rows = await dbFetchMasterByWa([want]);
  if (!Array.isArray(rows)) return null;
  return (
    rows.find((r) => normalizeWa(String(r.no_wa || r.wa || r.whatsapp || '')) === want) || null
  );
}

// Ringkasan data kandidat (bentuk nested dari buildMasterNested) yang disuntikkan
// ke system prompt processAIChat — supaya Jeklin TAHU data yang sudah terisi
// (TB/BB, NIK, paspor, dll) dan tidak menanyakan ulang data yang ada di database.
function buildRingkasData(cur) {
  const id = (cur && cur.identitas) || {};
  const fs = (cur && cur.fisik) || {};
  const md = (cur && cur.medis) || {};
  const st = (cur && cur.sertifikasi) || {};
  const ww = (cur && cur.wawancara) || {};
  const lines = [];
  const add = (label, val) => {
    const s = val === undefined || val === null ? '' : String(val).trim();
    if (s && s !== '' && s !== '-') lines.push(label + ': ' + s);
  };
  add('Nama lengkap', id.nama_lengkap);
  add('Nama panggilan', id.panggilan);
  add('Katakana', id.katakana);
  add('Tempat lahir', id.tempat_lahir);
  add('Tanggal lahir', id.tgl_lahir);
  add('Umur', id.umur);
  add('Gender', id.gender);
  add('Agama', id.agama);
  add('Golongan darah', id.golongan_darah);
  add('Status pernikahan', id.status_nikah);
  add('No HP', id.hp);
  add('No HP darurat', id.hp_darurat);
  add('Alamat', id.alamat);
  add('Email', id.email);
  add('Tinggi badan', fs.tb ? fs.tb + ' cm' : '');
  add('Berat badan', fs.bb ? fs.bb + ' kg' : '');
  add('Ukuran topi', fs.topi);
  add('Ukuran baju', fs.baju);
  add('Ukuran sepatu', fs.sepatu);
  add('Tangan dominan', fs.tangan_dominan);
  add('Tahan AC', fs.tahan_ac);
  add('Kacamata', md.kacamata);
  add('Buta warna', md.buta_warna);
  add('Tato', md.tato);
  add('Tindik', md.tindik);
  add('Rokok', md.rokok);
  add('Alkohol', md.alkohol);
  add('Alergi', md.alergi_id);
  add('Riwayat penyakit', md.riwayat_medis_id);
  add('Riwayat kecelakaan', md.riwayat_kecelakaan_id);
  add('NIK KTP', id.ktp);
  add('No. Paspor', id.paspor);
  add('SIM', id.sim);
  add('Pernah ke Jepang', id.status_eks_jepang);
  add('Bahasa Jepang (JLPT/JFT)', st.bahasa_jepang || st.jft || st.bahasa);
  add('SSW/Lisensi', st.lisensi || st.ssw);
  add('Bidang SSW', st.bidang);
  add('Hobi', ww.hobi_id);
  add('Kelebihan', ww.kelebihan_id);
  add('Kekurangan', ww.kekurangan_id);
  add('Motivasi ke Jepang', ww.motivasi_ke_jepang || ww.tujuan_ke_jepang);
  const pend = Array.isArray(cur && cur.pendidikan) ? cur.pendidikan : [];
  if (pend.length) {
    add(
      'Pendidikan',
      pend
        .map((p) =>
          [
            p.tingkat,
            p.sekolah || p.nama_sekolah,
            p.jurusan_id || p.jurusan,
            p.tahun_lulus ? p.tahun_lulus + ' lulus' : '',
          ]
            .filter(Boolean)
            .join(' - '),
        )
        .join('; '),
    );
  }
  const pek = Array.isArray(cur && cur.pekerjaan) ? cur.pekerjaan : [];
  if (pek.length) {
    add(
      'Pengalaman kerja',
      pek
        .map((p) =>
          [
            p.perusahaan || p.nama_perusahaan,
            p.jabatan,
            p.tahun_masuk ? p.tahun_masuk + '-' + (p.tahun_keluar || 'sekarang') : '',
          ]
            .filter(Boolean)
            .join(' - '),
        )
        .join('; '),
    );
  }
  const klg = Array.isArray(cur && cur.keluarga) ? cur.keluarga : [];
  if (klg.length) {
    add(
      'Keluarga',
      klg
        .map((k) =>
          [k.hubungan, k.nama, k.usia ? k.usia + ' th' : '', k.pekerjaan]
            .filter(Boolean)
            .join(' - '),
        )
        .join('; '),
    );
  }
  return lines.join('\n');
}

async function handleGetAdminAiContext(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const d = (payload && payload[0]) || {};
  const wa = String(d.wa || d.waTarget || '');
  try {
    let row = null;
    if (wa) row = await findMasterByWa(wa);
    if (!row && (d.candidateId || d.idKandidat || d.wa)) {
      const id = String(d.candidateId || d.idKandidat || '');
      // Jalur cepat: cari baris kandidat via query server-side (by id / WA).
      let cand = id ? await findCandidateByIdFiltered(id) : await findCandidateByWaFiltered(d.wa);
      if (cand === undefined) {
        const found = await findCandidates();
        cand =
          (found.rows || []).find((r) =>
            id
              ? String(pick(r, ['id_kandidat', 'id']) || '') === id
              : normalizeWa(String(pick(r, APPLY_WA_COLS) || '')) === normalizeWa(d.wa),
          ) || null;
      }
      if (cand) row = await findMasterByWa(String(cand.no_wa || ''));
    }
    if (!row) return { success: true, data: null };
    // @ts-expect-error JS→TS migration
    return { success: true, data: buildMasterNested(row) };
  } catch (e) {
    return { success: false, error: 'Terjadi kesalahan saat mengambil data kandidat.' };
  }
}

async function handleBuildAdminAiCandidateSummary(payload, sessionToken) {
  const ctx = await handleGetAdminAiContext(payload, sessionToken);
  if (!ctx.success) return ctx;
  // @ts-expect-error JS→TS migration
  const data = ctx.data;
  const summary = data
    ? data.identitas.nama_lengkap +
      ' | ' +
      (data.identitas.umur || '-') +
      ' th | ' +
      (data.fisik.tb || '-') +
      'cm/' +
      (data.fisik.bb || '-') +
      'kg | JFT: ' +
      (data.sertifikasi.jft || '-')
    : 'Data kandidat belum lengkap.';
  return { success: true, summary, data };
}

// ---------------------------------------------------------------------------
// Tulis ai_form_submissions dengan toleransi kolom opsional.
//
// LATAR (2026-09-02, bug "klik SIMPAN DB tidak bisa simpan"): body menyertakan
// `submitted_by` & `ai_updated_at` yang belum tentu ada di semua lingkungan.
// Diverifikasi lewat information_schema pada 2026-09-02:
//   - ai_form_submissions PUNYA ai_updated_at (timestamptz)  ✅
//   - ai_form_submissions TIDAK punya submitted_by           ❌
// PostgREST menolak SELURUH write dengan HTTP 400 PGRST204 ("Could not find
// the 'submitted_by' column …") kalau satu saja kolom tidak dikenal → simpan
// gagal TOTAL untuk semua kandidat.
//
// Mekanisme: kirim body lengkap; kalau ditolak karena kolom tidak dikenal,
// nonaktifkan kolom itu (diingat di modul supaya request berikutnya langsung
// valid — tidak ada percobaan gagal berulang) lalu ulangi.
// Tetap jalankan migrations/20260902_add_ai_form_submission_cols.sql supaya
// jejak `submitted_by` (siapa yang menyimpan) tidak hilang.
// ---------------------------------------------------------------------------
const AI_SUB_OPTIONAL_COLS = ['submitted_by', 'ai_updated_at'];
const aiSubColEnabled = { submitted_by: true, ai_updated_at: true };

async function writeAiSubmission(existing, body) {
  for (var attempt = 0; attempt < 3; attempt++) {
    var tryBody = Object.assign({}, body);
    for (const c of AI_SUB_OPTIONAL_COLS) {
      if (!aiSubColEnabled[c]) delete tryBody[c];
    }
    try {
      if (existing && existing.id !== undefined) {
        await supabaseJson('PATCH', 'ai_form_submissions', {
          query: { id: 'eq.' + existing.id },
          body: tryBody,
          headers: { Prefer: 'return=minimal' },
        });
      } else {
        await supabaseJson('POST', 'ai_form_submissions', {
          body: Object.assign({ created_at: new Date().toISOString() }, tryBody),
          headers: { Prefer: 'return=minimal' },
        });
      }
      return { ok: true };
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      // PGRST204 / "Could not find the 'xxx' column" → matikan kolom itu saja.
      var disabled = false;
      for (const c of AI_SUB_OPTIONAL_COLS) {
        if (aiSubColEnabled[c] && msg.indexOf("'" + c + "'") !== -1) {
          aiSubColEnabled[c] = false;
          disabled = true;
          console.warn(
            '[submitDataAsj] kolom ai_form_submissions.' +
              c +
              ' tidak ada di database — dilewati untuk seterusnya.',
          );
        }
      }
      if (disabled && attempt < 2) continue;
      return { ok: false, message: msg };
    }
  }
  return { ok: false, message: 'Gagal menulis ai_form_submissions.' };
}

// ---------------------------------------------------------------------------
// submitDataAsj — simpan data AI form (ai_form.html) ke ai_form_submissions
// ---------------------------------------------------------------------------
async function handleSubmitDataAsj(payload, sessionToken) {
  const d = payload || {};
  const ctx = d.context || {};
  const identitas = d.identitas || {};
  const wa = normalizeWa(String(ctx.wa || identitas.hp || ''));
  if (!wa) return { success: false, message: 'Nomor WA tidak ditemukan.' };
  // Accept BOTH admin and kandidat sessions.
  const adminGuard = requireRole(sessionToken, 'admin');
  const kandidatGuard = requireRole(sessionToken, 'kandidat');
  const isAdmin = !adminGuard.error;
  const isKandidat = !kandidatGuard.error;
  if (!isAdmin && !isKandidat) {
    return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };
  }
  const submittedBy = isAdmin ? 'admin:' + (adminGuard.token?.name || 'unknown') : 'kandidat';
  const guard = kandidatGuard;
  try {
    const aiData = {
      identitas: d.identitas || {},
      fisik: d.fisik || {},
      medis: d.medis || {},
      pendidikan: d.pendidikan || {},
      pekerjaan: d.pekerjaan || {},
      sertifikasi: d.sertifikasi || {},
      keluarga: d.keluarga || {},
      wawancara: d.wawancara || {},
    };
    // Seksi yang dikelola form AI. Kunci lain (kenalan_jepang, context,
    // fotoFile/jftFile/sswFile, dll) PERTAHANKAN dari ai_data_json lama —
    // tanpa ini simpan CV AI menghapus data kenalan & file lama dari
    // master_database_candidate.ai_data_json (bug: kenalan hilang setelah
    // save CV AI).
    const AI_MANAGED_KEYS = new Set([
      'identitas',
      'fisik',
      'medis',
      'pendidikan',
      'pekerjaan',
      'sertifikasi',
      'keluarga',
      'wawancara',
    ]);
    const nama = String(identitas.nama_lengkap || '').trim();
    const jobCode = String(ctx.job || ctx.jobCode || '');
    // CHECK constraint tabel ini hanya izinkan mode='AI_MASTER' + status='MENUNGGU'
    // (discriminator sesi: submitted_via='ai_form' vs 'interview').
    const body = {
      wa,
      nama_lengkap: nama,
      mode: 'AI_MASTER',
      job_code: jobCode,
      status: 'MENUNGGU',
      ai_data_json: JSON.stringify(aiData),
      ai_updated_at: new Date().toISOString(),
      photo_url: d.fotoFile || '',
      jft_url: d.jftFile || '',
      ssw_url: d.sswFile || '',
      submitted_via: 'ai_form',
      submitted_by: submittedBy,
      updated_at: new Date().toISOString(),
    };
    const existingRows = await supabaseJson('GET', 'ai_form_submissions', {
      query: { select: '*', wa: 'eq.' + wa, limit: '10' },
    });
    const existing = (Array.isArray(existingRows) ? existingRows : []).find(
      (r) => normalizeWa(String(r.wa || '')) === wa && String(r.submitted_via || '') === 'ai_form',
    );
    const write = await writeAiSubmission(existing, body);
    if (!write.ok) {
      // Pesan asli Supabase ikut dikembalikan — tanpa ini kandidat hanya
      // melihat "Gagal menyimpan data" dan penyebabnya tidak pernah ketahuan.
      console.error('[submitDataAsj] gagal tulis ai_form_submissions:', write.message);
      return {
        success: false,
        message: 'Gagal menyimpan data. ' + (write.message || 'Silakan coba lagi.'),
      };
    }
    try {
      const m = await findMasterByWa(wa);
      let aiOut = aiData;
      let prev = null;
      if (m && m.id !== undefined) {
        try {
          const prevRaw = m.ai_data_json;
          prev =
            typeof prevRaw === 'string' && prevRaw.trim() && prevRaw !== '-'
              ? JSON.parse(prevRaw)
              : null;
          if (prev && typeof prev === 'object') {
            // @ts-expect-error JS→TS migration
            aiOut = {};
            for (const k of Object.keys(prev)) {
              if (!AI_MANAGED_KEYS.has(k)) aiOut[k] = prev[k];
            }
            for (const k of Object.keys(aiData)) aiOut[k] = aiData[k];
          }
        } catch (e) {
          prev = null;
        }
      }

      const masterBody: any = {
        ai_data_json: JSON.stringify(aiOut),
        ai_updated_at: new Date().toISOString(),
      };
      if (d.fotoFile) masterBody.pas_photo = d.fotoFile;
      if (d.kkFile) masterBody.kk_url = d.kkFile;
      if (d.ktpFile) masterBody.ktp_url = d.ktpFile;
      if (d.ijazahSdFile) masterBody.ijazah_sd_url = d.ijazahSdFile;
      if (d.ijazahSmpFile) masterBody.ijazah_smp_url = d.ijazahSmpFile;
      if (d.ijazahSmaFile) masterBody.ijazah_sma_url = d.ijazahSmaFile;
      if (d.univFile) masterBody.univ_url = d.univFile;
      if (d.jftFile) masterBody.jft_url = d.jftFile;
      if (d.sswFile) masterBody.ssw_url = d.sswFile;

      if (m && m.id !== undefined) {
        await supabaseJson('PATCH', 'master_database_candidate', {
          query: { id: 'eq.' + m.id },
          body: masterBody,
          headers: { Prefer: 'return=minimal' },
        });
      } else {
        const { nextCandidateId } = await import('../candidate-helpers.ts');
        const { supabaseUpsert } = await import('../db/client.ts');
        masterBody.no_wa = wa;
        masterBody.nama_lengkap = nama;
        masterBody.id_kandidat = await nextCandidateId();
        await supabaseUpsert('master_database_candidate', masterBody, ['no_wa'], {
          headers: { Prefer: 'return=minimal' },
        });
      }

      // Sinkronisasi ringan ke database_candidate untuk panel utama (pas_photo dsb)
      try {
        const candBody: any = {};
        if (d.fotoFile) candBody.pas_photo = d.fotoFile;
        if (d.jftFile) candBody.jft = d.jftFile;
        if (d.sswFile) candBody.ssw = d.sswFile;
        if (d.ktpFile) candBody.ktp_url = d.ktpFile;

        if (Object.keys(candBody).length > 0) {
          let c = await findCandidateByWaFiltered(wa);
          if (c === undefined) {
            const found = await findCandidates();
            c =
              found.rows.find((r) => normalizeWa(String(pick(r, APPLY_WA_COLS) || '')) === wa) ||
              null;
          }
          if (c && c.id !== undefined) {
            await supabaseJson('PATCH', 'database_candidate', {
              query: { id: 'eq.' + c.id },
              body: candBody,
              headers: { Prefer: 'return=minimal' },
            });
          }
        }
      } catch (e) {
        // opsional
      }

      // Sinkron field identitas dasar ke database_candidate supaya edit super
      // di CV modal admin bisa auto-fill (nama, gender, usia, tempat/tgl lahir).
      try {
        const idBody: any = {};
        if (identitas.nama_lengkap) idBody.nama_lengkap = identitas.nama_lengkap;
        if (identitas.gender) idBody.gender = identitas.gender;
        if (identitas.usia) idBody.usia = identitas.usia;
        if (identitas.tempat_lahir) idBody.tempat_lahir = identitas.tempat_lahir;
        if (identitas.tgl_lahir) idBody.tgl_lahir = identitas.tgl_lahir;
        if (identitas.hp) idBody.no_wa = wa;
        if (Object.keys(idBody).length > 0) {
          let c2 = await findCandidateByWaFiltered(wa);
          if (c2 === undefined) {
            const found2 = await findCandidates();
            c2 =
              found2.rows.find(
                (r) => normalizeWa(String(pick(r, APPLY_WA_COLS) || '')) === wa,
              ) || null;
          }
          if (c2 && c2.id !== undefined) {
            await supabaseJson('PATCH', 'database_candidate', {
              query: { id: 'eq.' + c2.id },
              body: idBody,
              headers: { Prefer: 'return=minimal' },
            });
          }
        }
      } catch (e) {
        /* opsional — sync identitas ke database_candidate */
      }

      // Sinkron KTP URL ke pemberkasan_checklist supaya admin bisa
      // preview KTP dari modal pemberkasan (bukan hanya fallback ke master).
      try {
        if (d.ktpFile) {
          const want = normalizeWa(wa);
          const pRows = await findFormsByWa(wa);
          const pRow = Array.isArray(pRows) && pRows.find(
            (r) => normalizeWa(String(r.no_wa || r.wa || '')) === want,
          );
          if (pRow && pRow.id !== undefined) {
            await supabaseJson('PATCH', 'pemberkasan_checklist', {
              query: { id: 'eq.' + pRow.id },
              body: { ktp_url: d.ktpFile },
              headers: { Prefer: 'return=minimal' },
            });
          }
        }
      } catch (e) {
        /* sync pemberkasan ktp_url opsional */
      }

      // Ringkasan perubahan ke mail (badge UPDATE + "[BIODATA] …"): hanya
      // seksi yang BENAR-BENAR berubah dari ai_data_json lama, supaya simpan
      // AI form berulang (tanpa perubahan) tidak menulis feedback tiap kali.
      if (m && m.id !== undefined) {
        try {
          const labels = [];
          for (const [key, label] of Object.entries(AI_SEKSI_LABEL)) {
            const oldVal =
              prev && typeof prev === 'object' ? JSON.stringify(prev[key] || {}) : null;
            const newVal = JSON.stringify(aiData[key] || {});
            if (oldVal !== newVal) labels.push(label);
          }
          if (labels.length) {
            await syncBiodataKeMail(
              wa,
              String(identitas.nama_lengkap || identitas.nama || '').trim() || 'KANDIDAT',
              labels,
            );
          }
        } catch (e) {
          /* sync mail opsional — jangan gagalkan simpan AI form */
        }
      } else {
        // Baris baru — buat mail entry jika belum ada
        try {
          await syncBiodataKeMail(wa, nama, ['CV AI Baru']);
        } catch (e) {}
      }

      // Fallback: pastikan kandidat punya baris mail. syncBiodataKeMail hanya
      // mengupdate baris yang sudah ada — kalau kandidat daftar lewat AI CV
      // tanpa pernah apply lewat form lamaran, tidak ada baris di
      // database_asj_form → mail tidak dibuat. syncFormMailDariUpload membuat
      // baris baru jika belum ada.
      try {
        const mailRows = await findFormsByWa(wa);
        const want = normalizeWa(wa);
        const hasMail = Array.isArray(mailRows) && mailRows.some(
          (r) => normalizeWa(String(r.no_wa || r.wa || '')) === want,
        );
        if (!hasMail) {
          await syncFormMailDariUpload(
            wa,
            nama || 'KANDIDAT',
            'AI_CV',
            d.fotoFile || '',
            jobCode,
          );
        }
      } catch (e) {
        /* sync mail fallback opsional */
      }
    } catch (e) {
      /* opsional */
    }
    return { success: true };
  } catch (e) {
    console.error(
      '[submitDataAsj] error: ' + (e && e.message ? e.message : String(e)),
    );
    return {
      success: false,
      message:
        'Gagal menyimpan data. ' +
        (e && e.message ? e.message : 'Silakan coba lagi.'),
    };
  }
}

// ---------------------------------------------------------------------------
// simpanDataTtdNaitei — simpan tanda tangan / esignature kandidat
// ---------------------------------------------------------------------------
async function handleSimpanDataTtdNaitei(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'kandidat');
  if (guard.error) return guard.error;
  const d = payload || {};
  const wa = normalizeWa(String(d.wa || ''));
  if (!wa) return { success: false, error: 'Nomor WA tidak ditemukan.' };
  try {
    const data = {
      wa,
      ttd1: d.ttd1 || '',
      nama1: d.nama1 || '',
      ttd2: d.ttd2 || '',
      nama2: d.nama2 || '',
    };
    try {
      const rows = await supabaseJson('GET', 'esignatures', {
        query: { select: '*', wa: 'eq.' + wa, limit: '10' },
      });
      const existing = (Array.isArray(rows) ? rows : []).find(
        (r) => normalizeWa(String(r.wa || '')) === wa,
      );
      if (existing && existing.id !== undefined) {
        await supabaseJson('PATCH', 'esignatures', {
          query: { id: 'eq.' + existing.id },
          body: Object.assign(data, { updated_at: new Date().toISOString() }),
          headers: { Prefer: 'return=minimal' },
        });
      } else {
        await supabaseJson('POST', 'esignatures', {
          body: Object.assign(data, {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
          headers: { Prefer: 'return=minimal' },
        });
      }
    } catch (e) {
      /* tabel esignatures mungkin kosong/tanpa kolom wa — fallback ke ai_form_submissions */
      await supabaseJson('POST', 'ai_form_submissions', {
        body: {
          wa,
          mode: 'ttd',
          status: 'TTD',
          ai_data_json: JSON.stringify(data),
          submitted_via: 'esign',
        },
        headers: { Prefer: 'return=minimal' },
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Terjadi kesalahan saat menyimpan tanda tangan.' };
  }
}

export {
  APPLY_WA_COLS,
  AI_SEKSI_LABEL,
  buildMasterNested,
  buildRingkasData,
  findMasterByWa,
  handleGetAdminAiContext,
  handleBuildAdminAiCandidateSummary,
  handleSubmitDataAsj,
  handleSimpanDataTtdNaitei,
};
