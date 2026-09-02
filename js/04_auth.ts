// 6. SISTEM LOGIN & AUTHENTICATION
// ==========================================
// REFACTOR: seluruh alur auth kini async/await + try/catch/finally.
// State tombol dikelola lewat finally sehingga tidak pernah terkunci,
// dan pesan kesalahan ditangani di satu tempat (showAuthError).

// Aturan WA (normalisasi + gate) — SATU sumber kebenaran: shared/wa-rules.js
// (backend netlify/functions/_lib memakai yang sama via db/client).
import { normalizeWa, isValidWaFormat } from '../shared/wa-rules.ts';
import { callAPI } from '../api-client.ts';
import { tr } from '../i18n.ts';
import { showToast, safeSet } from './init/util.ts';
import { registerSeamAliases } from './core/bridge.ts';

import { currentAdminName, currentKandidatWa } from './init/state.ts';
export function bukaModalKandidat(mode) {
  const m = document.getElementById('modal-kandidat');
  if (m) m.classList.remove('hidden');
  const fd = document.getElementById('form-daftar-kandidat');
  if (fd) fd.classList.toggle('hidden', mode !== 'daftar');
  const fl = document.getElementById('form-login-kandidat');
  if (fl) fl.classList.toggle('hidden', mode !== 'login');
}

// Helper: jalankan callAPI dengan state tombol loading + error terpusat.
// Optimistic UI: tombol langsung menampilkan spinner, lalu dikembalikan
// di finally — UI tidak pernah macet walau request gagal/timeout.
export async function runAuthAction(btn, loadingHtml, idleText, fn) {
  if (btn) {
    btn.innerHTML = loadingHtml;
    btn.disabled = true;
  }
  try {
    const res = await fn();
    return res;
  } catch (err) {
    showToast(tr('alert.network') + (err && err.message ? err.message : err), 'error');
    return null;
  } finally {
    if (btn) {
      btn.innerHTML = idleText;
      btn.disabled = false;
    }
  }
}

// Gate WA (login & daftar) — implementasi DIIMPOR dari shared/wa-rules.js
// (normalizeWa + isValidWaFormat). Wrapper di bawah menjaga nama ekspor lama
// agar pemanggil (HTML onclick, lintas file) tidak berubah.
export function normalizeWaInput(w) {
  return normalizeWa(w);
}
export function isValidWaInput(w) {
  return isValidWaFormat(w);
}
// Pesan gate WA: pakai teks panjang (id) kalau ada, fallback ke key lama yang
// sudah diterjemahkan di semua bahasa.
export function toastWaFormat() {
  const m = tr('ui.toast_wa_format');
  return m && m !== 'ui.toast_wa_format' ? m : tr('ui.toast_wa_invalid');
}

export async function prosesDaftarKandidat() {
  const btn = document.getElementById('btn-reg-kandidat');
  const n = document.getElementById('reg-nama').value;
  const w = document.getElementById('reg-wa').value;
  if (!n || !w) {
    showToast(tr('alert.mandatory'), 'error');
    return;
  }
  const waNorm = normalizeWaInput(w);
  if (!isValidWaInput(w)) {
    showToast(toastWaFormat(), 'error');
    return;
  }
  // Password tidak diminta lagi: otomatis 4 digit terakhir nomor WA
  // (kebijakan seragam, lihat daftarKandidat di auth.ts).
  const res = await runAuthAction(
    btn,
    '<i class="fas fa-spinner fa-spin mr-2"></i> ' + tr('ui.registering'),
    tr('button.register'),
    () => callAPI('daftarKandidat', [n, waNorm]),
  );
  if (res && res.success) {
    showToast(tr('alert.success'), 'success');
    bukaModalKandidat('login');
  } else if (res) showToast(res.error, 'error');
}

