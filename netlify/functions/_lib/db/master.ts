import { supabaseJson } from './client';
// db/master.js — repo master biodata/CV (master_database_candidate).

// Kolom RINGAN master_database_candidate — hanya kolom yang benar-benar
// dibaca attachBerkasBio (BERKAS_COLUMNS *_url + BIO_COLUMNS + pencocok WA).
// Tabel master 154 kolom (±6,5 KB/baris); proyeksi ini ±16 kolom. Jalur yang
// butuh baris PENUH master (findMasterByWa → CV builder / getDrafCvMaster /
// ai_data_json) TETAP memakai fetchMasterByWa select *.
const MASTER_LIGHT_COLS =
  'id,id_kandidat,nama_lengkap,no_wa,kk_url,ijazah_sd_url,ijazah_smp_url,ijazah_sma_url,univ_url,ktp_url,email,tempat_lahir,tgl_lahir,alamat_lengkap,no_coe,exp_pasport';

// Tarik master_database_candidate hanya untuk WA di daftar. Coba kolom WA
// umum (or), lalu no_wa saja — fallback null → scan penuh.
async function fetchMasterByWa(waList) {
  const inList = waList.join(',');
  try {
    const rows = await supabaseJson('GET', 'master_database_candidate', {
      query: {
        select: '*',
        limit: '500',
        or: `(no_wa.in.(${inList}),wa.in.(${inList}),whatsapp.in.(${inList}))`,
      },
    });
    if (Array.isArray(rows)) return rows;
  } catch {
    /* coba kolom berikutnya */
  }
  try {
    const rows = await supabaseJson('GET', 'master_database_candidate', {
      query: { select: '*', limit: '500', no_wa: 'in.(' + inList + ')' },
    });
    if (Array.isArray(rows)) return rows;
  } catch {
    /* fallback scan penuh */
  }
  return null;
}

// Master RINGAN (proyeksi MASTER_LIGHT_COLS) untuk attachBerkasBio — TIDAK
// membawa 138 kolom yang tidak pernah dibaca (berat ~6,5 KB/baris → ~0,5 KB).
// Filter WA-set sama dengan fetchMasterByWa; proyeksi gagal (skema kolom
// berbeda) → fallback select * agar perilaku tidak berubah. null → scan penuh.
async function fetchMasterLightByWa(waList) {
  const inList = waList.join(',');
  const tryQuery = async (query) => {
    try {
      const light = await supabaseJson('GET', 'master_database_candidate', {
        query: { ...query, select: MASTER_LIGHT_COLS },
      });
      if (Array.isArray(light)) return light;
    } catch {
      /* proyeksi tidak cocok — coba select * */
    }
    try {
      const full = await supabaseJson('GET', 'master_database_candidate', { query });
      if (Array.isArray(full)) return full;
    } catch {
      /* coba jalur berikutnya */
    }
    return null;
  };
  const r1 = await tryQuery({
    limit: '500',
    or: `(no_wa.in.(${inList}),wa.in.(${inList}),whatsapp.in.(${inList}))`,
  });
  if (r1 !== null) return r1;
  return tryQuery({ limit: '500', no_wa: 'in.(' + inList + ')' });
}

export { fetchMasterByWa, fetchMasterLightByWa };
