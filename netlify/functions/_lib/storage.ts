import { supabaseKey, supabaseUrl } from './db/client';
import { env } from './env';
// storage.js — helper Supabase Storage (upload base64, hapus varian lama,
// actions-extra.js, perilaku TIDAK berubah.

function bucket() {
  return env('SUPABASE_STORAGE_BUCKET') || 'asj-files';
}

// Request ke Supabase Storage (di luar /rest/v1).
async function storageRequest(method, pathname, opts = {}) {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) throw new Error('Supabase belum dikonfigurasi');
  const res = await fetch(url.replace(/\/$/, '') + '/storage/v1/' + pathname, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      // @ts-expect-error JS→TS migration
      ...(opts.headers || {}),
    },
    // @ts-expect-error JS→TS migration
    body: opts.body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('storage/' + pathname + ' → HTTP ' + res.status + ' ' + text.slice(0, 200));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function publicUrl(path) {
  return supabaseUrl().replace(/\/$/, '') + '/storage/v1/object/public/' + bucket() + '/' + path;
}

// Terima base64 (boleh dengan prefix data:*) → kembalikan Buffer.
function b64ToBuffer(data) {
  let s = String(data || '');
  const comma = s.indexOf(',');
  if (comma >= 0 && /^data:/i.test(s.slice(0, comma + 1))) s = s.slice(comma + 1);
  return Buffer.from(s, 'base64');
}

function mimeFromName(name, fallback) {
  const ext = String(name || '')
    .split('.')
    .pop()
    .toLowerCase();
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    rtf: 'application/rtf',
    odt: 'application/vnd.oasis.opendocument.text',
  };
  return map[ext] || fallback || 'application/octet-stream';
}

// Alias nama file per jenis — semua jalur upload (apply-full, dashboard,
// master form, admin) dijamin memakai stem yang sama, sehingga file lama
// ikut terhapus & tidak ada dokumen dobel (mis. KTP 2 / KK 2 di share view).
function stemAliases(stem) {
  const u = String(stem || '').toUpperCase();
  const m = {
    PAS_PHOTO: ['PHOTOFILE', 'PASPHOTO', 'FOTO'],
    PHOTOFILE: ['PAS_PHOTO', 'PASPHOTO', 'FOTO'],
    PASPHOTO: ['PAS_PHOTO', 'PHOTOFILE', 'FOTO'],
    CV: ['CVFILE', 'FILE_CV', 'CV_REVISI'],
    CVFILE: ['CV', 'FILE_CV', 'CV_REVISI'],
    CV_REVISI: ['CV', 'CVFILE', 'FILE_CV'],
    JFT: ['JFTFILE'],
    JFTFILE: ['JFT'],
    SSW: ['SSWFILE'],
    SSWFILE: ['SSW'],
    KK: ['KARTU_KELUARGA'],
    KARTU_KELUARGA: ['KK'],
  };
  return m[u] || [];
}

// Hapus semua varian lama satu jenis file di folder (mis. KTP.jpg, KTP.png,
// KK_1786….pdf — termasuk varian bertimestamp dari backend lama — plus
// alias-nya). Dipanggil SEBELUM upload supaya selalu menimpa file lama.
// Catatan API: object/list mengembalikan nama RELATIF terhadap prefix, jadi
// filter + delete harus pakai path lengkap (folder + "/" + nama).
function isVarianOf(name, stem) {
  const n = String(name || '');
  if (!n || !stem) return false;
  // KTP.ext / KTP.png — varian tanpa timestamp.
  if (n.startsWith(stem + '.')) return true;
  // KTP_1786683311216.pdf — varian bertimestamp (backend lama menamai
  // file dengan timestamp sehingga upload kedua tidak menimpa).
  return n.startsWith(stem + '_');
}

async function hapusJenisVarian(folder, stem) {
  const f = String(folder).replace(/^\/+|\/+$/g, '');
  const stems = [String(stem || '')].concat(stemAliases(stem)).filter(Boolean);
  try {
    const list = await storageRequest('POST', 'object/list/' + bucket(), {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: f + '/', limit: 300, offset: 0 }),
    });
    const items = Array.isArray(list) ? list : [];
    const victims = items
      .map((o) => (o && o.name ? String(o.name) : ''))
      .filter((n) => n && stems.some((s) => isVarianOf(n, s)));
    if (victims.length) {
      await storageRequest('DELETE', 'object/' + bucket(), {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: victims.map((n) => f + '/' + n) }),
      });
    }
  } catch (e) {
    // List/hapus gagal tidak memblokir upload — x-upsert tetap menimpa nama sama.
  }
}

// Upload file base64 ke Storage, kembalikan public URL.
async function uploadBase64(data, folder, fileName) {
  if (!data) return null;
  const buf = b64ToBuffer(data);
  const cleanName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const stem = cleanName.split('.')[0];
  // FIX anti-duplikat: hapus varian lama (KTP.jpg / KTP.png / alias) dulu.
  await hapusJenisVarian(folder, stem);
  const path = String(folder).replace(/^\/+|\/+$/g, '') + '/' + cleanName;
  await storageRequest('POST', 'object/' + bucket() + '/' + path, {
    headers: {
      // @ts-expect-error JS→TS migration
      'Content-Type': mimeFromName(cleanName),
      'x-upsert': 'true',
    },
    body: buf,
  });
  return publicUrl(path);
}

// Jalur Cloudinary (2026-08-17): nilai sudah URL string (hasil upload langsung
// dari browser) → dipakai apa adanya. Base64 (jalur lama Frontend → Netlify →
// Storage) tetap didukung sebagai fallback untuk klien yang belum dimigrasi.
async function resolveFileUrl(value, folder, fileName) {
  if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
    return value.trim();
  }
  return uploadBase64(value, folder, fileName);
}

export {
  bucket,
  storageRequest,
  publicUrl,
  b64ToBuffer,
  mimeFromName,
  stemAliases,
  isVarianOf,
  hapusJenisVarian,
  uploadBase64,
  resolveFileUrl,
};