// Ganti password kandidat (fitur 2026-08-12): password default 4 digit WA
// bisa diganti password pribadi. Backend (auth.ts gantiPasswordKandidat)
// memverifikasi sesi + password lama, menyimpan hash bcrypt baru + flag
// password_diubah=true (UI admin lalu menampilkan peringatan, bukan 4 digit).
export function bukaModalGantiPass() {
  const m = document.getElementById('modal-ganti-pass');
  if (m) m.classList.remove('hidden');
}
export function tutupModalGantiPass() {
  const m = document.getElementById('modal-ganti-pass');
  if (m) m.classList.add('hidden');
}
export async function prosesGantiPasswordKandidat() {
  const btn = document.getElementById('btn-gp-submit');
  const lama = document.getElementById('gp-pass-lama').value;
  const baru = document.getElementById('gp-pass-baru').value;
  const konfirmasi = document.getElementById('gp-pass-konfirmasi').value;
  if (!lama || !baru || !konfirmasi) {
    showToast(tr('alert.mandatory'), 'error');
    return;
  }
  if (baru !== konfirmasi) {
    showToast(tr('ui.pass_mismatch'), 'error');
    return;
  }
  if (baru.length < 6 || baru.length > 20 || /\s/.test(baru)) {
    showToast(tr('ui.pass_new_hint'), 'error');
    return;
  }
  if (!currentKandidatWa) {
    showToast(tr('ui.toast_kandidat_session_expired'), 'error');
    return;
  }
  const res = await runAuthAction(
    btn,
    '<i class="fas fa-spinner fa-spin mr-2"></i> ' + tr('ui.change_password') + '…',
    '<i class="fas fa-check mr-1.5"></i> ' + tr('ui.change_password'),
    () => callAPI('gantiPasswordKandidat', [currentKandidatWa, lama, baru]),
  );
  if (res && res.success) {
    showToast(tr('ui.pass_changed_ok'), 'success');
    tutupModalGantiPass();
    document.getElementById('gp-pass-lama').value = '';
    document.getElementById('gp-pass-baru').value = '';
    document.getElementById('gp-pass-konfirmasi').value = '';
  } else if (res) {
    showToast(res.error || tr('ui.pass_mismatch'), 'error');
  }
}

export async function prosesLoginKandidat() {
  const btn = document.getElementById('btn-log-kandidat');
  const w = document.getElementById('log-wa').value;
  const p = document.getElementById('log-pass').value;

  if (!w || !p) {
    showToast(tr('alert.mandatory'), 'error');
    return;
  }
  const waNorm = normalizeWaInput(w);
  if (!isValidWaInput(w)) {
    showToast(toastWaFormat(), 'error');
    return;
  }

  const res = await runAuthAction(
    btn,
    '<i class="fas fa-spinner fa-spin mr-2"></i> ' + tr('ui.searching_data'),
    tr('button.enter_dashboard'),
    () => callAPI('loginKandidat', [waNorm, p]),
  );

  if (res && res.success) {
    localStorage.setItem('asj_kandidat_login', 'sukses');
    localStorage.setItem('asj_kandidat_name', res.nama);
    localStorage.setItem('asj_kandidat_wa', res.wa);
    // Session kandidat ASLI dari server (loginKandidat) - dipakai
    // semua aksi kandidat (getAppData mode kandidat, simpanUpdateMaster,
    // ganti password, dll). Bukan lagi token acak buatan client.
    localStorage.setItem('asj_kandidat_session', res.sessionToken || '');
    // Refresh token "ingat saya" kandidat (key terpisah): dipakai boot
    // untuk memulihkan sesi tanpa modal login selama tidak logout.
    if (res.refreshToken) localStorage.setItem('asj_kandidat_refresh', res.refreshToken);
    localStorage.setItem(
      'asj_session_token',
      Date.now().toString(36) + Math.random().toString(36).substr(2),
    );

    document.getElementById('modal-kandidat').classList.add('hidden');
    window.isKandidat = true;
    window.currentKandidatName = res.nama;
    window.currentKandidatWa = res.wa;

    const navM = document.getElementById('nav-mode');
    if (navM) navM.classList.add('hidden');
    const navK = document.getElementById('nav-kandidat-mode');
    if (navK) navK.classList.remove('hidden');

    // Sync mobile nav
    const mLoggedOut = document.getElementById('mobile-nav-logged-out');
    const mAdmin = document.getElementById('mobile-nav-admin');
    const mKandidat = document.getElementById('mobile-nav-kandidat');
    if (mLoggedOut) mLoggedOut.classList.add('hidden');
    if (mAdmin) mAdmin.classList.add('hidden');
    if (mKandidat) mKandidat.classList.remove('hidden');

    // Optimistic UI: pindah tampilan dulu, data di-refresh paralel di background
    await window.refreshDataDinamis();
  } else if (res) {
    showToast(res.error, 'error');
  }
}

export function showLoginAdminMaster() {
  const s1 = document.getElementById('login-step-1');
  if (s1) s1.classList.remove('hidden');
  const s2 = document.getElementById('login-step-2');
  if (s2) s2.classList.add('hidden');
  const s3 = document.getElementById('login-step-3');
  if (s3) s3.classList.add('hidden');
  const m = document.getElementById('modal-admin');
  if (m) m.classList.remove('hidden');
}

