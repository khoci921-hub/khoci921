import bcrypt from 'bcryptjs';
import {
  hasBackend,
  normalizeWa,
  pick,
  supabaseJson,
  supabaseUpsert,
  supabaseUrl,
  toText,
} from './db/client';
import { findJobByCodeFiltered, findJobs } from './db/jobs';
import { findForms, findFormsByWa, upsertFormRow } from './db/forms';
import { findCandidateByWaFiltered, findCandidates, mapCandidate } from './db/candidates';
import * as session from './session';
import { requireRole, isOwnerOrAdmin } from './actions-auth';
import { findMasterByWa } from './actions-master';
import { cacheClear } from './cache';
import { bucket, storageRequest, publicUrl, hapusJenisVarian, uploadBase64 } from './storage';
import { syncFormMailDariUpload } from './actions-mail';
import { nextCandidateId } from './candidate-helpers';
import * as fcm from './fcm-server';
import { notifyAdmins } from './fcm-helpers';
// actions-upload.js — upload & apply (apply-full.html, admin pemberkasan,
// dari actions-extra.js, perilaku TIDAK berubah.

// ---------------------------------------------------------------------------
// Fire-and-forget helper: panggil /ingest function via HTTP.
// Menggantikan dynamic import('./actions-ingest.ts') agar heavy deps
// (pdf-parse, xlsx, mammoth) TIDAK dibundle ke actions-upload.ts.
// ---------------------------------------------------------------------------
function fireIngest(payload: unknown[], sessionToken?: string): void {
  const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  const target = baseUrl ? `${baseUrl}/.netlify/functions/ingest` : '/.netlify/functions/ingest';
  const body = JSON.stringify({ action: 'processUploadDoc', payload, sessionToken });
  // Fire-and-forget: jangan await, jangan block upload response.
  fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
    .then((r) => r.json())
    .then((j) => console.log('[Smart Ingest] result:', JSON.stringify(j).slice(0, 200)))
    .catch((e) => console.warn('[Smart Ingest] HTTP call failed:', e.message));
}

const PUBLIC_PREFILL_FIELDS = new Set([
  'idKandidat',
  'id',
  'nama',
  'wa',
  'gender',
  'usia',
  'tb',
  'bb',
  'tbBb',
  'ttl',
  'pendidikan',
  'pasPhoto',
  'email',
  'tempatLahir',
  'tglLahir',
  'alamat',
  'jftText',
  'sswText',
  'jft',
  'ssw',
  'fileCv',
  'idLoker',
  'tahapan',
  'status',
]);

// true jika session valid: admin (bebas) ATAU kandidat pemilik `wa` tsb.
// Potong objek kandidat (hasil mapCandidate) hanya ke field prefill aman.
function pickPrefill(data) {
  const safe: Record<string, any> = {};
  for (const k of Object.keys(data || {})) {
    if (PUBLIC_PREFILL_FIELDS.has(k)) safe[k] = data[k];
  }
  return safe;
}

// ---------------------------------------------------------------------------
// getUploadUrls — signed upload URL + public URL per file (dipakai frontend
// uploadFilesDirectly di apply-full.html / ai_form.html / js/07_api.js).
// ---------------------------------------------------------------------------
async function handleGetUploadUrls(payload, sessionToken) {
  if (!hasBackend()) return { success: false, error: 'Backend belum dikonfigurasi.' };
  const body = (payload && payload[0]) || payload || {};
  const files = Array.isArray(body.files) ? body.files : [];
  const folder = String(body.folder || 'misc').replace(/^\/+|\/+$/g, '');
  if (files.length === 0) return { success: false, error: 'Tidak ada file untuk diupload.' };
  const urls: Record<string, any> = {};
  try {
    for (const f of files) {
      const key = String(f.key || '').trim();
      if (!key) continue;
      const prefix =
        String(f.prefix || key)
          .trim()
          .replace(/[^a-zA-Z0-9_-]/g, '_') || 'FILE';
      const ext =
        String(f.ext || 'bin')
          .replace(/[^a-z0-9]/gi, '')
          .toLowerCase() || 'bin';
      const path = (folder ? folder + '/' : '') + prefix + '.' + ext;
      // FIX anti-duplikat: hapus varian lama jenis ini sebelum upload baru.
      await hapusJenisVarian(folder, prefix);
      const res = await storageRequest('POST', 'object/upload/sign/' + bucket() + '/' + path, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 120 }),
      });
      const rel = res && res.url ? String(res.url) : '/object/upload/sign/' + bucket() + '/' + path;
      urls[key] = {
        signedUrl:
          supabaseUrl().replace(/\/$/, '') +
          '/storage/v1' +
          (rel.startsWith('/') ? rel : '/' + rel),
        publicUrl: publicUrl(path),
      };
    }
    return { success: true, urls };
  } catch (e) {
    return { success: false, error: 'Gagal membuat link upload. Silakan coba lagi.' };
  }
}

// ---------------------------------------------------------------------------
// Apply publik (apply-full.html)
// ---------------------------------------------------------------------------
const APPLY_WA_COLS = ['no_wa', 'wa', 'whatsapp'];

async function findFormByWa(wa) {
  const want = normalizeWa(wa);
  // Jalur cepat: tarik hanya lamaran WA ini, bukan scan 500 baris inbox.
  let rows = await findFormsByWa(wa);
  if (rows === undefined) rows = await findForms();
  return rows.find((r) => normalizeWa(String(r.no_wa || r.wa || '')) === want) || null;
}

