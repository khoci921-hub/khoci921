// Probe read-only: cari kolom yang TIDAK ada di database_candidate (penyebab
// select proyeksi HTTP 400). TIDAK mengubah data.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { env } = require('../netlify/functions/_lib/env.js');

const base = String(env('SUPABASE_URL') || '').replace(/\/$/, '');
const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY') || '';
const headers = { apikey: key, Authorization: 'Bearer ' + key };

const COLS =
  'id,id_kandidat,nama_lengkap,no_wa,status_kandidat,status,updated_at,created_at,tanggal_daftar,gender,usia,tb,bb,pendidikan,tahapan_seleksi,id_loker_pilihan,pas_photo,folder_url,jft,ssw,file_cv'.split(
    ',',
  );

const bad = [];
for (const col of COLS) {
  const res = await fetch(
    `${base}/rest/v1/database_candidate?select=${encodeURIComponent(col)}&limit=1`,
    { headers },
  );
  if (res.status !== 200) bad.push(`${col} (HTTP ${res.status})`);
}
console.log(bad.length ? 'TIDAK ADA: ' + bad.join(', ') : 'Semua kolom OK');