export async function prosesLoginMaster() {
  const pin = document.getElementById('admin-pin-master').value;
  const btn = document.getElementById('btn-login-master');
  const res = await runAuthAction(
    btn,
    '<i class="fas fa-spinner fa-spin mr-2"></i> ' + tr('ui.checking'),
    tr('button.verify'),
    () => callAPI('checkAdminMaster', [pin, localStorage.getItem('asj_session_token') || '']),
  );
  if (res && res.success) {
    document.getElementById('login-step-1').classList.add('hidden');
    document.getElementById('login-step-2').classList.remove('hidden');
  } else if (res) {
    showToast(res.error, 'error');
  }
}

export function showLoginPersonal(name) {
  const s2 = document.getElementById('login-step-2');
  if (s2) s2.classList.add('hidden');
  safeSet('lbl-nama-admin', tr('header.admin_login') + ' ' + name);
  const t = document.getElementById('admin-name-temp');
  if (t) t.value = name;
  const s3 = document.getElementById('login-step-3');
  if (s3) s3.classList.remove('hidden');
}

export async function prosesLoginPersonal() {
  const name = document.getElementById('admin-name-temp').value;
  const pin = document.getElementById('admin-pin-personal').value;
  const btn = document.getElementById('btn-login-personal');

  const res = await runAuthAction(
    btn,
    '<i class="fas fa-spinner fa-spin mr-2"></i> ' + tr('ui.checking'),
    tr('button.enter_portal'),
    () =>
      callAPI('checkAdminPersonal', [name, pin, localStorage.getItem('asj_session_token') || '']),
  );

  if (res && res.success) {
    localStorage.setItem('asj_admin_login', 'sukses');
    localStorage.setItem('asj_admin_name', name);
    // FASE 2 fix: dulu di sini men-generate token acak sendiri
    // (cuma dipakai sebagai key rate-limit, bukan otorisasi asli).
    // Sekarang simpan sessionToken ASLI dari server (hasil
    // createSession di checkAdminPersonal) - inilah yang dicek
    // ulang oleh doPost untuk semua aksi admin.
    localStorage.setItem('asj_admin_session', res.sessionToken || '');
    // Refresh token "ingat saya" (key terpisah): dipakai boot untuk
    // memulihkan sesi admin tanpa modal login selama tidak logout.
    if (res.refreshToken) localStorage.setItem('asj_admin_refresh', res.refreshToken);
    document.getElementById('modal-admin').classList.add('hidden');
    // @ts-expect-error JS→TS migration
    window.isAdmin = true;
    window.currentAdminName = name;
    document.getElementById('nav-mode').classList.add('hidden');
    document.getElementById('nav-admin-mode').classList.remove('hidden');

    const mLoggedOut = document.getElementById('mobile-nav-logged-out');
    const mAdmin = document.getElementById('mobile-nav-admin');
    const mKandidat = document.getElementById('mobile-nav-kandidat');
    if (mLoggedOut) mLoggedOut.classList.add('hidden');
    if (mAdmin) mAdmin.classList.remove('hidden');
    if (mKandidat) mKandidat.classList.add('hidden');

    window.changePage('admin');
    await window.refreshDataDinamis();

    // 👉 TRIGGER TEMA KHOCI SAAT BARU LOGIN
    if (currentAdminName === 'KHOCI') {
      setTimeout(window.applyInterMilanVibe, 50);
    }
  } else if (res) {
    window.showToast(res.error, 'error');
  }
}

// ---------------------------------------------------------------------------
// BRIDGE ESM → classic (bundel admin/index): alias window.* untuk SEMUA
// fungsi auth. Diperlukan karena pemanggil utama adalah HTML inline
// onclick (bukaModalKandidat, prosesLoginKandidat, showLoginAdminMaster,
// …) + lintas file (util.js pakai window.toastWaFormat, boot.js pakai
// window.showLoginAdminMaster). js/04_auth.js TIDAK dimuat halaman
// standalone — bridge hanya untuk bundel.
// ---------------------------------------------------------------------------
// Gate WA (normalizeWaInput/isValidWaInput) dipakai admin_ops/candidates.js
// parseDaftarOrtu (Undang Grup Kelas) — 0xx/8xx otomatis jadi 62xx + validasi
// 628… 12-13 digit. Alias ini SEMPAT dihapus saat pembersihan Fase 3.5 L6 dan
// mematahkan normalisasi WA fitur itu (fallback regex ketat menolak 0xx/8xx).
registerSeamAliases({
  bukaModalKandidat,
  normalizeWaInput,
  isValidWaInput,
  toastWaFormat,
  prosesDaftarKandidat,
  bukaModalGantiPass,
  tutupModalGantiPass,
  prosesGantiPasswordKandidat,
  prosesLoginKandidat,
  showLoginAdminMaster,
  prosesLoginMaster,
  showLoginPersonal,
  prosesLoginPersonal,
});

// ==========================================
