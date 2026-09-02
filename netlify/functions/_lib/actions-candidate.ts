import { normalizeWa, supabaseJson } from './db/client';
import { findForms, findFormsByWaList } from './db/forms';
import { attachApplications, mapCandidate } from './db/candidates';
import { attachBerkasBio } from './db/berkas';
import { requireAdmin } from './actions-auth';
import { findCandidateByWa } from './candidate-helpers';
import { stripRaw, loadCandidatesUnik } from './actions-public';
import { cacheClear } from './cache';
import { syncBiodataKeMail } from './actions-mail';
// actions-candidate.js — kelola kandidat (database_candidate): catatan,
// update super (admin), halaman daftar kandidat. MODUL BARU (Fase 1.1c

async function handleUpdateCatatanKandidat(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const [id, intNote, extNote] = payload || [];
  if (!id) return { success: false, error: 'ID kandidat tidak ditemukan.' };
  // FIX #17: cacheClear SETELAH validasi berhasil.
  cacheClear();
  try {
    await supabaseJson('PATCH', 'database_candidate', {
      query: { id_kandidat: 'eq.' + id },
      body: {
        catatan_internal: intNote || '',
        catatan_external: extNote || '',
      },
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal simpan catatan: ' + e.message };
  }
}

// Label kolom yang boleh diubah admin via modal edit kandidat — dipakai untuk
// ringkasan mail ("[BIODATA] gender, usia diubah") supaya admin tahu bagian
// mana yang berubah, sama seperti update biodata dari sisi kandidat.
const SUPER_MAIL_LABELS = {
  gender: 'gender',
  usia: 'usia',
  tempat_lahir: 'tempat lahir',
  tgl_lahir: 'tgl lahir',
  tb: 'tinggi',
  bb: 'berat',
  nilai_jft_text: 'JFT',
  bidang_ssw_text: 'SSW',
  id_loker_pilihan: 'loker',
};

async function handleUpdateKandidatSuper(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const data = (payload && payload[0]) || {};
  if (!data.wa) return { success: false, error: 'Nomor WA tidak ditemukan.' };
  // FIX #17: cacheClear SETELAH validasi berhasil.
  cacheClear();
  const body = {
    gender: data.gender !== undefined ? data.gender : undefined,
    usia: data.usia !== undefined ? data.usia : undefined,
    tempat_lahir: data.tempatLahir !== undefined ? data.tempatLahir : undefined,
    tgl_lahir: data.tglLahir !== undefined ? data.tglLahir : undefined,
    tb: data.tb !== undefined ? data.tb : undefined,
    bb: data.bb !== undefined ? data.bb : undefined,
    nilai_jft_text: data.jftText !== undefined ? data.jftText : undefined,
    bidang_ssw_text: data.sswText !== undefined ? data.sswText : undefined,
    // Multi-apply: admin bisa set job utama kandidat (id_loker_pilihan).
    id_loker_pilihan:
      data.idLoker !== undefined && data.idLoker !== null ? String(data.idLoker).trim() : undefined,
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  try {
    const row = await findCandidateByWa(data.wa);
    if (!row) return { success: false, error: 'Kandidat tidak ditemukan.' };
    await supabaseJson('PATCH', 'database_candidate', {
      query: { id: 'eq.' + row.id },
      body,
      headers: { Prefer: 'return=minimal' },
    });
    // Ringkasan perubahan ke mail (badge UPDATE + "[BIODATA] …"): hanya field
    // yang nilainya BENAR-BENAR berubah dari baris lama, supaya admin edit
    // kandidat juga tercatat di inbox seperti update biodata dari kandidat.
    try {
      const labels = [];
      for (const k of Object.keys(body)) {
        const label = SUPER_MAIL_LABELS[k];
        if (!label) continue;
        const oldVal = row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : '';
        const newVal = String(body[k] === null || body[k] === undefined ? '' : body[k]).trim();
        if (newVal !== oldVal) labels.push(label);
      }
      if (labels.length) {
        await syncBiodataKeMail(
          data.wa,
          String(row.nama_lengkap || row.nama || 'KANDIDAT'),
          labels,
        );
      }
    } catch (e) {
      /* sync mail opsional — jangan gagalkan update kandidat */
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal update kandidat: ' + e.message };
  }
}

async function handleGetCandidatesPage(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const opts = (payload && payload[0]) || {};
  const page = Number(opts.page) || 1;
  const pageSize = Number(opts.pageSize) || 50;
  try {
    // Konsisten dengan getAppData: dedupe GLOBAL by WA lalu slice halaman —
    // ukuran halaman & total selalu dihitung dari baris UNIK. Jalur cepat:
    // baris ringan untuk dedupe+sort, baris penuh hanya untuk halaman ini.
    const { rows: candRows, total } = await loadCandidatesUnik(opts.q || '', {
      page,
      pageSize,
    });
    const cands = stripRaw(candRows.map(mapCandidate));
    // Fase 3.18: berkas/bio kandidat & lamaran per-WA ditarik PARALEL
    // (independen) — dulu berurutan (2 roundtrip serial). Keduanya sudah
    // catch internal → aman di-Promise.all.
    const waList = cands.map((c) => normalizeWa(String(c.wa || ''))).filter(Boolean);
    let allForms;
    await Promise.all([
      attachBerkasBio(cands),
      findFormsByWaList(waList).then((r) => {
        allForms = r;
      }),
    ]);
    if (allForms === undefined) allForms = await findForms();
    attachApplications(cands, allForms);
    return { success: true, candidates: cands, total };
  } catch (e) {
    return { success: false, error: 'Gagal memuat kandidat: ' + e.message };
  }
}

export { handleUpdateCatatanKandidat, handleUpdateKandidatSuper, handleGetCandidatesPage };
