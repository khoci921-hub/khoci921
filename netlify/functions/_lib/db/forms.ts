import { supabaseJson, toText, normalizeWa } from './client';
// db/forms.js — repo mail inbox (database_asj_form): mapForm, findForms, query per WA.

// ===== Mail inbox (database_asj_form) =====
// Kolom asli: id, timestamp, code_job, kategory, nama_lengkap, no_wa, gender,
// usia, tb, bb, pas_photo, jft, ssw, file_cv, folder_name, folder_id,
// folder_url, status, email, tempat_lahir, tgl_lahir, alamat_lengkap,
// created_at, updated_at, keterangan, ai_data_json, feedback_berkas
function mapForm(row, i) {
  return {
    rowIndex: i,
    id: row.id,
    timestamp: toText(row.timestamp || row.created_at),
    code: toText(row.code_job),
    kategori: toText(row.kategory),
    nama: toText(row.nama_lengkap),
    wa: toText(row.no_wa).replace(/\D/g, ''),
    status: toText(row.status) || 'MENUNGGU',
    folderUrl: row.folder_url || '',
    photo: row.pas_photo || '',
    jft: row.jft || '',
    ssw: row.ssw || '',
    cv: row.file_cv || '',
    keterangan: toText(row.keterangan),
    // Aktivitas terakhir kandidat (status UPDATE): "[BIODATA] email diubah · [UPLOAD KTP]".
    feedback: toText(row.feedback_berkas),
    // Dokumen tambahan dari keterangan "NAMA:URL;NAMA2:URL2;..." — dipakai
    // mail inbox untuk menampilkan SEMUA yang di-upload kandidat + preview.
    docs: parseDocs(toText(row.keterangan)),
  };
}

