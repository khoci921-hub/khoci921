import { supabaseJson, toText, pick, normalizeWa } from './client';
import { storageRequest, bucket } from '../storage.ts';
import { fetchMasterLightByWa } from './master';
// db/berkas.js — repo pemberkasan_checklist + attach berkas/bio kandidat + list folder Storage.

// ---------------------------------------------------------------------------
// Lampirkan berkas (pemberkasan_checklist) & bio (master_database_candidate)
// ke tiap kandidat — bentuk yang diharapkan frontend (candidate.berkas /
// candidate.bio) untuk dashboard kandidat (progres pemberkasan x/17, biodata)
// dan modal admin (berkas tersimpan, auto-fill biodata). Backend asli (GAS)
// mengirim keduanya di getAppData; rebuild ini sebelumnya tidak melakukannya.
// Kolom sumber per dokumen ikut skema yang dipakai handleSimpanBerkasTahapan
// (FILE_LABEL_COLUMNS di actions-extra.js) + fallback nama kolom legacy.
// ---------------------------------------------------------------------------
// Kandidat kolom per dokumen — urut: pemberkasan_checklist → master → legacy.
// pemberkasan_checklist (dibuat rebuild) bisa kosong untuk data lama, jadi
// master_database_candidate (*_url) dipakai sebagai fallback.
const BERKAS_COLUMNS = [
  ['kk', ['kk_url', 'kk']],
  ['akte', ['akte_url', 'akte']],
  ['sd', ['sd_url', 'ijazah_sd_url', 'ijazah_sd', 'sd']],
  ['smp', ['smp_url', 'ijazah_smp_url', 'ijazah_smp', 'smp']],
  ['sma', ['sma_url', 'ijazah_sma_url', 'ijazah_sma', 'sma']],
  ['univ', ['univ_url', 'univ']],
  ['pasport', ['pasport_url', 'pasport']],
  ['mcu', ['mcu_url', 'mcu']],
  ['kontrak', ['kontrak_url', 'kontrak']],
  ['cert', ['cert_url', 'certificate_japan', 'cert']],
  ['ktp', ['ktp_url', 'ktp']],
  ['foto2', ['foto2_url', 'pas_foto_studio', 'foto2']],
  ['ijinortu', ['ijinortu_url', 'ijin_ortu', 'ijinortu']],
  ['cpmi', ['cpmi_url', 'cpmi']],
  ['kawin', ['kawin_url', 'buku_nikah', 'kawin']],
  ['sehat', ['sehat_url', 'surat_sehat', 'sehat']],
  ['bpjs', ['bpjs_url', 'bpjs']],
  ['psikotes', ['psikotes_url', 'psikotes']],
];

const BIO_COLUMNS = [
  ['email', ['email']],
  ['tmplahir', ['tempat_lahir', 'tmplahir']],
  ['tgllahir', ['tgl_lahir', 'tgllahir']],
  ['alamat', ['alamat_lengkap', 'alamat']],
  ['ayah', ['nama_ayah', 'ayah']],
  ['ttlayah', ['ttl_ayah', 'ttlayah']],
  ['ibu', ['nama_ibu', 'ibu']],
  ['ttlibu', ['ttl_ibu', 'ttlibu']],
  ['pasport', ['no_pasport', 'pasport']],
  ['coe', ['no_coe', 'coe']],
  ['kotapasport', ['kota_pasport', 'kotapasport']],
  ['tglpasport', ['tgl_pasport', 'tglpasport']],
  ['exppasport', ['exp_pasport', 'exppasport']],
  ['pt', ['nama_perusahaan', 'pt']],
  ['shacou', ['nama_shacou', 'shacou']],
  ['telppt', ['telp_perusahaan', 'telppt']],
  ['webpt', ['web_perusahaan', 'webpt']],
  ['alamatpt', ['alamat_perusahaan', 'alamatpt']],
];

