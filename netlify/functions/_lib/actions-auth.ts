import bcrypt from 'bcryptjs';
import { env } from './env';
import { normalizeWa, isValidWaFormat } from '../../../shared/wa-rules.ts';
import { hasBackend, pick, supabaseJson, toText } from './db/client';
import { findCandidateByWaFiltered, findCandidates } from './db/candidates';
import { findAdmins } from './db/misc';
import * as session from './session';
import { cacheClear } from './cache';
import { findCandidateByWa, CAND_WA_COLS } from './candidate-helpers';
// actions-auth.js — autentikasi & otorisasi backend.
//
// masterPins, requireAdmin, isValidWaFormat, handleCheckAdminMaster/Personal,
// handleLoginKandidat, handleDaftarKandidat, handleGantiPasswordKandidat.
// findCandidateByWa & CAND_WA_COLS dipakai lintas domain → ada di
// candidate-helpers.js (bukan di sini).

// Aturan WA (normalisasi + gate) — satu sumber kebenaran: shared/wa-rules.js
// (frontend js/04_auth.js memakai yang sama).

function masterPins() {
  return [
    'ADMIN_PASSWORD',
    'ADMIN_MASTER_PASSWORD',
    'MASTER_PASSWORD',
    'ASJ_ADMIN_PASSWORD',
    'ADMIN_PIN',
    'PIN_ADMIN',
    'ADMIN_MASTER_PIN',
  ]
    .map(env)
    .filter(Boolean);
}

async function handleCheckAdminMaster(payload) {
  const pin = String((payload && payload[0]) || '');
  const pins = masterPins();
  if (pins.length === 0) {
    return {
      success: false,
      error:
        'PIN master admin belum dikonfigurasi di server. Set env ADMIN_PASSWORD (nilai dari dashboard Netlify) lewat Keys/API keys.',
    };
  }
  if (pins.includes(pin)) return { success: true };
  return { success: false, error: 'PIN master salah.' };
}

async function handleCheckAdminPersonal(payload) {
  const name = String((payload && payload[0]) || '').trim();
  const pin = String((payload && payload[1]) || '');
  if (!name || !pin) return { success: false, error: 'Nama dan PIN wajib diisi.' };

  let ok = false;
  // 1) KHOCI istimewa: pin-nya dari env PIN_KHOCI (tema Inter Milan di UI).
  if (name.toLowerCase() === 'khoci') {
    const khociPin = env('PIN_KHOCI');
    if (khociPin && khociPin === pin) ok = true;
  }
  // 2) Env ASJ_ADMINS="Nama1:pin1,Nama2:pin2" (cara cepat untuk rebuild).
  const envAdmins = env('ASJ_ADMINS');
  if (envAdmins) {
    for (const item of envAdmins.split(',')) {
      const idx = item.indexOf(':');
      if (idx < 0) continue;
      const n = item.slice(0, idx).trim();
      const p = item.slice(idx + 1).trim();
      if (n.toLowerCase() === name.toLowerCase() && p === pin) ok = true;
    }
  }
  // 3) Tabel admin di Supabase (adaptif).
  if (!ok && hasBackend()) {
    try {
      const found = await findAdmins();
      for (const row of found.rows) {
        const rn = toText(pick(row, ['nama', 'name', 'admin_name', 'username', 'nama_admin']));
        const rp = toText(pick(row, ['pin', 'password', 'pass', 'pin_admin', 'kode']));
        if (rn && rp && rn.toLowerCase() === name.toLowerCase() && rp === pin) ok = true;
      }
    } catch {
      /* tabel admin tidak ditemukan — lanjut */
    }
  }

  if (!ok) return { success: false, error: 'Nama atau PIN salah.' };
  return {
    success: true,
    sessionToken: session.signToken({ role: 'admin', name }),
    // Refresh token "ingat saya": token terpisah (role admin + kind refresh)
    // yang disimpan frontend di key sendiri. Dipakai boot untuk memulihkan
    // sesi admin secara diam-diam (tanpa modal login) selama user tidak
    // logout — walau key sesi utama hilang/terhapus sebagian. Dicabut saat
    // logout (frontend hapus asj_admin_refresh).
    refreshToken: session.signToken({ role: 'admin', name, kind: 'refresh' }),
  };
}

