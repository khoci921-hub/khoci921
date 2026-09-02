import { hasBackend, normalizeWa, pick, supabaseJson, toText } from './db/client';
import { findForms, findFormsByWa, mapForm } from './db/forms';
import { findCandidates, mapCandidate } from './db/candidates';
import { attachBerkasBio } from './db/berkas';
import { requireAdmin } from './actions-auth';
import { findCandidateByWa } from './candidate-helpers';
import { cacheClear } from './cache';
import { stripRaw } from './actions-public';
// actions-job.js — kelola lowongan (job_database): simpan/edit/status/hapus/

import {
  countCandidatesForJob,
  findJobByCodeFiltered,
  findJobs,
  mapJob,
  maxJobCodeNumber,
} from './db/jobs';

// Pemetaan payload frontend -> kolom tabel job_database (snake_case).
const JOB_COLUMNS = {
  tsk: 'tsk',
  kategori: 'kategori',
  pekerjaan: 'pekerjaan',
  lokasi: 'lokasi',
  gender: 'gender',
  templateCv: 'format_cv',
  status: 'status',
  kuota: 'kuota',
  jmlKandidat: 'jumlah_kandidat',
  syarat: 'syarat',
  keterangan: 'keterangan',
  pamflet: 'link_pamflet',
  tahapanDB: 'tahapan',
  totalBiaya: 'total_biaya',
  rincianBiaya: 'rincian_biaya',
  dokumenShare: 'dokumen_share',
};

function mapJobPayloadToRow(data) {
  const row: Record<string, unknown> = {};
  for (const [from, to] of Object.entries(JOB_COLUMNS)) {
    if (data[from] !== undefined && data[from] !== null) row[to] = data[from];
  }
  return row;
}

