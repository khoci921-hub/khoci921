import { normalizeWa, pick, supabaseJson, supabaseUrl, toText } from './db/client';
import { findJobByCodeFiltered, findJobs } from './db/jobs';
import { findForms, findFormsByWaList, parseDocs } from './db/forms';
import { findCandidates, findCandidatesByJobFiltered, mapCandidate } from './db/candidates';
import { listStorageFolder, BERKAS_COLUMNS } from './db/berkas';
// actions-share.js — viewer TSK publik (share.html?job=KODE). Dipanggil
// LANGSUNG via GET dari netlify/functions/share-data.js (redirect /api/
// share-data), bukan lewat dispatch POST. MODUL BARU (Fase 1.1d

async function handleShareData(jobCode) {
  const code = String(jobCode || '').trim();
  if (!code) return { error: 'Kode job tidak ditemukan.' };
  try {
    // Jalur cepat: cari baris job via query server-side (filter code_job).
    let jobRow = await findJobByCodeFiltered(code);
    if (jobRow === undefined) {
      const found = await findJobs();
      jobRow = found.rows.find((r) => String(pick(r, ['code_job', 'code']) || '') === code) || null;
    }
    if (!jobRow) return { error: 'Kode job tidak ditemukan: ' + code };
    const name = toText(pick(jobRow, ['pekerjaan', 'nama_pekerjaan', 'judul', 'title']));
    // Kandidat yang ter-approve untuk job ini (id_loker_pilihan berisi kode).
    // Jalur cepat: filter server-side via ilike, lalu verifikasi token eksak di
    // JS (kode bisa banyak dipisah koma) supaya tidak salah tangkap.
    let candRows = await findCandidatesByJobFiltered(code);
    if (candRows === undefined) {
      const cands = await findCandidates();
      candRows = cands.rows;
    }
    const rows = (Array.isArray(candRows) ? candRows : []).filter((r) =>
      String(pick(r, ['id_loker_pilihan', 'id_loker']) || '')
        .split(',')
        .map((s) => s.trim())
        .includes(code),
    );
    const mapped = rows.map(mapCandidate);
    // extraDocs: SEMUA file folder master kandidat (KK/KTP/ijazah/dll) KECUALI
    // yang sudah jadi tombol utama (pas_photo, file_cv, jft, ssw) — persis
    // perilaku backend lama (produksi). Folder = master/<NAMA_HURUF_KAPITAL>/
    // (spasi → underscore), didaftarkan via Supabase Storage list API.
    const storageBase = supabaseUrl().replace(/\/$/, '');
    const pubBase = storageBase + '/storage/v1/object/public/asj-files/';
    // Jalur cepat: tarik lamaran hanya untuk WA kandidat job ini (in-filter),
    // bukan scan 500 baris inbox — cukup untuk membangun byWa extra docs.
    const waList = mapped.map((c) => normalizeWa(String(c.wa || ''))).filter(Boolean);
    let forms = await findFormsByWaList(waList);
    if (forms === undefined) forms = await findForms();
    const byWa = new Map();
    const formsByWa = new Map();
    for (const f of forms) {
      const w = normalizeWa(String(f.no_wa || f.wa || f.whatsapp || ''));
      if (!w) continue;
      if (!byWa.has(w)) byWa.set(w, []);
      for (const d of parseDocs(toText(f.keterangan))) byWa.get(w).push(d);
      if (!formsByWa.has(w)) formsByWa.set(w, []);
      formsByWa.get(w).push(f);
    }
    // Jalur cepat: tarik pemberkasan_checklist + master_database_candidate
    // untuk WA kandidat job ini — dokumen pemberkasan (KK/KTP/ijazah/dll)
    // harus ikut tampil di share view meskipun tidak ada di folder Storage.
    let pemberkasanRows: any[] = [];
    let masterRows: any[] = [];
    try {
      const [pRes, mRes] = await Promise.all([
        waList.length > 0 && waList.length <= 150
          ? supabaseJson('GET', 'pemberkasan_checklist', {
              query: { select: '*', wa: 'in.(' + waList.join(',') + ')' },
            }).catch(() => null)
          : Promise.resolve(null),
        waList.length > 0 && waList.length <= 150
          ? supabaseJson('GET', 'master_database_candidate', {
              query: { select: '*', no_wa: 'in.(' + waList.join(',') + ')' },
            }).catch(() => null)
          : Promise.resolve(null),
      ]);
      pemberkasanRows = Array.isArray(pRes) ? pRes : [];
      masterRows = Array.isArray(mRes) ? mRes : [];
    } catch {
      /* non-fatal */
    }
    const pByWa = new Map();
    for (const r of pemberkasanRows) {
      pByWa.set(normalizeWa(String(r.wa || '')), r);
    }
    const mByWa = new Map();
    for (const r of masterRows) {
      mByWa.set(normalizeWa(String(r.no_wa || r.wa || '')), r);
    }

    // Filter dokumen share: admin toggle di modal Share Loker menentukan
    // dokumen mana yang boleh tampil di share view. 'ALL' = tampilkan semua.
    const rawShareDocs = toText(pick(jobRow, ['dokumen_share', 'dokumenshare'])).toUpperCase();
    const allowedDocTypes = new Set(
      rawShareDocs
        ? rawShareDocs
            .split(/[,;]+/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : ['CV', 'JFT', 'SSW'],
    );
    const showAllDocs = allowedDocTypes.has('ALL');

    const candidates = [];
    for (const c of mapped) {
      const folder =
        'master/' +
        String(c.nama || '')
          .toUpperCase()
          .replace(/\s+/g, '_') +
        '/';
      let names = [];
      try {
        names = await listStorageFolder(folder);
      } catch {
        /* non-fatal: tanpa folder → tanpa tombol ekstra */
      }
      // Tombol utama (pas_photo/file_cv/jft/ssw) sudah tampil — file folder
      // yang TIPENYA sama tidak boleh dobel (mis. CVFILE lama vs baru, atau
      // "1. X_CV.xlsx" lawas vs CVFILE_… baru). CV/JFT/SSW/foto SELALU
      // dianggap tipe utama (punya tombol sendiri), sisanya (KK/KTP/ijazah/
      // passport/dll) jadi tombol ekstra.
      const mainBasenames = [c.pasPhoto, c.fileCv, c.jft, c.ssw]
        .map((u) => {
          try {
            return decodeURIComponent(
              String(u || '')
                .split('/')
                .pop(),
            );
          } catch {
            return String(u || '')
              .split('/')
              .pop();
          }
        })
        .filter(Boolean);
      const mainTypes = new Set(['CV', 'JFT', 'SSW', 'PHOTO']);
      for (const b of mainBasenames) {
        const t = docTypeOf(b);
        if (t) mainTypes.add(t);
      }
      // Dedupe per tipe dokumen: upload lama tidak boleh menimbulkan tombol
      // dobel — cukup file TERBARU per tipe (KK/KTP/CV dst).
      const byType = new Map();
      for (const n of names) {
        if (mainBasenames.indexOf(n) !== -1) continue;
        const t = docTypeOf(n);
        if (mainTypes.has(t)) continue;
        const prev = byType.get(t);
        if (!prev || docAge(n) > docAge(prev.name)) {
          byType.set(t, { name: n, url: pubBase + folder + encodeURIComponent(n) });
        }
      }
      // Filter extraDocs berdasarkan dokumen_share job.
      // 'ALL' = tampilkan semua. Tanpa 'ALL' = hanya tipe yang di-toggle admin.
      const rawExtraDocs = [...byType.values()];
      const extraDocs = showAllDocs
        ? rawExtraDocs
        : rawExtraDocs.filter((d: { name: string; url: string }) => {
            const t = docTypeOf(d.name);
            return allowedDocTypes.has(t);
          });
      // Gabungkan juga dokumen dari keterangan form (NAMA:URL;...) — dedupe
      // per URL biar tidak dobel dengan folder master.
      // Juga filter by allowedDocTypes kecuali ALL.
      const formDocs = (byWa.get(normalizeWa(String(c.wa || ''))) || []).filter(
        (d: { name: string; url: string }) => showAllDocs || allowedDocTypes.has(docTypeOf(d.name)),
      );
      const seenUrl = new Set(extraDocs.map((d) => d.url));
      for (const d of formDocs) {
        if (!seenUrl.has(String(d.url))) {
          seenUrl.add(String(d.url));
          extraDocs.push(d);
        }
      }
      // Gabungkan dokumen dari pemberkasan_checklist & master_database_candidate
      // — upload via modal pemberkasan / admin super-edit tersimpan di kolom
      // *_url, bukan di folder Storage. Tanpa ini, share view tidak menampilkan
      // KK/KTP/ijazah/dll yang diupload via modal pemberkasan.
      const pRow = pByWa.get(normalizeWa(String(c.wa || '')));
      const mRow = mByWa.get(normalizeWa(String(c.wa || '')));
      const pemberkasanSources = [pRow, mRow].filter(Boolean);
      for (const src of pemberkasanSources) {
        for (const [key, cols] of BERKAS_COLUMNS) {
          let v = '';
          for (const col of cols) {
            if (src[col]) {
              v = String(src[col]);
              break;
            }
          }
          if (v && v !== '-' && v.startsWith('http') && !seenUrl.has(v)) {
            const label = String(key).toUpperCase();
            // Filter by allowedDocTypes kecuali ALL
            if (!showAllDocs && !allowedDocTypes.has(label)) continue;
            seenUrl.add(v);
            extraDocs.push({ name: label, url: v });
          }
        }
      }
      // Foto: kalau pas_photo kandidat kosong/basi (404), pakai file foto dari
      // folder master (PHOTOFILE/PAS_PHOTO/FOTO) — folder di-list di atas.
      let pasPhoto = c.pasPhoto;
      if (!pasPhoto || pasPhoto === '-') {
        const photoFile = names.find((n) => docTypeOf(n) === 'PHOTO');
        if (photoFile) pasPhoto = pubBase + folder + encodeURIComponent(photoFile);
      }

      let finalCv = c.fileCv;
      let finalJft = c.jft;
      let finalSsw = c.ssw;

      // Fallback ke database_asj_form: photo/JFT/SSW/CV mungkin disimpan
      // di lamaran (database_asj_form) tapi tidak ada di database_candidate.
      // Ambil baris form milik kandidat ini → ambil non-empty terbaru.
      const cWa = normalizeWa(String(c.wa || ''));
      const formRows = formsByWa.get(cWa) || [];
      const pickFirstForm = (fields) => {
        for (const r of formRows) {
          const v = toText(pick(r, fields));
          if (v && v !== '-' && v !== 'null') return v;
        }
        return null;
      };
      if (!pasPhoto || pasPhoto === '-') {
        const fPhoto = pickFirstForm(['pas_photo', 'pasPhoto', 'photo']);
        if (fPhoto) pasPhoto = fPhoto;
      }
      if (!finalJft || finalJft === '-') {
        const fJft = pickFirstForm(['jft', 'jft_url']);
        if (fJft) finalJft = fJft;
      }
      if (!finalSsw || finalSsw === '-') {
        const fSsw = pickFirstForm(['ssw', 'ssw_url']);
        if (fSsw) finalSsw = fSsw;
      }
      if (!finalCv || finalCv === '-') {
        const fCv = pickFirstForm(['file_cv', 'cv', 'cv_url']);
        if (fCv) finalCv = fCv;
      }

      // Extract newest CV/JFT/SSW dari extraDocs (folder master & history)
      // jika kandidat melamar tanpa dokumen tersebut di loker baru.
      for (let i = extraDocs.length - 1; i >= 0; i--) {
        const doc = extraDocs[i];
        const t = docTypeOf(doc.name);
        if (t === 'CV' && (!finalCv || finalCv === '-')) {
          finalCv = doc.url;
          extraDocs.splice(i, 1);
        } else if (t === 'JFT' && (!finalJft || finalJft === '-')) {
          finalJft = doc.url;
          extraDocs.splice(i, 1);
        } else if (t === 'SSW' && (!finalSsw || finalSsw === '-')) {
          finalSsw = doc.url;
          extraDocs.splice(i, 1);
        }
      }

      candidates.push({
        id_kandidat: c.idKandidat,
        no_wa: c.wa,
        nama_lengkap: c.nama,
        gender: c.gender,
        usia: c.usia,
        tb: c.tb,
        bb: c.bb,
        pas_photo: pasPhoto,
        file_cv: finalCv,
        jft: finalJft,
        ssw: finalSsw,
        nilai_jft_text: c.jftText,
        bidang_ssw_text: c.sswText,
        extraDocs,
      });
    }
    const tsk = toText(pick(jobRow, ['tsk', 'pengurus']));
    return { job: { code, name, tsk }, candidates };
  } catch (e) {
    return { error: 'Gagal memuat data share: ' + e.message };
  }
}

// Tipe dokumen dari nama file. Kenali pola baru (KK_1786…pdf → KK,
// CVFILE_1786…xlsx → CVFILE) DAN pola lawas (1. X_CV.xlsx → CV,
// 1._X_JFT.pdf → JFT, nama_jft.pdf → JFT, X_PAS_PHOTO.jpg → PHOTO)
// lalu normalisasi alias ke tipe kanonik (CVFILE→CV, PHOTOFILE→PHOTO, …).
// Dipakai dedupe extraDocs supaya 1 loker = 1 CV/JFT/SSW/foto (tidak dobel).
const TYPE_ALIAS = {
  CVFILE: 'CV',
  FILE_CV: 'CV',
  CV_REVISI: 'CV',
  PHOTOFILE: 'PHOTO',
  PAS_PHOTO: 'PHOTO',
  PASSPHOTO: 'PHOTO',
  FOTO: 'PHOTO',
  PHOTO: 'PHOTO',
  JFTFILE: 'JFT',
  SSWFILE: 'SSW',
  KARTU_KELUARGA: 'KK',
};
// Token tipe yang dicari di nama lawas (lebih panjang dulu agar tidak
// salah tangkap: PAS_PHOTO sebelum PHOTO/FOTO, KARTU_KELUARGA sebelum KK).
const TYPE_TOKENS = [
  'PAS_PHOTO',
  'PHOTOFILE',
  'KARTU_KELUARGA',
  'CVFILE',
  'FILE_CV',
  'CV_REVISI',
  'JFTFILE',
  'SSWFILE',
  'PASSPHOTO',
  'PASSPORT',
  'IJAZAH',
  'KTP',
  'KK',
  'CV',
  'JFT',
  'SSW',
  'FOTO',
  'PHOTO',
];
function docTypeOf(name) {
  const base = String(name || '').replace(/\.[a-z0-9]+$/i, '');
  const up = base.toUpperCase();
  // Step 1: Cek token PANJANG (>3 char) sebagai substring —
  // menangani FILE_CV, CV_REVISI, PHOTOFILE, dll.
  for (const tk of TYPE_TOKENS) {
    if (tk.length > 3 && up.includes(tk)) {
      return TYPE_ALIAS[tk] || tk;
    }
  }
  // Step 2: Regex prefix uppercase — menangani KK, KTP, IJAZAH, dll.
  const m = base.match(/^[A-Z]+/);
  const prefix = m ? m[0] : null;
  if (prefix && TYPE_ALIAS[prefix]) return TYPE_ALIAS[prefix];
  if (prefix && prefix.length >= 2) return prefix;
  // Step 3: Pola lawas "1. X_CV.xlsx" — cari token di SELURUH nama
  // (termasuk suffix setelah underscore). Hanya token >= 2 char.
  for (const tk of TYPE_TOKENS) {
    if (tk.length >= 2 && up.includes(tk)) {
      return TYPE_ALIAS[tk] || tk;
    }
  }
  return up;
}

// Usia file dari suffix numerik nama (ms epoch) — makin besar makin baru.
function docAge(name) {
  const m = String(name || '').match(/_(\d{10,})/);
  return m ? Number(m[1]) : 0;
}

export { handleShareData, docTypeOf };