// Pemulihan sesi diam-diam (refresh token, fitur "selalu login selama tidak
// logout"): verifikasi refresh token admin, kalau sah terbitkan sessionToken
// baru. Tidak butuh PIN ulang — token refresh hanya diberikan saat login
// berhasil dan dicabut saat logout, jadi ini setara dengan sesi yang diperpanjang.
async function handleRefreshAdminSession(payload) {
  const rt = String((payload && payload[0]) || '');
  const t = session.verifyToken(rt);
  if (!t || t.role !== 'admin' || t.kind !== 'refresh') {
    return { success: false, sessionInvalid: true, message: 'Sesi admin tidak valid' };
  }
  const name = String(t.name || '');
  return {
    success: true,
    name,
    sessionToken: session.signToken({ role: 'admin', name }),
  };
}

// Gate WA (isValidWaFormat) + normalisasi (normalizeWa) diimpor dari
// shared/wa-rules.js — lihat komentar import di atas.

async function handleLoginKandidat(payload) {
  const wa = normalizeWa(String((payload && payload[0]) || ''));
  const password = String((payload && payload[1]) || '');
  if (!wa || !password) return { success: false, error: 'Nomor WA dan password wajib diisi.' };
  if (!isValidWaFormat(wa)) {
    return {
      success: false,
      error: 'Nomor WA tidak valid. Gunakan format 08xx atau 628xx (12-13 digit).',
    };
  }
  if (!hasBackend()) {
    return { success: false, error: 'Backend belum dikonfigurasi (Supabase keys belum ada).' };
  }
  try {
    const row = await findCandidateByWa(wa);
    if (!row) return { success: false, error: 'Nomor WA belum terdaftar.' };
    const stored = pick(row, ['password_kandidat', 'password', 'pass', 'pin', 'hash']);
    const defaultPass = wa.slice(-4);
    let okPass = false;
    if (stored && String(stored).startsWith('$2')) {
      // bcrypt hash (daftar asli: hash dari 4 digit terakhir WA, atau
      // password pribadi yang sudah diganti kandidat).
      okPass = await bcrypt.compare(password, String(stored));
    } else if (stored == null || stored === '') {
      okPass = password === defaultPass;
    } else {
      okPass = String(stored) === password;
    }
    if (!okPass) return { success: false, error: 'Password salah.' };
    const nama = toText(pick(row, ['nama_lengkap', 'nama', 'name', 'full_name'])) || wa;
    return {
      success: true,
      nama,
      wa,
      sessionToken: session.signToken({ role: 'kandidat', wa }),
      // Refresh token "ingat saya" kandidat (role kandidat + kind refresh):
      // dipakai boot untuk memulihkan sesi tanpa modal login selama user
      // tidak logout — setara dengan fitur admin (8511014).
      refreshToken: session.signToken({ role: 'kandidat', wa, kind: 'refresh' }),
    };
  } catch (e) {
    return { success: false, error: 'Gagal memeriksa kandidat: ' + e.message };
  }
}

// Pemulihan sesi kandidat diam-diam (refresh token) — mirror dari
// handleRefreshAdminSession: refresh token sah → sessionToken baru. Nama
// diambil ulang dari DB (fallback ke WA kalau DB sedang tidak bisa diakses),
// sesi kandidat sendiri tetap valid tanpa DB.
async function handleRefreshKandidatSession(payload) {
  const rt = String((payload && payload[0]) || '');
  const t = session.verifyToken(rt);
  if (!t || t.role !== 'kandidat' || t.kind !== 'refresh') {
    return { success: false, sessionInvalid: true, message: 'Sesi kandidat tidak valid' };
  }
  const wa = normalizeWa(String(t.wa || ''));
  if (!wa) return { success: false, sessionInvalid: true, message: 'Sesi kandidat tidak valid' };
  let nama = wa;
  try {
    const row = await findCandidateByWa(wa);
    if (row) {
      nama = toText(pick(row, ['nama_lengkap', 'nama', 'name', 'full_name'])) || wa;
    }
  } catch (e) {
    /* DB tidak bisa diakses — nama fallback ke WA, sesi tetap valid */
  }
  return {
    success: true,
    nama,
    wa,
    sessionToken: session.signToken({ role: 'kandidat', wa }),
  };
}