// Kode loker baru: TG<max+1>ASJ (pola asli, mis. TG591ASJ).
async function nextJobCode() {
  // Jalur cepat: ambil kode job tertinggi via query server-side.
  const fastMax = await maxJobCodeNumber();
  if (fastMax !== undefined) return 'TG' + (fastMax + 1) + 'ASJ';
  // Fallback: scan penuh (perilaku lama).
  const found = await findJobs();
  let max = 0;
  for (const row of found.rows) {
    const m = String(row.code_job || row.code || '').match(/TG(\d+)ASJ/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return 'TG' + (max + 1) + 'ASJ';
}

async function handleSimpanJobBaru(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const data = (payload && payload[0]) || {};
  if (!data.pekerjaan) return { success: false, error: 'Nama pekerjaan wajib diisi.' };
  if (!hasBackend()) return { success: false, error: 'Backend belum dikonfigurasi.' };
  try {
    const code = await nextJobCode();
    const body = { code_job: code, ...mapJobPayloadToRow(data) };
    await supabaseJson('POST', 'job_database', {
      body,
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true, code };
  } catch (e) {
    return { success: false, error: 'Gagal simpan loker: ' + e.message };
  }
}

async function handleEditLokerFull(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const data = (payload && payload[0]) || {};
  if (!data.code) return { success: false, error: 'Kode loker tidak ditemukan.' };
  if (!hasBackend()) return { success: false, error: 'Backend belum dikonfigurasi.' };
  try {
    const body = mapJobPayloadToRow(data);
    // Kosong = pertahankan nilai lama (kontrak asli), kecuali dokumenShare
    // boleh dikosongkan via kiriman kosong.
    for (const k of Object.keys(body)) {
      if (k !== 'dokumen_share' && (body[k] === '' || body[k] === '-')) delete body[k];
    }
    await supabaseJson('PATCH', 'job_database', {
      query: { code_job: 'eq.' + data.code },
      body,
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal edit loker: ' + e.message };
  }
}

// Ambil baris job hasil update (bentuk dbJobs yang dipakai frontend) — dipakai
// handler kelola loker supaya respons aksi membawa barisnya sendiri (patch-in-
// place) tanpa frontend harus tarik ulang getAppData.
async function getJobMapped(code) {
  // Jalur cepat: cari baris job via query server-side (filter code_job).
  let row = await findJobByCodeFiltered(code);
  if (row === undefined) {
    // Fallback: scan penuh (skema kolom tidak dikenal).
    const found = await findJobs();
    row =
      (found.rows || []).find((r) => String(r.code_job || r.code || '') === String(code)) || null;
  }
  if (!row) return null;
  return stripRaw([mapJob(row)])[0] || null;
}

async function handleUbahStatusJob(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const [code, status] = payload || [];
  if (!code || !status) return { success: false, error: 'Data tidak lengkap.' };
  try {
    await supabaseJson('PATCH', 'job_database', {
      query: { code_job: 'eq.' + code },
      body: { status },
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true, job: await getJobMapped(code) };
  } catch (e) {
    return { success: false, error: 'Gagal ubah status: ' + e.message };
  }
}

async function handleHapusJobData(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const [code] = payload || [];
  if (!code) return { success: false, error: 'Kode loker tidak ditemukan.' };
  try {
    // Tolak hapus bila masih ada kandidat terkait (pesan sama seperti asli).
    // Jalur cepat: query server-side (ada kandidat dengan id_loker_pilihan=code?).
    const adaTerkait = await countCandidatesForJob(code);
    if (adaTerkait === true) {
      return { success: false, error: 'Gagal hapus loker. Mungkin masih ada kandidat terkait.' };
    }
    if (adaTerkait === undefined) {
      // Fallback: scan penuh.
      const cands = await findCandidates();
      const terkait = cands.rows.some((r) => String(r.id_loker_pilihan || '') === String(code));
      if (terkait) {
        return { success: false, error: 'Gagal hapus loker. Mungkin masih ada kandidat terkait.' };
      }
    }
    await supabaseJson('DELETE', 'job_database', {
      query: { code_job: 'eq.' + code },
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true, code };
  } catch (e) {
    return { success: false, error: 'Gagal hapus loker: ' + e.message };
  }
}

async function handleUpdateTahapanDbJob(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const [code, tahapan, status] = payload || [];
  if (!code) return { success: false, error: 'Kode loker tidak ditemukan.' };
  const body: Record<string, unknown> = {};
  if (tahapan !== undefined && tahapan !== null) body.tahapan = tahapan;
  if (status !== undefined && status !== null) body.status = status;
  try {
    await supabaseJson('PATCH', 'job_database', {
      query: { code_job: 'eq.' + code },
      body,
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true, job: await getJobMapped(code) };
  } catch (e) {
    return { success: false, error: 'Gagal update tahapan: ' + e.message };
  }
}

async function handleUpdateDokumenShare(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const [code, joined] = payload || [];
  if (!code) return { success: false, error: 'Kode loker tidak ditemukan.' };
  try {
    await supabaseJson('PATCH', 'job_database', {
      query: { code_job: 'eq.' + code },
      body: { dokumen_share: joined || '' },
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal update dokumen: ' + e.message };
  }
}

async function handleTandaiGagalJob(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const [wa, jobCode] = payload || [];
  if (!wa || !jobCode) return { success: false, error: 'Data tidak lengkap.' };
  cacheClear(); // status kandidat berubah (GAGAL) → buang cache dedupe
  try {
    const row = await findCandidateByWa(wa);
    if (!row) {
      return { success: false, error: 'Kandidat tidak ditemukan.' };
    }
    // Kolom loker bisa id_loker_pilihan ATAU id_loker (skema adaptif).
    const idLoker = toText(pick(row, ['id_loker_pilihan', 'id_loker']));
    if (String(idLoker) !== String(jobCode)) {
      return { success: false, error: 'Kandidat tidak terdaftar di job ini.' };
    }
    await supabaseJson('PATCH', 'database_candidate', {
      query: { id: 'eq.' + row.id },
      body: {
        status_kandidat: 'GAGAL',
        id_loker_pilihan: null,
        updated_at: new Date().toISOString(),
      },
      headers: { Prefer: 'return=minimal' },
    });
    // Sinkronkan mail: lamaran kandidat ikut berstatus GAGAL (tidak menunggu
    // review lagi). Jalur cepat: tarik hanya lamaran WA-nya sendiri.
    let formUpdated = null;
    try {
      let forms = await findFormsByWa(wa);
      if (forms === undefined) forms = await findForms();
      const want = normalizeWa(wa);
      const m = forms.find((r) => normalizeWa(String(r.no_wa || '')) === want) || null;
      if (m && m.id !== undefined) {
        await supabaseJson('PATCH', 'database_asj_form', {
          query: { id: 'eq.' + m.id },
          body: { status: 'GAGAL' },
          headers: { Prefer: 'return=minimal' },
        });
        m.status = 'GAGAL';
        // rowIndex -1 → frontend patchFormMail fallback cari by id.
        formUpdated = mapForm(m, -1);
      }
    } catch (e) {
      /* opsional */
    }
    // PATCH-IN-PLACE: kembalikan kandidat & baris mail hasil update supaya
    // frontend cukup menimpa di memori (tanpa tarik ulang getAppData).
    let candidate = null;
    try {
      const row2 = await findCandidateByWa(wa);
      if (row2 && row2.id !== undefined) {
        candidate = stripRaw([mapCandidate(row2)])[0] || null;
        if (candidate) {
          try {
            await attachBerkasBio([candidate]);
          } catch (e2) {
            /* best-effort */
          }
        }
      }
    } catch (e3) {
      /* best-effort */
    }
    return { success: true, candidate, form: formUpdated };
  } catch (e) {
    return { success: false, error: 'Gagal tandai gagal: ' + e.message };
  }
}

export {
  handleSimpanJobBaru,
  handleEditLokerFull,
  handleUbahStatusJob,
  handleHapusJobData,
  handleUpdateTahapanDbJob,
  handleUpdateDokumenShare,
  handleTandaiGagalJob,
};