// Cari lamaran per (WA + kode job) — kandidat boleh punya BANYAK lamaran
// untuk job berbeda; tiap kombinasi WA+job punya SATU baris di mail.
async function findFormByWaJob(wa, code) {
  const want = normalizeWa(wa);
  // Jalur cepat: tarik hanya lamaran WA ini, bukan scan 500 baris inbox.
  let rows = await findFormsByWa(wa);
  if (rows === undefined) rows = await findForms();
  return (
    rows.find(
      (r) =>
        normalizeWa(String(r.no_wa || r.wa || '')) === want &&
        String(r.code_job || '').trim() === String(code || '').trim(),
    ) || null
  );
}

// cekDataPelamar([wa]) → { found, nama, gender, usia, tb, bb, pasPhoto,
// jftUrl, sswUrl, applications } — applications = SEMUA lamaran WA (multi-apply),
// dipakai apply-full.html untuk menampilkan peringatan kalau sudah LULUS job lain.
async function handleCekDataPelamar(payload) {
  const wa = String((payload && payload[0]) || '');
  if (!wa) return { found: false, applications: [] };
  try {
    // Jalur cepat: tarik hanya lamaran WA ini, bukan scan 500 baris inbox.
    let rows = await findFormsByWa(wa);
    if (rows === undefined) rows = await findForms();
    const want = normalizeWa(wa);
    const apps = rows
      .filter((r) => normalizeWa(String(r.no_wa || r.wa || '')) === want)
      .map((r) => ({
        code: toText(r.code_job || ''),
        status: toText(r.status || 'MENUNGGU'),
        timestamp: toText(r.timestamp || r.created_at || ''),
      }))
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const myRows = rows.filter((r) => normalizeWa(String(r.no_wa || r.wa || '')) === want);
    if (!myRows.length) {
      // Fallback ke database_candidate: kandidat mungkin ditambah admin
      // (punya photo/CV/JFT di database_candidate) tapi belum pernah apply.
      try {
        const cands = await findCandidates();
        const candRow = (Array.isArray(cands?.rows) ? cands.rows : []).find(
          (r) => normalizeWa(String(pick(r, ['no_wa', 'wa', 'whatsapp']) || '')) === want,
        );
        if (candRow) {
          const cPhoto = toText(pick(candRow, ['pas_photo', 'pasPhoto', 'photo']));
          const cJft = toText(pick(candRow, ['jft', 'file_jft']));
          const cSsw = toText(pick(candRow, ['ssw', 'file_ssw']));
          return {
            found: true,
            nama: toText(pick(candRow, ['nama_lengkap', 'nama'])),
            gender: toText(pick(candRow, ['gender', 'jenis_kelamin'])),
            usia: toText(pick(candRow, ['usia', 'umur'])),
            tb: toText(pick(candRow, ['tb'])),
            bb: toText(pick(candRow, ['bb'])),
            pasPhoto: cPhoto && cPhoto !== '-' ? cPhoto : '-',
            photoUrl: cPhoto && cPhoto !== '-' ? cPhoto : '-',
            jftUrl: cJft && cJft !== '-' ? cJft : '-',
            sswUrl: cSsw && cSsw !== '-' ? cSsw : '-',
            email: toText(pick(candRow, ['email'])),
            applications: apps,
          };
        }
      } catch {
        /* non-fatal */
      }
      return { found: false, applications: apps };
    }

    // Scan SEMUA baris lamaran kandidat — ambil nilai non-empty terbaru
    // untuk tiap field. Sebelumnya hanya mengambil dari baris PERTAMA
    // (rows.find), jadi kalau baris pertama kosong (job lama tidak
    // mewajibkan JFT/SSW/foto), auto-fill gagal padahal file sudah ada
    // di lamaran lain. Sekarang konsisten dengan extraFilesMap yang juga
    // scan semua baris.
    const first = myRows[0];
    const pickFirstNonEmpty = (fields) => {
      for (const r of myRows) {
        const v = toText(pick(r, fields));
        if (v && v !== '-' && v !== 'null' && v !== 'undefined') return v;
      }
      return '-';
    };
    const bestPasPhoto = pickFirstNonEmpty(['pas_photo', 'pasPhoto', 'photo']);
    const bestJft = pickFirstNonEmpty(['jft', 'jft_url']);
    const bestSsw = pickFirstNonEmpty(['ssw', 'ssw_url']);

    const extraFilesMap: Record<string, any> = {};
    myRows.forEach((r) => {
      const ket = toText(pick(r, ['keterangan'])) || '';
      ket.split(';').forEach((p) => {
        const parts = p.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim().toUpperCase();
          const val = parts.slice(1).join(':').trim();
          if (key && val.startsWith('http') && !extraFilesMap[key]) {
            extraFilesMap[key] = val;
          }
        }
      });
    });

    // Fallback ke database_candidate jika database_asj_form tidak punya photo.
    // Kasus: kandidat ditambah admin (photo di database_candidate) tapi belum
    // pernah apply → cekDataPelamar hanya baca database_asj_form → photo '-'.
    let finalPhoto = bestPasPhoto;
    let finalJft = bestJft;
    let finalSsw = bestSsw;

    // Cari email + photo/JFT/SSW dari database_candidate (database_asj_form tidak punya kolom email).
    let finalEmail = '';
    try {
      const cands = await findCandidates();
      const candRow = (Array.isArray(cands?.rows) ? cands.rows : []).find(
        (r) => normalizeWa(String(pick(r, ['no_wa', 'wa', 'whatsapp']) || '')) === want,
      );
      if (candRow) {
        finalEmail = toText(pick(candRow, ['email']));
        if (finalPhoto === '-') {
          const cPhoto = toText(pick(candRow, ['pas_photo', 'pasPhoto', 'photo']));
          if (cPhoto && cPhoto !== '-') finalPhoto = cPhoto;
        }
        if (finalJft === '-') {
          const cJft = toText(pick(candRow, ['jft', 'file_jft']));
          if (cJft && cJft !== '-') finalJft = cJft;
        }
        if (finalSsw === '-') {
          const cSsw = toText(pick(candRow, ['ssw', 'file_ssw']));
          if (cSsw && cSsw !== '-') finalSsw = cSsw;
        }
      }
    } catch {
      /* fallback non-fatal */
    }
    return {
      found: true,
      nama: toText(pick(first, ['nama_lengkap', 'nama'])),
      gender: toText(pick(first, ['gender', 'jenis_kelamin'])),
      usia: toText(pick(first, ['usia', 'umur'])),
      tb: toText(pick(first, ['tb'])),
      bb: toText(pick(first, ['bb'])),
      pasPhoto: finalPhoto,
      photoUrl: finalPhoto,
      jftUrl: finalJft,
      sswUrl: finalSsw,
      email: finalEmail,
      applications: apps,
    };
  } catch (e) {
    return { found: false, applications: [] };
  }
}