// Tarik pemberkasan_checklist hanya untuk WA di daftar (fallback: null → scan).
async function fetchBerkasByWa(waList) {
  try {
    const rows = await supabaseJson('GET', 'pemberkasan_checklist', {
      query: { select: '*', limit: '500', wa: 'in.(' + waList.join(',') + ')' },
    });
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

async function attachBerkasBio(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return candidates;
  try {
    // Filter server-side: tarik hanya baris yang WA-nya ada di daftar kandidat
    // (max 150 per panggilan), bukan scan 500 baris penuh tiap kali.
    const waList = [
      ...new Set(candidates.map((c) => normalizeWa(String(c.wa || ''))).filter(Boolean)),
    ];
    const useFilter = waList.length > 0 && waList.length <= 150;
    // Fase 3.18: berkas (pemberkasan_checklist) & bio (master) ditarik
    // PARALEL — independen, dulu berurutan (2 roundtrip serial di getAppData
    // admin & halaman kandidat). Kedua fetch sudah catch internal → aman.
    // Jalur ringan: master hanya butuh kolom BERKAS_COLUMNS/BIO_COLUMNS —
    // jangan bawa 154 kolom penuh (sebelumnya ±6,5 KB/baris per kandidat).
    let pRows = null;
    let mRows = null;
    if (useFilter) {
      const [p, m] = await Promise.all([fetchBerkasByWa(waList), fetchMasterLightByWa(waList)]);
      pRows = p;
      mRows = m;
    }
    // Fallback per-tabel: scan penuh (perilaku lama) kalau filter gagal.
    if (!Array.isArray(pRows)) {
      try {
        pRows = await supabaseJson('GET', 'pemberkasan_checklist', {
          query: { select: '*', limit: 500 },
        });
      } catch {
        pRows = [];
      }
    }
    if (!Array.isArray(mRows)) {
      try {
        mRows = await supabaseJson('GET', 'master_database_candidate', {
          query: { select: '*', limit: 500 },
        });
      } catch {
        mRows = [];
      }
    }
    const pByWa = new Map();
    for (const r of Array.isArray(pRows) ? pRows : []) {
      pByWa.set(normalizeWa(String(r.wa || '')), r);
    }
    const mByWa = new Map();
    for (const r of Array.isArray(mRows) ? mRows : []) {
      mByWa.set(normalizeWa(String(pick(r, ['no_wa', 'wa', 'whatsapp']) || '')), r);
    }
    for (const c of candidates) {
      const want = normalizeWa(String(c.wa || ''));
      const pr = pByWa.get(want);
      const mr = mByWa.get(want);
      // Gabung pemberkasan_checklist + master (*_url) — master jadi fallback
      // untuk data lama yang belum pernah ditulis ke pemberkasan_checklist.
      const sources = [pr, mr].filter(Boolean);
      if (sources.length) {
        const berkas: Record<string, any> = {};
        for (const [key, cols] of BERKAS_COLUMNS) {
          let v = '';
          for (const src of sources) {
            for (const col of cols) {
              if (src[col]) {
                v = src[col];
                break;
              }
            }
            if (v) break;
          }
          // @ts-expect-error JS→TS migration
          berkas[key] = v && v !== '-' ? toText(v) : '';
        }
        c.berkas = berkas;
      } else {
        c.berkas = {};
      }
      if (mr) {
        const bio: Record<string, any> = {};
        for (const [key, cols] of BIO_COLUMNS) {
          const v = pick(mr, cols);
          // @ts-expect-error JS→TS migration
          bio[key] = v && v !== '-' ? toText(v) : '';
        }
        c.bio = bio;
      } else {
        c.bio = {};
      }
    }
  } catch (e) {
    // Non-fatal: tanpa berkas/bio dashboard tetap render (progres 0/x).
  }
  return candidates;
}

// Daftar file dalam folder Supabase Storage (bucket asj-files). Dipakai
// share-data untuk menampilkan dokumen folder master (KK/KTP/ijazah/dll),
// persis perilaku backend lama (produksi). Non-fatal: error → daftar kosong.
async function listStorageFolder(prefix) {
  if (!prefix) return [];
  try {
    const j = await storageRequest('POST', 'object/list/' + bucket(), {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix,
        limit: 200,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    return Array.isArray(j)
      ? j.filter((f) => f && f.name && !String(f.name).endsWith('/')).map((f) => String(f.name))
      : [];
  } catch {
    return [];
  }
}

export { attachBerkasBio, listStorageFolder, BERKAS_COLUMNS };