async function handleDaftarKandidat(payload) {
  const nama = String((payload && payload[0]) || '').trim();
  const wa = normalizeWa(String((payload && payload[1]) || ''));
  if (!nama || !wa) return { success: false, error: 'Nama dan nomor WA wajib diisi.' };
  // Gate WA: tolak nomor yang bukan HP Indonesia (62 8xx, total 12-13 digit) —
  // biasanya salah ketik yang melahirkan kandidat duplikat di masa lalu.
  if (!isValidWaFormat(wa)) {
    return {
      success: false,
      error:
        'Nomor WA tidak valid (' +
        wa +
        '). Gunakan format 08xx atau 628xx (12-13 digit). Periksa nomor kembali.',
    };
  }
  if (!hasBackend()) {
    return { success: false, error: 'Backend belum dikonfigurasi (Supabase keys belum ada).' };
  }
  // FIX #17: cacheClear SETELAH semua validasi (nama/wa/format/backend) berhasil.
  cacheClear();
  try {
    const found = await findCandidates();
    if (!found.table) {
      return { success: false, error: 'Tabel kandidat belum terdeteksi di Supabase.' };
    }
    // Cek duplikat (format fleksibel 0xx/62xx).
    if (await findCandidateByWa(wa)) {
      return { success: false, error: 'Nomor WA sudah terdaftar.' };
    }
    const defaultPass = wa.slice(-4);
    const hash = bcrypt.hashSync(defaultPass, 10);
    const variants = [
      { nama_lengkap: nama, no_wa: wa, password_kandidat: hash, password_diubah: false },
      { nama_lengkap: nama, no_wa: wa, password: hash },
      { nama, wa, password: hash },
      { nama, whatsapp: wa, password: hash },
      { name: nama, wa, password: hash },
      { name: nama, whatsapp: wa, password: hash },
      { nama, no_wa: wa, password: hash },
    ];
    for (const body of variants) {
      try {
        await supabaseJson('POST', found.table, {
          body,
          headers: { Prefer: 'return=minimal' },
        });
        return { success: true };
      } catch {
        /* coba varian kolom berikutnya */
      }
    }
    return {
      success: false,
      error:
        'Pendaftaran gagal: kolom tabel kandidat tidak cocok dengan mapping. Hubungi developer.',
    };
  } catch (e) {
    return { success: false, error: 'Gagal mendaftar: ' + e.message };
  }
}