// Parse keterangan mail menjadi daftar dokumen {nama, url} (format NAMA:URL;...).
function parseDocs(keterangan) {
  const out = [];
  String(keterangan || '')
    .split(';')
    .forEach((chunk) => {
      const i = chunk.indexOf(':');
      if (i <= 0) return;
      const nama = chunk.slice(0, i).trim();
      const url = chunk.slice(i + 1).trim();
      if (!nama || !url || !/^https?:\/\//i.test(url)) return;
      out.push({ nama, url });
    });
  return out;
}

// Kolom RINGAN mail inbox (database_asj_form) — gabungan semua kolom yang
// benar-benar dibaca dari baris form: mapForm (formInbox admin),
// attachApplications (lamaran per WA), parseDocs (keterangan NAMA:URL;...).
// `select *` lama ikut kolom berat (ai_data_json, dll.) yang tidak pernah
// dibaca dari formInbox.
const FORM_LIGHT_COLS =
  'id,timestamp,code_job,kategory,nama_lengkap,no_wa,status,folder_url,pas_photo,jft,ssw,file_cv,keterangan,feedback_berkas,created_at,updated_at';

// Urutan form konsisten (dipakai getAppData DAN handler review/approve/reject/
// delete yang menerima rowIndex = posisi di array ini).
async function findForms() {
  const rows = await supabaseJson('GET', 'database_asj_form', {
    query: { select: '*', order: 'timestamp.desc', limit: 500 },
  });
  return Array.isArray(rows) ? rows : [];
}

// Baris mail RINGAN (proyeksi FORM_LIGHT_COLS) untuk getAppData admin —
// mapForm & attachApplications hanya membaca kolom di proyeksi ini, jadi
// kolom berat tidak perlu ikut. Urutan TETAP timestamp.desc (sama dengan
// findForms) supaya rowIndex di frontend konsisten dengan
// findFormByIndexFiltered. Return: array | undefined (skema tidak cocok →
// caller fallback findForms()).
async function findFormsLight() {
  try {
    const rows = await supabaseJson('GET', 'database_asj_form', {
      query: { select: FORM_LIGHT_COLS, order: 'timestamp.desc', limit: 500 },
    });
    return Array.isArray(rows) ? rows : undefined;
  } catch {
    return undefined;
  }
}

// Semua baris mail (database_asj_form) untuk satu WA — urutan timestamp.desc
// sama dengan findForms() supaya "baris pertama" konsisten.
async function findFormsByWa(wa) {
  const want = normalizeWa(wa);
  if (!want) return [];
  try {
    const rows = await supabaseJson('GET', 'database_asj_form', {
      query: {
        select: '*',
        limit: '100',
        order: 'timestamp.desc',
        or: `(no_wa.eq.${want},wa.eq.${want})`,
      },
    });
    if (Array.isArray(rows)) return rows;
  } catch {
    /* or gagal (kolom wa tidak ada) — coba no_wa saja */
  }
  try {
    const rows = await supabaseJson('GET', 'database_asj_form', {
      query: { select: '*', limit: '100', order: 'timestamp.desc', no_wa: 'eq.' + want },
    });
    if (Array.isArray(rows)) return rows;
  } catch {
    /* fallback scan penuh */
  }
  return undefined;
}

// Insert baris mail dengan anti-duplikat (no_wa, code_job): upsert
// on_conflict kalau constraint unik sudah ada di DB; kalau belum (HTTP 400
// 42P10), fallback INSERT biasa. Race GET-then-POST (dua request paralel
// sama-sama tidak menemukan baris) tidak lagi bikin baris dobel begitu
// constraint dibuat via:
//   ALTER TABLE database_asj_form
//   ADD CONSTRAINT database_asj_form_no_wa_code_job_key UNIQUE (no_wa, code_job);
async function upsertFormRow(body) {
  try {
    await supabaseJson('POST', 'database_asj_form', {
      query: { on_conflict: 'no_wa,code_job' },
      body,
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    });
  } catch (e) {
    // Constraint belum ada → INSERT biasa (perilaku lama). Error lain diteruskan.
    if (!String(e.message || '').includes('42P10')) throw e;
    await supabaseJson('POST', 'database_asj_form', {
      body,
      headers: { Prefer: 'return=minimal' },
    });
  }
}

// FIX #6 (audit 2026-09-02): Pengganti findFormByIndexFiltered yang
// menggunakan rowIndex (offset) — non-deterministic saat timestamp collate.
// Sekarang frontend mengirim id baris (primary key), bukan posisi array.
async function findFormById(formId) {
  const id = String(formId || '').trim();
  if (!id) return undefined;
  try {
    const rows = await supabaseJson('GET', 'database_asj_form', {
      query: { select: '*', limit: '1', id: 'eq.' + id },
    });
    return Array.isArray(rows) ? rows[0] || null : undefined;
  } catch {
    return undefined;
  }
}

// Legacy: baris mail pada posisi index urutan timestamp.desc — hanya dipakai
// sebagai fallback bila id tidak tersedia. DEPRECATED: gunakan findFormById.
async function findFormByIndexFiltered(idx) {
  const i = Number(idx);
  if (!Number.isInteger(i) || i < 0) return undefined;
  try {
    const rows = await supabaseJson('GET', 'database_asj_form', {
      query: { select: '*', order: 'timestamp.desc', limit: '1', offset: String(i) },
    });
    return Array.isArray(rows) ? rows[0] || null : undefined;
  } catch {
    return undefined;
  }
}

// Resolve form by ID or legacy rowIndex — single source of truth for the
// 3-step lookup: try findFormById → try findFormByIndexFiltered → full scan.
// Returns { form, source } on success or { form: null, error: string }.
// Extracted from actions-mail.ts to eliminate 3× duplicated blocks.
async function resolveForm(formIdOrIndex) {
  const val = formIdOrIndex;
  if (!val && val !== 0) {
    return { form: null, error: 'ID form tidak valid.' };
  }
  // Step 1: Try as form ID (primary key — the new path).
  let form = await findFormById(String(val));
  if (form) return { form, source: 'id' };
  // Step 2: Try as numeric rowIndex (legacy backward compatibility).
  const asNum = Number(val);
  if (!isNaN(asNum) && asNum >= 0) {
    form = await findFormByIndexFiltered(asNum);
    if (form) return { form, source: 'index' };
  }
  // Step 3: Full scan fallback — find by id in the full list, or by index.
  const all = await findForms();
  form =
    all.find((r) => String(r.id) === String(val)) ||
    all[asNum] ||
    null;
  if (form) return { form, source: 'scan' };
  return { form: null, error: 'Form tidak ditemukan.' };
}

// Baris mail untuk daftar WA (in-filter) — share-data extra docs &
// attachApplications halaman kandidat. Hanya membaca kolom ringan
// (keterangan/no_wa/dll.), jadi proyeksi FORM_LIGHT_COLS dicoba dulu;
// fallback select * bila kolom tidak cocok; undefined → scan penuh.
async function findFormsByWaList(waList) {
  const list = [
    ...new Set((Array.isArray(waList) ? waList : []).map((w) => normalizeWa(w)).filter(Boolean)),
  ];
  if (!list.length) return [];
  const inList = list.join(',');
  const tryQuery = async (query) => {
    try {
      const light = await supabaseJson('GET', 'database_asj_form', {
        query: { ...query, select: FORM_LIGHT_COLS },
      });
      if (Array.isArray(light)) return light;
    } catch {
      /* proyeksi tidak cocok — coba select * */
    }
    try {
      const full = await supabaseJson('GET', 'database_asj_form', { query });
      if (Array.isArray(full)) return full;
    } catch {
      /* coba jalur berikutnya */
    }
    return undefined;
  };
  const r1 = await tryQuery({ limit: '500', or: `(no_wa.in.(${inList}),wa.in.(${inList}))` });
  if (r1 !== undefined) return r1;
  return tryQuery({ limit: '500', no_wa: 'in.(' + inList + ')' });
}

export {
  mapForm,
  parseDocs,
  findForms,
  findFormsLight,
  findFormsByWa,
  findFormById,
  findFormByIndexFiltered,
  resolveForm,
  findFormsByWaList,
  upsertFormRow,
};
