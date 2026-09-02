import { normalizeGender, supabaseJson } from './db/client';
import { env } from './env';
import { cacheClear } from './cache';
// actions-register.js — daftar siswa baru (respon_siswa_baru) + link & bridge
// form (QR / apply-full / master-full / ai_form).
// perilaku TIDAK berubah.

// ---------------------------------------------------------------------------
// Siswa baru (respon_siswa_baru)
// ---------------------------------------------------------------------------
async function handleGetDaftarSiswaBaru(payload, sessionToken) {
  // Endpoint PUBLIK: tombol "Cek Data" ada di landing publik (index.html),
  // bukan hanya admin. Dulu butuh role admin → pengunjung publik dapat
  // sessionInvalid → halaman reload dan tombol terasa "mati".
  // HANYA kolom yang ditampilkan modal yang dikirim (id, nama, gender, alamat)
  // — WA/email/URL berkas (PII) TIDAK ikut, demi keamanan.
  try {
    const rows = await supabaseJson('GET', 'respon_siswa_baru', {
      query: {
        select: 'id,nama_lengkap,jenis_kelamin,alamat_lengkap',
        limit: 500,
        order: 'created_at.desc',
      },
    });
    const data = (Array.isArray(rows) ? rows : []).map((r) => {
      // Satu-satunya normalisasi gender: normalizeGender → LAKI-LAKI/PEREMPUAN.
      const g = normalizeGender(r.jenis_kelamin || r.gender);
      return {
        id: r.id,
        nama_lengkap: r.nama_lengkap || '',
        alamat_lengkap: r.alamat_lengkap || '',
        jenis_kelamin: g === 'LAKI-LAKI' ? 'L' : g === 'PEREMPUAN' ? 'P' : '',
      };
    });
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleSubmitDaftarSiswa(payload) {
  cacheClear(); // siswa baru masuk → daftar kandidat berubah
  const d = payload || {};
  const nama = String(d.nama || '').trim();
  if (!nama) return { success: false, message: 'Nama wajib diisi.' };
  try {
    await supabaseJson('POST', 'respon_siswa_baru', {
      body: {
        timestamp: new Date().toISOString(),
        nama_lengkap: nama,
        alamat_email: String(d.email || ''),
        jenis_kelamin: String(d.gender || ''),
        alamat_lengkap: String(d.alamat || ''),
        tempat_tanggal_lahir: String(d.ttl || ''),
        agama: String(d.agama || ''),
        nomor_wa_peserta: String(d.wa_siswa || ''),
        nomor_wa_orangtua: String(d.wa_ortu || ''),
        pendidikan_terakhir: String(d.pendidikan || ''),
        file_ktp: String(d.ktp || ''),
        file_kk: String(d.kk || ''),
        file_ijazah: String(d.ijazah || ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Gagal mendaftar: ' + e.message };
  }
}

// ---------------------------------------------------------------------------
// Link & bridge (QR / form)
// ---------------------------------------------------------------------------
function siteBase() {
  return (env('NETLIFY_SITE_URL') || 'https://asjportal.netlify.app').replace(/\/$/, '');
}

async function handleGetLinkSiswaBaru() {
  return { url: siteBase() + '/siswa-baru.html', formUrl: siteBase() + '/siswa-baru.html' };
}

async function handleGenerateFormBridge(payload) {
  // Pemanggil:
  //  - aksiGenerateQr(c, k)        → [code, bidang]
  //  - lamarJob(jc, b, wa, nama, req) → [code, bidang, wa, nama, req]
  // Map posisional supaya WA/nama/req kandidat yang login ikut terbawa ke
  // apply-full.html (?job=&bidang=&wa=&nama=&req=).
  const code = String((payload && payload[0]) || '');
  const bidang = String((payload && payload[1]) || '');
  const wa = String((payload && payload[2]) || '');
  const nama = String((payload && payload[3]) || '');
  const req = String((payload && payload[4]) || '');
  const formUrl =
    siteBase() +
    '/apply-full.html?job=' +
    encodeURIComponent(code) +
    '&bidang=' +
    encodeURIComponent(bidang) +
    '&wa=' +
    encodeURIComponent(wa) +
    '&nama=' +
    encodeURIComponent(nama) +
    '&req=' +
    encodeURIComponent(req);
  return { formUrl };
}

async function handleGenerateLegacyMasterBridge(payload) {
  const wa = String((payload && payload[0]) || '');
  const nama = String((payload && payload[1]) || '');
  const formUrl =
    siteBase() +
    '/master-full.html?wa=' +
    encodeURIComponent(wa) +
    '&nama=' +
    encodeURIComponent(nama);
  return { formUrl };
}

async function handleGenerateAiFormBridge(payload) {
  // Pemanggil: bukaAiFormPortal(flow, job, bidang, wa, nama) → payload
  // [flow, job, bidang, wa, nama]. Dulu hanya payload[0]/[1] yang dibaca,
  // jadi ?job=<flow>&wa= (WA kandidat HILANG) → ai_form tidak dapat
  // auto-fill dan SIMPAN DB gagal. Sekarang seluruh context diteruskan ke
  // ai_form.html (?flow=&job=&bidang=&wa=&nama=).
  const flow = String((payload && payload[0]) || '');
  const job = String((payload && payload[1]) || '');
  const bidang = String((payload && payload[2]) || '');
  const wa = String((payload && payload[3]) || '');
  const nama = String((payload && payload[4]) || '');
  const formUrl =
    siteBase() +
    '/ai_form.html?flow=' +
    encodeURIComponent(flow) +
    '&job=' +
    encodeURIComponent(job) +
    '&bidang=' +
    encodeURIComponent(bidang) +
    '&wa=' +
    encodeURIComponent(wa) +
    '&nama=' +
    encodeURIComponent(nama);
  return { formUrl };
}

export {
  handleGetDaftarSiswaBaru,
  handleSubmitDaftarSiswa,
  handleGetLinkSiswaBaru,
  handleGenerateFormBridge,
  handleGenerateLegacyMasterBridge,
  handleGenerateAiFormBridge,
};