async function handleGantiPasswordKandidat(payload, sessionToken) {
  const wa = normalizeWa(String((payload && payload[0]) || ''));
  const lama = String((payload && payload[1]) || '');
  const baru = String((payload && payload[2]) || '');
  if (!wa || !lama || !baru) return { success: false, error: 'Data tidak lengkap.' };
  if (baru.length < 6 || baru.length > 20 || /\s/.test(baru)) {
    return { success: false, error: 'Password baru 6-20 karakter tanpa spasi.' };
  }
  const t = session.verifyToken(sessionToken);
  if (!t || t.role !== 'kandidat' || t.kind === 'refresh' || normalizeWa(t.wa) !== wa) {
    return { success: false, sessionInvalid: true, message: 'Sesi kandidat tidak valid' };
  }
  if (!hasBackend()) {
    return { success: false, error: 'Backend belum dikonfigurasi.' };
  }
  try {
    // Jalur cepat: cari baris kandidat via query server-side (filter WA).
    let row = await findCandidateByWaFiltered(wa);
    let table = 'database_candidate';
    let colWa = null;
    if (row) {
      colWa = CAND_WA_COLS.find((c) => c in row);
    } else if (row === undefined) {
      // Fallback: scan penuh (skema kolom WA tidak dikenal) — sekaligus
      // deteksi nama tabel & kolom.
      const found = await findCandidates();
      table = found.table;
      colWa = CAND_WA_COLS.find((c) => found.rows[0] && c in found.rows[0]);
      if (!colWa) return { success: false, error: 'Kolom password tidak ditemukan.' };
      row = found.rows.find((r) => normalizeWa(String(r[colWa] || '')) === wa);
    }
    const colPass = ['password_kandidat', 'password', 'pass', 'pin'].find((c) => row && c in row);
    if (!row || !colPass) return { success: false, error: 'Kandidat tidak ditemukan.' };
    const stored = row[colPass];
    let okLama =
      stored && String(stored).startsWith('$2')
        ? await bcrypt.compare(lama, String(stored))
        : String(stored || '') === lama;
    if (!okLama) return { success: false, error: 'Password lama salah.' };
    const body = { [colPass]: bcrypt.hashSync(baru, 10) };
    // @ts-expect-error JS→TS migration
    if ('password_diubah' in row) body.password_diubah = true;
    await supabaseJson('PATCH', table, {
      query: { [colWa]: 'eq.' + row[colWa] },
      body,
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal mengganti password: ' + e.message };
  }
}

// Guard role (dipakai banyak handler: admin/kandidat). requireAdmin hanyalah
// requireRole(sessionToken, 'admin') — Fase 1.2, dipusatkan di sini supaya
// tidak ada dobel definisi (dulu ada di actions-extra.js juga).
function requireRole(sessionToken, role) {
  const t = session.verifyToken(sessionToken);
  // Token kind 'refresh' HANYA sah untuk action refresh (refreshAdminSession /
  // refreshKandidatSession) — tidak boleh dipakai sebagai sesi aksi lain.
  if (!t || t.role !== role || t.kind === 'refresh') {
    return {
      error: { success: false, sessionInvalid: true, message: 'Sesi ' + role + ' tidak valid' },
    };
  }
  return { token: t };
}

function requireAdmin(sessionToken) {
  return requireRole(sessionToken, 'admin');
}

// PII guard (REVIEW.md M2): data penuh hanya untuk pemilik WA (kandidat)
// atau admin. Dipusatkan di sini (Fase 1.2) — dulu diduplikasi di
// actions-extra.js; dipakai master + upload/apply.
function isOwnerOrAdmin(sessionToken, wa) {
  const t = session.verifyToken(sessionToken);
  if (!t || t.kind === 'refresh') return false;
  if (t.role === 'admin') return true;
  if (t.role === 'kandidat' && normalizeWa(t.wa || '') === normalizeWa(wa)) {
    return true;
  }
  return false;
}

export {
  masterPins,
  requireAdmin,
  isOwnerOrAdmin,
  requireRole,
  isValidWaFormat,
  handleCheckAdminMaster,
  handleCheckAdminPersonal,
  handleRefreshAdminSession,
  handleRefreshKandidatSession,
  handleLoginKandidat,
  handleDaftarKandidat,
  handleGantiPasswordKandidat,
  registerFcmToken,
};
async function registerFcmToken(payload, sessionToken) {
  // FIX #2 (audit 2026-09-02): Session wajib — tanpa sesi, siapa pun bisa
  // menulis ke fcm_tokens dan menerima push notifikasi korban.
  const t = session.verifyToken(sessionToken);
  if (!t || t.kind === 'refresh') {
    return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };
  }

  const [waStr, token, deviceInfo] = payload;
  const waRaw = String(waStr || '').trim();
  let wa: string;

  if (t.role === 'admin') {
    // Admin boleh register untuk WA mana pun (termasuk 'ADMIN' broadcast).
    wa = waRaw || 'ADMIN';
  } else {
    // Kandidat hanya boleh register untuk WA sendiri.
    wa = normalizeWa(waRaw);
    const sessionWa = normalizeWa(String(t.wa || ''));
    if (!wa || wa !== sessionWa) {
      return { success: false, message: 'Unauthorized: nomor WA tidak sesuai sesi.' };
    }
  }

  if (!wa || !token) return { success: false, message: 'Invalid data' };

  try {
    // Insert/upsert ke tabel fcm_tokens (jika token sama, update last_used_at)
    await supabaseJson('POST', 'fcm_tokens', {
      query: { on_conflict: 'token' },
      body: {
        wa: wa,
        token: token,
        device_info: String(deviceInfo || '').substring(0, 200),
        last_used_at: new Date().toISOString(),
      },
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