// isJobRequiresCv([code]) — dipakai apply-full.html via api-client.
async function handleIsJobRequiresCv(payload) {
  const code = String((payload && payload[0]) || '');
  try {
    // Jalur cepat: cari baris job via query server-side (filter code_job).
    let job = await findJobByCodeFiltered(code);
    if (job === undefined) {
      const found = await findJobs();
      job = found.rows.find((r) => String(pick(r, ['code_job', 'code']) || '') === code) || null;
    }
    if (!job) return { success: false, error: 'Kode loker tidak ditemukan.' };
    const share = String(pick(job, ['dokumen_share', 'format_cv']) || '').toUpperCase();
    return { success: true, requiresCv: share.includes('CV') };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// submitApply([payload]) → simpan/update lamaran di database_asj_form.
async function handleSubmitApply(payload) {
  cacheClear(); // lamaran baru masuk → inbox/kandidat berubah
  const d = (payload && payload[0]) || {};
  const wa = normalizeWa(String(d.wa || ''));
  const code = String(d.job || '').trim();
  if (!wa || !code || !d.nama) return { success: false, message: 'Data lamaran tidak lengkap.' };
  try {
    // Validasi loker & kelengkapan dokumen sesuai model (dokumen_share).
    // Jalur cepat: cari baris job via query server-side (filter code_job).
    let job = await findJobByCodeFiltered(code);
    if (job === undefined) {
      const found = await findJobs();
      job = found.rows.find((r) => String(pick(r, ['code_job', 'code']) || '') === code) || null;
    }
    if (!job) return { success: false, message: 'Kode loker tidak ditemukan: ' + code };
    const share = String(pick(job, ['dokumen_share']) || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const have = new Set();
    if (d.cvFile || d.oldCv) have.add('CV');
    if (d.jftFile || d.oldJft) have.add('JFT');
    if (d.sswFile || d.oldSsw) have.add('SSW');
    (d.extraFiles || []).forEach((x) => have.add(String((x && x.name) || '').toUpperCase()));
    const missing = share.filter(
      (req) => !have.has(req) && !['CV', 'JFT', 'SSW'].includes(req) && req !== '-',
    );
    const missingCore = share.filter((req) => ['CV', 'JFT', 'SSW'].includes(req) && !have.has(req));
    if (missingCore.length || missing.length) {
      return {
        success: false,
        message: 'Berkas belum lengkap. Harap upload: ' + [...missingCore, ...missing].join(', '),
      };
    }

    // D. kategory otomatis dari bidang loker (kolom kategori/bidang/sektor)
    // kalau form tidak membawa ?bidang= — supaya mail tidak semua tampil
    // "Umum" di panel admin.
    const jobBidang = String(pick(job, ['kategori', 'category', 'bidang', 'sektor']) || '');
    const body = {
      timestamp: new Date().toISOString(),
      code_job: code,
      kategory: String(d.bidang || jobBidang || ''),
      nama_lengkap: String(d.nama || '')
        .trim()
        .toUpperCase(),
      no_wa: wa,
      email: String(d.email || '').trim(),
      gender: String(d.gender || ''),
      usia: String(d.usia || ''),
      tb: String(d.tb || ''),
      bb: String(d.bb || ''),
      pas_photo: d.photoFile || d.oldPhoto || '',
      jft: d.jftFile || d.oldJft || '',
      ssw: d.sswFile || d.oldSsw || '',
      file_cv: d.cvFile || d.oldCv || '',
      status: 'MENUNGGU',
      keterangan: (d.extraFiles || [])
        .map((x) => String((x && x.name) || '') + ':' + String((x && x.url) || ''))
        .join(';'),
    };

    // Dedup per (WA + job): job SAMA -> update baris lamaran itu; job BEDA
    // -> buat baris BARU (kandidat boleh melamar banyak loker).
    const existing = await findFormByWaJob(wa, code);
    if (existing && existing.id !== undefined) {
      await supabaseJson('PATCH', 'database_asj_form', {
        query: { id: 'eq.' + existing.id },
        body,
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      // Upsert anti-duplikat (no_wa, code_job) — aman dari race GET-then-POST
      // (dua lamaran paralel untuk WA+job sama tidak bikin baris dobel).
      await upsertFormRow(body);
    }

    // Sync photo/JFT/SSW/CV dari lamaran ke database_candidate (profile kandidat).
    // Tanpa sync ini, ALL_CANDIDATES (yang baca database_candidate) tidak punya
    // photo/JFT/SSW → Digital CV mini dan share view tampil kosong.
    // Sync HANYA jika nilai baru tidak kosong — jangan timpa data yang sudah ada
    // dari upload sebelumnya (pemberkasan/admin).
    try {
      const candRow = await findCandidateByWaFiltered(wa);
      if (candRow && candRow.id !== undefined) {
        const candPatch: Record<string, any> = {};
        const photoVal = String(body.pas_photo || '').trim();
        if (photoVal && photoVal !== '-') candPatch.pas_photo = photoVal;
        const jftVal = String(body.jft || '').trim();
        if (jftVal && jftVal !== '-') candPatch.jft = jftVal;
        const sswVal = String(body.ssw || '').trim();
        if (sswVal && sswVal !== '-') candPatch.ssw = sswVal;
        const cvVal = String(body.file_cv || '').trim();
        if (cvVal && cvVal !== '-') candPatch.file_cv = cvVal;
        if (Object.keys(candPatch).length) {
          await supabaseJson('PATCH', 'database_candidate', {
            query: { id: 'eq.' + candRow.id },
            body: candPatch,
            headers: { Prefer: 'return=minimal' },
          });
        }
      }
    } catch {
      /* sync ke database_candidate non-fatal — jangan gagalkan lamaran */
    }

    // Carry-over dokumen TSK dari lamaran loker (KTP/KK/ijazah/universitas) ke
    // kolom master_database_candidate (*_url). Saat kandidat LOLOS ke
    // pemberkasan, BERKAS_COLUMNS (db/berkas.js) fallback ke kolom master ini
    // → dokumen sudah terlihat tanpa upload ulang. Kalau admin minta dokumen
    // baru, kandidat upload di pemberkasan → pemberkasan_checklist MENIMPA
    // fallback master (urutan kolom di BERKAS_COLUMNS: checklist dulu).
    // Opsional & non-fatal: gagal di sini tidak menggagalkan lamaran.
    try {
      const mRow = await findMasterByWa(wa);
      if (mRow && mRow.id !== undefined) {
        const masterPatch: Record<string, any> = {};
        (d.extraFiles || []).forEach((x) => {
          const label = String((x && x.name) || '')
            .trim()
            .toUpperCase();
          const url = String((x && x.url) || '').trim();
          if (!label || !url) return;
          const map = fileLabelKey(label) ? FILE_LABEL_COLUMNS[fileLabelKey(label)] : null;
          if (map && map.master) masterPatch[map.master] = url;
        });
        if (Object.keys(masterPatch).length) {
          await supabaseJson('PATCH', 'master_database_candidate', {
            query: { id: 'eq.' + mRow.id },
            body: masterPatch,
            headers: { Prefer: 'return=minimal' },
          });
        }
      }
    } catch (e) {
      /* carry-over opsional — jangan gagalkan lamaran */
    }

    // --- PUSH NOTIFICATION KE ADMIN ---
    // Jangan biarkan error notif membatalkan submit
    try {
      notifyAdmins(
        'Lamaran Baru!',
        `${d.nama || 'Kandidat'} baru saja melamar posisi ${code}.`,
        '/admin.html',
      );
    } catch (_) {}
    // ----------------------------------

    // --- SMART INGESTION (silent, fire-and-forget) ---
    // Ekstrak teks dari CV/JFT/SSW/extras → AI rapikan → upsert master.
    // Hanya dokumen teks (PDF/DOCX/XLSX/CSV/TXT), bukan foto.
    const PARSEABLE_EXTS = new Set(['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt']);
    const ingestFiles = [];
    const collectIngest = (fileUrl, label) => {
      if (!fileUrl) return;
      const ext = String(fileUrl).split('.').pop().split('?')[0].toLowerCase();
      if (PARSEABLE_EXTS.has(ext)) ingestFiles.push({ fileUrl, fileType: ext });
    };
    collectIngest(d.cvFile || d.oldCv, 'CV');
    collectIngest(d.jftFile || d.oldJft, 'JFT');
    collectIngest(d.sswFile || d.oldSsw, 'SSW');
    (d.extraFiles || []).forEach((x) => collectIngest(x && x.url, x && x.name));
    if (ingestFiles.length && wa) {
      // handleSubmitApply adalah endpoint publik (tanpa sessionToken)
      fireIngest(
        ingestFiles.map((f) => ({ ...f, wa })),
        undefined,
      );
    }

    return { success: true, message: 'Lamaran berhasil dikirim. Terima kasih.' };
  } catch (e) {
    return { success: false, message: 'Gagal simpan lamaran: ' + e.message };
  }
}

// getExistingCandidateJsonByWa([wa]) — data lengkap pelamar (untuk edit ulang).
// REVIEW M2: tanpa sesi valid → hanya field prefill (NIK, paspor, catatan
// internal, folder, dsb. TIDAK ikut); dengan sesi admin/pemilik WA → penuh.
async function handleGetExistingCandidateJsonByWa(payload, sessionToken) {
  const wa = String((payload && payload[0]) || '');
  try {
    // Jalur cepat: cari baris kandidat via query server-side (filter WA).
    let row = await findCandidateByWaFiltered(wa);
    if (row === undefined) {
      const found = await findCandidates();
      const want = normalizeWa(wa);
      row =
        found.rows.find((r) => normalizeWa(String(pick(r, APPLY_WA_COLS) || '')) === want) || null;
    }
    if (!row) return { success: false, error: 'Kandidat tidak ditemukan.' };
    const data = mapCandidate(row);
    if (isOwnerOrAdmin(sessionToken, wa)) return { success: true, data };
    return { success: true, data: pickPrefill(data), limited: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Admin: tambah kandidat manual + upload berkas + revisi
// ---------------------------------------------------------------------------

const FILE_LABEL_COLUMNS = {
  PAS_PHOTO: { cand: 'pas_photo', master: 'pas_photo', pemberkasan: null },
  CV: { cand: 'file_cv', master: 'file_cv', pemberkasan: null },
  CV_REVISI: { cand: 'file_cv', master: 'file_cv', pemberkasan: null },
  JFT: { cand: 'jft', master: 'jft_url', pemberkasan: null },
  SSW: { cand: 'ssw', master: 'ssw_url', pemberkasan: null },
  KTP: { cand: null, master: 'ktp_url', pemberkasan: 'ktp_url' },
  'KARTU KELUARGA': { cand: null, master: 'kk_url', pemberkasan: 'kk_url' },
  KK: { cand: null, master: 'kk_url', pemberkasan: 'kk_url' },
  'IJAZAH SD': { cand: null, master: 'ijazah_sd_url', pemberkasan: 'sd_url' },
  'IJAZAH SMP': { cand: null, master: 'ijazah_smp_url', pemberkasan: 'smp_url' },
  'IJAZAH SMA': { cand: null, master: 'ijazah_sma_url', pemberkasan: 'sma_url' },
  UNIVERSITAS: { cand: null, master: 'univ_url', pemberkasan: 'univ_url' },
  AKTE: { cand: null, master: null, pemberkasan: 'akte_url' },
  PASPORT: { cand: null, master: null, pemberkasan: 'pasport_url' },
  PASSPORT: { cand: null, master: null, pemberkasan: 'pasport_url' },
  MCU: { cand: null, master: null, pemberkasan: 'mcu_url' },
  KONTRAK: { cand: null, master: null, pemberkasan: 'kontrak_url' },
  SERTIFIKAT: { cand: null, master: null, pemberkasan: 'cert_url' },
  'FOTO 2X3': { cand: null, master: null, pemberkasan: 'foto2_url' },
  'IZIN ORTU': { cand: null, master: null, pemberkasan: 'ijinortu_url' },
  CPMI: { cand: null, master: null, pemberkasan: 'cpmi_url' },
  'BUKU NIKAH': { cand: null, master: null, pemberkasan: 'kawin_url' },
  'SURAT SEHAT': { cand: null, master: null, pemberkasan: 'sehat_url' },
  BPJS: { cand: null, master: null, pemberkasan: 'bpjs_url' },
  PSIKOTES: { cand: null, master: null, pemberkasan: 'psikotes_url' },
};

function fileLabelKey(label) {
  const l = String(label || '')
    .trim()
    .toUpperCase();
  return FILE_LABEL_COLUMNS[l] ? l : null;
}

// simpanKandidatDanUpload([data]) — admin tambah kandidat manual + upload.
async function handleSimpanKandidatDanUpload(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  cacheClear(); // kandidat/berkas baru → buang cache dedupe
  const d = (payload && payload[0]) || {};
  const wa = normalizeWa(String(d.wa || ''));
  if (!d.nama || !wa) return { success: false, error: 'Nama dan nomor WA wajib diisi.' };
  // Validasi format WA Indonesia: 62 + 10/11 digit (12-13 total). Nomor yang
  // lebih pendek (mis. 62135812198 — kehilangan 1 digit "8") atau lebih panjang
  // jelas salah ketik; menolak di sini mencegah lahirnya kandidat duplikat.
  if (wa.length < 12 || wa.length > 13) {
    return {
      success: false,
      error:
        'Nomor WA tidak valid (' +
        wa +
        '). Harus 62 + 10/11 digit (total 12-13 digit). Periksa nomor kembali.',
    };
  }
  try {
    const nama = String(d.nama).trim().toUpperCase();
    // CEGAH DUPLIKAT: kalau WA sudah punya baris kandidat, perbarui baris itu
    // (id_kandidat, password, tahapan/status tetap) — jangan membuat baris baru.
    let existing = null;
    try {
      existing = await findCandidateByWaFiltered(wa);
    } catch {
      /* kolom WA tidak dikenal query filter → fallback scan */
    }
    if (!existing) {
      try {
        const found = await findCandidates();
        existing =
          found.rows.find(
            (r) =>
              normalizeWa(
                pick(r, ['no_wa', 'wa', 'whatsapp', 'telepon', 'phone', 'no_hp']) || '',
              ) === wa,
          ) || null;
      } catch {
        existing = null;
      }
    }
    const idKand = existing
      ? String(pick(existing, ['id_kandidat', 'id']) || '')
      : await nextCandidateId();
    const folder = 'master/' + nama.replace(/[^A-Z0-9_-]/g, '_');
    const uploaded = [];

    const files = Array.isArray(d.files) ? d.files : [];
    const fileUrls: Record<string, any> = {};
    for (const f of files) {
      if (!f) continue;
      const label = String(f.label || '').toUpperCase();
      // Jalur Cloudinary (2026-08-17): URL string dari browser langsung dipakai;
      // base64 (jalur lama) tetap didukung sebagai fallback.
      let url = String(f.url || '').trim();
      if (!url && f.data) {
        const ext =
          String(f.name || 'file')
            .split('.')
            .pop() || 'jpg';
        url = await uploadBase64(f.data, folder, (label || 'FILE') + '.' + ext);
      }
      if (url) {
        fileUrls[label] = url;
        uploaded.push(label);
      }
    }

    const now = new Date().toISOString();
    const pass = wa.slice(-4);
    const hash = bcrypt.hashSync(pass, 10);
    const candBody = {
      id_kandidat: idKand,
      nama_lengkap: nama,
      gender: String(d.gender || ''),
      usia: String(d.usia || ''),
      tb: String(d.tb || ''),
      bb: String(d.bb || ''),
      pendidikan: String(d.pendidikan || ''),
      no_wa: wa,
      id_loker_pilihan: String(d.loker || ''),
      tahapan_seleksi: 'LIST',
      status_kandidat: '',
      tanggal_daftar: now,
      pas_photo: fileUrls.PAS_PHOTO || '',
      jft: fileUrls.JFT || '',
      ssw: fileUrls.SSW || '',
      file_cv: fileUrls.CV || '',
      password_kandidat: hash,
      password_diubah: false,
      created_at: now,
      updated_at: now,
    };
    const masterBody = {
      id_kandidat: idKand,
      nama_lengkap: nama,
      gender: candBody.gender,
      usia: candBody.usia,
      tb: candBody.tb,
      bb: candBody.bb,
      no_wa: wa,
      pas_photo: candBody.pas_photo,
      jft_url: fileUrls.JFT || '',
      ssw_url: fileUrls.SSW || '',
      file_cv: fileUrls.CV || '',
    };
    const formBody = {
      timestamp: now,
      code_job: String(d.loker || ''),
      nama_lengkap: nama,
      no_wa: wa,
      gender: candBody.gender,
      usia: candBody.usia,
      tb: candBody.tb,
      bb: candBody.bb,
      pas_photo: candBody.pas_photo,
      jft: fileUrls.JFT || '',
      ssw: fileUrls.SSW || '',
      file_cv: fileUrls.CV || '',
      status: 'MENUNGGU',
    };

    if (existing && existing.id !== undefined) {
      // Update baris kandidat yang sudah ada: hanya data profil + dokumen.
      // Password, tanggal daftar, tahapan/status, id_kandidat TIDAK diubah.
      const upd = Object.assign({}, candBody);
      delete upd.id_kandidat;
      delete upd.password_kandidat;
      delete upd.password_diubah;
      delete upd.tanggal_daftar;
      delete upd.tahapan_seleksi;
      delete upd.status_kandidat;
      delete upd.created_at;
      await supabaseJson('PATCH', 'database_candidate', {
        query: { id: 'eq.' + existing.id },
        body: upd,
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      // Upsert anti-duplikat (no_wa): dua input paralel utk WA yang sama
      // tidak bikin 2 baris kandidat.
      await supabaseUpsert('database_candidate', candBody, ['no_wa'], {
        headers: { Prefer: 'return=minimal' },
      });
    }
    // Master & mail: upsert per WA (jangan menumpuk baris duplikat).
    const mRow = await findMasterByWa(wa);
    if (mRow && mRow.id !== undefined) {
      await supabaseJson('PATCH', 'master_database_candidate', {
        query: { id: 'eq.' + mRow.id },
        body: Object.assign({}, masterBody, { updated_at: now }),
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      // Upsert anti-duplikat (no_wa): 1 master CV per kandidat.
      await supabaseUpsert(
        'master_database_candidate',
        Object.assign({ created_at: now, updated_at: now }, masterBody),
        ['no_wa'],
        { headers: { Prefer: 'return=minimal' } },
      );
    }
    const fRow = await findFormByWa(wa);
    if (fRow && fRow.id !== undefined) {
      await supabaseJson('PATCH', 'database_asj_form', {
        query: { id: 'eq.' + fRow.id },
        body: Object.assign({}, formBody, { updated_at: now }),
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      // Upsert anti-duplikat — dua tambah kandidat paralel untuk WA yang
      // belum punya baris mail tidak bikin baris dobel.
      await upsertFormRow(Object.assign({ created_at: now, updated_at: now }, formBody));
    }
    // --- SMART INGESTION (silent, fire-and-forget) ---
    // Ekstrak teks dari semua file yang bisa di-parse → AI rapikan → upsert master.
    const PARSEABLE_EXTS = new Set(['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt']);
    const ingestFiles = [];
    for (const f of files) {
      if (!f) continue;
      const fUrl = String(f.url || '').trim();
      if (!fUrl) continue;
      const ext = fUrl.split('.').pop().split('?')[0].toLowerCase();
      if (PARSEABLE_EXTS.has(ext)) ingestFiles.push({ fileUrl: fUrl, fileType: ext });
    }
    if (ingestFiles.length && wa) {
      fireIngest(
        ingestFiles.map((f) => ({ ...f, wa })),
        sessionToken,
      );
    }
    return { success: true, uploaded };
  } catch (e) {
    return { success: false, error: 'Gagal simpan kandidat: ' + e.message };
  }
}

// simpanBerkasTahapan([{wa, nama, jenisBerkas, file}]) — upload dokumen
// pemberkasan / file utama kandidat. Dipakai admin (modal edit/pemberkasan)
// DAN kandidat (upload berkas sendiri dari dashboard).
// ---------------------------------------------------------------------------
async function handleSimpanBerkasTahapan(payload, sessionToken) {
  cacheClear(); // berkas tahapan berubah → buang cache dedupe
  const d = (payload && payload[0]) || {};
  const t = session.verifyToken(sessionToken);
  if (!t || (t.role !== 'admin' && t.role !== 'kandidat')) {
    return { success: false, sessionInvalid: true, message: 'Sesi tidak valid' };
  }
  if (t.role === 'kandidat') {
    const dWa = normalizeWa(String(d.wa || ''));
    if (dWa && normalizeWa(String(t.wa || '')) !== dWa) {
      return { success: false, error: 'Nomor WA tidak sesuai sesi.' };
    }
  }
  const wa = normalizeWa(String(d.wa || ''));
  const jenis = String(d.jenisBerkas || '')
    .trim()
    .toUpperCase();
  const f = d.file || {};
  // Jalur Cloudinary (2026-08-17): file diupload LANGSUNG dari browser,
  // backend tidak lagi memproses file fisik — cukup ekstrak URL string dari
  // payload JSON lalu update ke kolom dokumen. Base64 (jalur lama) tetap
  // didukung sebagai fallback untuk klien yang belum dimigrasi.
  const directUrl = String(d.fileUrl || (f && f.url) || '').trim();
  if (!wa || (!directUrl && !f.data)) return { success: false, error: 'Data tidak lengkap.' };
  try {
    const nama = String(d.nama || 'KANDIDAT')
      .trim()
      .toUpperCase();
    const folder = 'master/' + nama.replace(/[^A-Z0-9_-]/g, '_');
    const ext =
      String(f.name || 'file')
        .split('.')
        .pop() || 'jpg';

    // CV per loker: nama file memakai kode job utama kandidat (konvensi sama
    // dengan apply-full: JOB<code>_CV) supaya CV loker lama & baru tersimpan
    // berdampingan di folder master/<NAMA> dan tidak saling menimpa.
    let fileName = (jenis || 'DOKUMEN') + '.' + ext;
    const isCv = jenis === 'CV' || jenis === 'CV_REVISI';
    let candRow = null;
    const want = normalizeWa(wa);
    try {
      // Jalur cepat: cari baris kandidat via query server-side (filter WA).
      candRow = await findCandidateByWaFiltered(wa);
      if (candRow === undefined) {
        const candFound = await findCandidates();
        candRow =
          candFound.rows.find((r) => normalizeWa(String(pick(r, APPLY_WA_COLS) || '')) === want) ||
          null;
      }
    } catch (e) {
      /* lookup kandidat non-fatal */
    }
    if (isCv && candRow) {
      const jobCode = String(pick(candRow, ['id_loker_pilihan', 'id_loker']) || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '_');
      if (jobCode) fileName = 'JOB' + jobCode + '_CV.' + ext;
    }

    let url = directUrl;
    if (!url) {
      url = await uploadBase64(f.data, folder, fileName);
      if (!url) return { success: false, error: 'Upload gagal.' };
    }

    // MAIL = upload-driven: upload berkas → masuk mail inbox (untuk review),
    // menampilkan dokumen yang di-upload beserta preview-nya. Baris dipilih
    // per (WA + loker utama kandidat) untuk CV; dokumen lain ikut ke semua
    // lamaran — multi-apply tidak salah baris.
    try {
      await syncFormMailDariUpload(
        wa,
        nama,
        jenis,
        url,
        candRow ? String(pick(candRow, ['id_loker_pilihan', 'id_loker']) || '') : '',
      );
    } catch (e) {
      /* sinkronisasi mail opsional — jangan gagalkan upload */
    }

    const labelKey = fileLabelKey(jenis);
    const map = labelKey ? FILE_LABEL_COLUMNS[labelKey] : null;
    if (map) {
      const c = candRow;
      if (c && c.id !== undefined && map.cand) {
        await supabaseJson('PATCH', 'database_candidate', {
          query: { id: 'eq.' + c.id },
          body: { [map.cand]: url },
          headers: { Prefer: 'return=minimal' },
        });
      }
      const m = await findMasterByWa(wa);
      if (m && m.id !== undefined && map.master) {
        await supabaseJson('PATCH', 'master_database_candidate', {
          query: { id: 'eq.' + m.id },
          body: { [map.master]: url },
          headers: { Prefer: 'return=minimal' },
        });
      }
      if (map.pemberkasan) {
        // UPSERT by (wa, tahap): kandidat meng-upload KTP & KK secara PARALEL
        // (Promise.allSettled di frontend) — GET-then-POST bikin dua baris.
        // Konflik unik (wa,tahap) di-resolve di sisi DB, jadi selalu 1 baris.
        await supabaseJson('POST', 'pemberkasan_checklist', {
          query: { on_conflict: 'wa,tahap' },
          body: {
            wa: wa,
            nama_lengkap: nama,
            tahap: 1,
            updated_at: new Date().toISOString(),
            [map.pemberkasan]: url,
          },
          headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        });
      }
    }
    // --- SMART INGESTION (silent, fire-and-forget) ---
    // Setelah file ter-upload, ekstrak teks lokal → AI rapikan → upsert master.
    // Hanya untuk dokumen teks (PDF/DOCX/XLSX/CSV/TXT), bukan foto.
    // Tidak menunggu hasil — parse berjalan di belakang, admin/kandidat tidak tahu.
    const PARSEABLE_EXTS = new Set(['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt']);
    const fileExt = ext.toLowerCase();
    if (PARSEABLE_EXTS.has(fileExt) && url && wa) {
      fireIngest([{ fileUrl: url, fileType: fileExt, wa }], sessionToken);
    }
    // --- PUSH NOTIFICATION KE ADMIN: BERKAS BARU ---
    try {
      notifyAdmins(
        'Berkas Baru!',
        `${nama || 'Kandidat'} mengunggah ${jenis || 'dokumen'}.`,
        '/admin.html',
      );
    } catch (_) {}
    // ------------------------------------------------

    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal menyimpan berkas. Silakan coba lagi.' };
  }
}

// simpanRevisiKandidat([wa, fileData]) — kandidat upload CV revisi.
async function handleSimpanRevisiKandidat(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'kandidat');
  if (guard.error) return guard.error;
  cacheClear(); // revisi kandidat → buang cache dedupe
  const wa = String((payload && payload[0]) || '');
  const f = (payload && payload[1]) || {};
  // Jalur Cloudinary (2026-08-17): URL string dari browser dipakai langsung;
  // base64 (jalur lama) tetap didukung sebagai fallback.
  const directUrl = String(f.url || f.fileUrl || '').trim();
  if (!wa || (!directUrl && !f.data)) return { success: false, error: 'Data tidak lengkap.' };
  try {
    const row = await findMasterByWa(wa);
    const nama = row && row.nama_lengkap ? String(row.nama_lengkap).toUpperCase() : 'KANDIDAT';
    const folder = 'master/' + nama.replace(/[^A-Z0-9_-]/g, '_');
    const ext =
      String(f.name || 'file')
        .split('.')
        .pop() || 'jpg';
    // CV revisi juga memakai prefix loker utama (konvensi JOB<code>_CV) supaya
    // versi CV per loker tetap utuh di folder kandidat.
    let fileName = 'CV_REVISI.' + ext;
    let cvJobCode = '';
    try {
      // Jalur cepat: cari baris kandidat via query server-side (filter WA).
      let candRow = await findCandidateByWaFiltered(wa);
      if (candRow === undefined) {
        const candFound = await findCandidates();
        const want = normalizeWa(wa);
        candRow =
          candFound.rows.find((r) => normalizeWa(String(pick(r, APPLY_WA_COLS) || '')) === want) ||
          null;
      }
      if (candRow) {
        const jobCode = String(pick(candRow, ['id_loker_pilihan', 'id_loker']) || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, '_');
        if (jobCode) fileName = 'JOB' + jobCode + '_CV.' + ext;
        cvJobCode = jobCode;
      }
    } catch (e) {
      /* lookup kandidat non-fatal */
    }
    let url = directUrl;
    if (!url) {
      url = await uploadBase64(f.data, folder, fileName);
      if (!url) return { success: false, error: 'Upload gagal.' };
    }
    // Upload CV revisi juga masuk mail (dokumen pendukung) — per loker.
    try {
      await syncFormMailDariUpload(wa, nama, 'CV', url, cvJobCode);
    } catch (e) {
      /* opsional */
    }
    // Jalur cepat: cari baris kandidat via query server-side (filter WA).
    let c = await findCandidateByWaFiltered(wa);
    if (c === undefined) {
      const candFound = await findCandidates();
      const want = normalizeWa(wa);
      c =
        candFound.rows.find((r) => normalizeWa(String(pick(r, APPLY_WA_COLS) || '')) === want) ||
        null;
    }
    if (c && c.id !== undefined) {
      await supabaseJson('PATCH', 'database_candidate', {
        query: { id: 'eq.' + c.id },
        body: { file_cv: url },
        headers: { Prefer: 'return=minimal' },
      });
    }
    if (row && row.id !== undefined) {
      await supabaseJson('PATCH', 'master_database_candidate', {
        query: { id: 'eq.' + row.id },
        body: { file_cv: url },
        headers: { Prefer: 'return=minimal' },
      });
    }
    // --- SMART INGESTION (silent, fire-and-forget) ---
    // CV Revisi: ekstrak teks → AI rapikan → upsert master.
    const PARSEABLE_EXTS = new Set(['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt']);
    if (url && PARSEABLE_EXTS.has(ext.toLowerCase()) && wa) {
      fireIngest([{ fileUrl: url, fileType: ext.toLowerCase(), wa }], sessionToken);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal upload revisi: ' + e.message };
  }
}

export {
  handleGetUploadUrls,
  handleCekDataPelamar,
  handleIsJobRequiresCv,
  handleSubmitApply,
  handleGetExistingCandidateJsonByWa,
  handleSimpanKandidatDanUpload,
  handleSimpanBerkasTahapan,
  handleSimpanRevisiKandidat,
  FILE_LABEL_COLUMNS,
  fileLabelKey,
};
