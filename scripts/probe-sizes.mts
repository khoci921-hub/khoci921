// Probe read-only: ukur jumlah baris & ukuran payload tabel kandidat & mail
// (scan penuh tersisa di getAppData admin). TIDAK mengubah data apa pun.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { env } = require('../netlify/functions/_lib/env.js');

const base = String(env('SUPABASE_URL') || '').replace(/\/$/, '');
const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY') || '';
if (!base || !key) {
  console.error('Supabase keys tidak tersedia.');
  process.exit(1);
}
const headers = { apikey: key, Authorization: 'Bearer ' + key };

async function probe(table, sel, start, end) {
  const url = `${base}/rest/v1/${table}?select=${encodeURIComponent(sel)}`;
  const res = await fetch(url, {
    headers: { ...headers, Range: `${start}-${end}`, Prefer: 'count=exact' },
  });
  const body = await res.text();
  const cr = res.headers.get('content-range') || '';
  return {
    bytes: body.length,
    total: parseInt(String(cr).split('/')[1] || '0', 10) || 0,
    status: res.status,
  };
}

const CAND_LIGHT =
  'id,id_kandidat,nama_lengkap,no_wa,status_kandidat,updated_at,created_at,tanggal_daftar';
const CAND_PAGE_FULL =
  'id,id_kandidat,nama_lengkap,no_wa,status_kandidat,updated_at,created_at,tanggal_daftar,gender,usia,tb,bb,pendidikan,tahapan_seleksi,id_loker_pilihan,pas_photo,folder_url,jft,ssw,file_cv';
const FORM_LIGHT =
  'id,timestamp,code_job,kategory,nama_lengkap,no_wa,status,folder_url,pas_photo,jft,ssw,file_cv,keterangan,feedback_berkas,created_at,updated_at';

const cand = await probe('database_candidate', '*', 0, 299);
const candLight = await probe('database_candidate', CAND_LIGHT, 0, 299);
const candPageFull = await probe('database_candidate', CAND_PAGE_FULL, 0, 49);
const form = await probe('database_asj_form', '*', 0, 499);
const formLight = await probe('database_asj_form', FORM_LIGHT, 0, 499);

const pct = (a, b) => (b ? Math.round((1 - a / b) * 100) : 0);
console.log(
  `candidate: total=${cand.total} | select*=${cand.bytes}B (${(cand.bytes / 1024).toFixed(1)}KB, HTTP ${cand.status}) | light(min)=${candLight.bytes}B (${(candLight.bytes / 1024).toFixed(1)}KB, HTTP ${candLight.status})`,
);
console.log(
  `candidate: 50 baris proyeksi-luas=${candPageFull.bytes}B (${(candPageFull.bytes / 1024).toFixed(1)}KB) — banding: select* 50 baris ≈ ${Math.round((cand.bytes * 50) / 222)}B`,
);
console.log(
  `form:     total=${form.total} | select*=${form.bytes}B (${(form.bytes / 1024).toFixed(1)}KB, HTTP ${form.status}) | projected=${formLight.bytes}B (${(formLight.bytes / 1024).toFixed(1)}KB, HTTP ${formLight.status}) | hemat=${pct(formLight.bytes, form.bytes)}%`,
);
