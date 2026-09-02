// ============================================================
// api-client.js — Bridge ke Netlify Functions + Supabase
// ============================================================
// ESM (Fase 3): file ini adalah modul ES. API publik (callAPI, esc, escJs,
// resolveSelfUrl) memakai `export` + alias window.* di bawah untuk pemakai
// classic. Internal (NETLIFY_API_BASE, CANDIDATE_ACTIONS, ADMIN_ACTIONS,
// NETLIFY_FUNCTIONS, getApiUrl, callNetlify) kini PRIVATE modul — tidak bocor
// ke global scope (dulu jadi global di bundel concat).
// Seluruh backend sudah dipindah dari Google Apps Script ke Netlify Functions
// + Supabase. Semua action di bawah ini punya implementasi Netlify sendiri;
// tidak ada jalur GAS sama sekali (callAPI murni POST ke /.netlify/functions).

const NETLIFY_API_BASE = '/.netlify/functions';

// Aksi yang hanya boleh dipakai kandidat yang SUDAH LOGIN (session kandidat
// asli dari server, bukan hanya nomor WA). callAPI menempelkan asj_kandidat_session
// ke body request untuk action ini, dan backend memvalidasinya (WA harus cocok).
const CANDIDATE_ACTIONS = new Set([
  'getMasterDataByWa',
  'submitMasterForm',
  // M2 (REVIEW.md): getExistingCandidateJsonByWa memakai gerbang sesi —
  // kirim token supaya kandidat/admin tetap dapat data penuh (prefill).
  'getExistingCandidateJsonByWa',
  'getDrafCvMaster',
  'simpanUpdateMaster',
  'simpanBiodataLengkap',
  'simpanRevisiKandidat',
  'simpanBerkasTahapan',
  'simpanDataTtdNaitei',
  'gantiPasswordKandidat',
  // Simulator wawancara (VIP) — wajib token kandidat (backend requireRole).
  'processAiInterview',
  'selesaikanWawancara',
  'simpanHasilWawancara',
  // AI CV (ai_form, flow=master) dipakai KANDIDAT (VIP) DAN ADMIN (tombol AI CV
  // di tabel admin → bridge window berbagi localStorage). Kirim token yang
  // sedang aktif: utamakan admin supaya server bisa izinkan admin membuka AI CV
  // untuk kandidat non-VIP (guard VIP tetap berlaku untuk kandidat).
  'processAIChat',
  // Submit AI form (ai_form, saveToDatabase) dipakai KANDIDAT (data sendiri,
  // sesi harus cocok dengan WA yang dikirim) DAN ADMIN (bridge, WA apa pun).
  // Backend ai-form-submit.ts memvalidasi: admin valid ATAU kandidat pemilik WA
  // itu — selainnya 401 (anti spoof WA: tanpa sesi, data tidak bisa ditimpa).
  'submitDataAsj',
  // FCM Token Registration
  'registerFcmToken',
]);

const ADMIN_ACTIONS = new Set([
  'approveForm',
  'editLokerFull',
  'hapusJadwal',
  'hapusJobData',
  'hapusWaTemplate',
  'kirimSatuPesanFonnte',
  'rejectForm',
  'reviewForm',
  'hapusTugas',
  'setTugasStatus',
  'simpanJadwalBaru',
  'simpanJobBaru',
  'simpanWaTemplate',
  'tambahTugasBaru',
  'ubahStatusJob',
  'updateCatatanKandidat',
  'updateKandidatSuper',
  'getCandidatesPage',
  'deleteForm',
  'tandaiDibacaForm',
  'updateTahapanDbJob',
  'simpanKandidatDanUpload',
  'tandaiGagalJob',
  'updateDokumenShare',
  'getRincianPresets',
  'saveRincianPreset',
  'deleteRincianPreset',
  'runMigration',
  // Aksi admin yang dulu tanpa gerbang server (audit keamanan 2026-08-09) -
  // sekarang wajib sesi admin di backend, jadi frontend harus kirim sessionToken.
  'updateSysConfig',
  'getAppConfig',
  'getDaftarSiswaBaru',
  'kirimTawaranMassal',
  'processAdminAIChat',
  'getAdminAiContext',
  'buildAdminAiCandidateSummary',
  'parseDokumenBiodata',
  'processUploadDoc',
  'downloadJobDocs',
  'generateWawancaraModel',
  'getHasilWawancara',
  'getMonthlyReport',
  // Signed upload URL ke Storage (files.ts) - sekarang wajib sesi admin.
  'getUploadUrls',
]);

const NETLIFY_FUNCTIONS = {
  // AI (Gemini)
  processAIChat: 'ai-chat',
  processAdminAIChat: 'ai-chat',
  processSiswaAIChat: 'ai-chat',
  processAiInterview: 'ai-chat',
  selesaikanWawancara: 'ai-chat',
  simpanHasilWawancara: 'ai-chat',
  // Form AI + upload berkas
  submitDataAsj: 'ai-form-submit',
  submitDaftarSiswa: 'ai-form-submit',
  simpanDataTtdNaitei: 'ai-form-submit',
  // Context AI admin
  getAdminAiContext: 'admin-ai-context',
  buildAdminAiCandidateSummary: 'admin-ai-context',
  parseDokumenBiodata: 'admin-ai-context',
  generateWawancaraModel: 'admin-ai-context',
  getHasilWawancara: 'admin-ai-context',
  // Jadwal & tugas
  checkAndSendAgendaReminders: 'schedule-reminders',
  simpanJadwalBaru: 'schedule-reminders',
  hapusJadwal: 'schedule-reminders',
  tambahTugasBaru: 'schedule-reminders',
  setTugasStatus: 'schedule-reminders',
  hapusTugas: 'schedule-reminders',
  // WhatsApp (Fonnte)
  kirimTawaranMassal: 'whatsapp',
  kirimSatuPesanFonnte: 'whatsapp',
  simpanWaTemplate: 'whatsapp',
  hapusWaTemplate: 'whatsapp',
  // Konfigurasi sistem
  getAppConfig: 'config',
  updateSysConfig: 'config',
  reportWebVital: 'config',
  // File generik (Supabase Storage) - hanya getUploadUrls (upload/list/delete
  // generik dihapus dari files.ts karena tidak dipakai & tanpa gerbang admin)
  getUploadUrls: 'files',
  // Smart Ingestion → function terpisah (ingest.js) agar heavy deps
  // (pdf-parse, xlsx, mammoth) tidak dibundle ke semua 19 function lainnya.
  processUploadDoc: 'ingest',
  // Download semua dokumen kandidat per job (ZIP)
  downloadJobDocs: 'files',
  // Data utama aplikasi
  getAppData: 'get-app-data',
  getMonthlyReport: 'get-app-data',
  // Auth & akun
  daftarKandidat: 'auth',
  loginKandidat: 'auth',
  checkAdminMaster: 'auth',
  checkAdminPersonal: 'auth',
  refreshAdminSession: 'auth',
  refreshKandidatSession: 'auth',
  gantiPasswordKandidat: 'auth',
  logout: 'auth',
  // Lamaran publik (apply-full.html)
  cekDataPelamar: 'apply',
  isJobRequiresCv: 'apply',
  submitApply: 'apply',
  getExistingCandidateJsonByWa: 'apply',
  // Data master kandidat (master-full.html + admin)
  getMasterDataByWa: 'master-data',
  submitMasterForm: 'master-data',
  getDrafCvMaster: 'master-data',
  simpanUpdateMaster: 'master-data',
  simpanKandidatDanUpload: 'master-data',
  simpanBiodataLengkap: 'master-data',
  simpanRevisiKandidat: 'master-data',
  simpanBerkasTahapan: 'master-data',
  // Manajemen loker (admin)
  simpanJobBaru: 'jobs',
  editLokerFull: 'jobs',
  ubahStatusJob: 'jobs',
  hapusJobData: 'jobs',
  updateTahapanDbJob: 'jobs',
  tandaiGagalJob: 'jobs',
  updateDokumenShare: 'jobs',
  // Manajemen kandidat (admin)
  updateKandidatSuper: 'candidates',
  getCandidatesPage: 'candidates',
  updateCatatanKandidat: 'candidates',
  approveForm: 'candidates',
  rejectForm: 'candidates',
  reviewForm: 'candidates',
  deleteForm: 'candidates',
  tandaiDibacaForm: 'candidates',
  // Link bridge & siswa baru
  getDaftarSiswaBaru: 'bridge-links',
  getLinkSiswaBaru: 'bridge-links',
  generateFormBridge: 'bridge-links',
  generateLegacyMasterBridge: 'bridge-links',
  generateAiFormBridge: 'bridge-links',
  // FCM Push Notifications
  registerFcmToken: 'auth',
  // Sinkronisasi & pembersihan data
  // Preset Rincian Biaya (koleksi admin)
  getRincianPresets: 'rincian-presets',
  saveRincianPreset: 'rincian-presets',
  deleteRincianPreset: 'rincian-presets',
  // Migrasi database (tombol di tab Pengaturan)
  runMigration: 'run-migration',
  // Migrasi kandidat dari link Google Drive ke Storage
  getDriveLinkCandidates: 'drive-links',
  uploadDriveReplacement: 'drive-links',
};

function getApiUrl(action) {
  const funcName = NETLIFY_FUNCTIONS[action];
  return NETLIFY_API_BASE + '/' + (funcName || action);
}

// SWR-lite cache (Fase 3 langkah 16) — kurangi tarikan data berulang.
// Tarikan data utama (getAppData / getAppConfig / getCandidatesPage) di-cache di sessionStorage dengan
// TTL panjang (5 menit): repeat visits (reload halaman) akan memuat data instan (0 ms).
// Semua action BUKAN pembaca (mutasi/login/logout) meng-invalidate cache.
// Cache disimpan di sessionStorage (per-tab) supaya aman & auto-bersih.
const CACHEABLE_READS = new Set(['getAppData', 'getAppConfig', 'getCandidatesPage']);
const READ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit — cocok untuk repeat visits

export async function callAPI(action, payload) {
  const funcName = NETLIFY_FUNCTIONS[action];
  if (!funcName) {
    console.error('[api-client] Tidak ada function Netlify terdaftar untuk action:', action);
    return { success: false, error: 'Aksi tidak dikenal: ' + action };
  }

  // SWR-lite: pembaca yang masih fresh → balas dari cache tanpa jaringan.
  if (CACHEABLE_READS.has(action)) {
    const cacheKey = 'asj_cache_' + action + ':' + JSON.stringify(payload || []);
    try {
      const hitStr = sessionStorage.getItem(cacheKey);
      if (hitStr) {
        const hit = JSON.parse(hitStr);
        if (Date.now() - hit.at < READ_CACHE_TTL_MS) return hit.value;
        sessionStorage.removeItem(cacheKey); // basi → buang, fetch ulang
      }
    } catch (e) {}
  } else {
    // Bukan pembaca (mutasi/login/logout) → data yang di-cache berpeluang
    // basi, invalidate semua cache yang dibuat oleh kita.
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('asj_cache_')) sessionStorage.removeItem(key);
      }
    } catch (e) {}
  }

  const url = NETLIFY_API_BASE + '/' + funcName;
  const body: Record<string, unknown> = { action: action, payload: payload };

  if (action === 'logout') {
    // Logout dipakai admin DAN kandidat - kirim token yang sedang aktif
    // (utamakan admin kalau keduanya login di perangkat yang sama).
    body.sessionToken =
      (localStorage.getItem('asj_admin_login') === 'sukses'
        ? localStorage.getItem('asj_admin_session')
        : localStorage.getItem('asj_kandidat_session')) || '';
  } else if (
    ADMIN_ACTIONS.has(action) ||
    (action === 'getAppData' && payload && payload[0] === 'admin')
  ) {
    body.sessionToken = localStorage.getItem('asj_admin_session') || '';
  } else if (
    CANDIDATE_ACTIONS.has(action) ||
    (action === 'getAppData' && payload && payload[0] === 'kandidat')
  ) {
    // Beberapa action dipakai ADMIN dan KANDIDAT (mis. getDrafCvMaster untuk
    // preview CV dari tabel admin, getMasterDataByWa). Kalau admin sedang
    // login, kirim token admin; kalau tidak, token kandidat.
    body.sessionToken =
      (localStorage.getItem('asj_admin_login') === 'sukses'
        ? localStorage.getItem('asj_admin_session')
        : localStorage.getItem('asj_kandidat_session')) || '';
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { success: false, message: text };
    }
    // FIX A1#1: Server error (500) → user-facing message bukan raw HTML
    if (!res.ok && parsed && !parsed.success) {
      parsed.message =
        'Server error (' + res.status + '): ' + (parsed.message || text.slice(0, 200));
    }
    if (parsed && parsed.sessionInvalid) {
      // Pesan jelas sebelum reload — dulu ini diam-diam (data kosong /
      // logout sendiri tanpa penjelasan). Sekarang beri tahu user sesi
      // sudah berakhir dan minta login ulang.
      try {
        const adminLogged = localStorage.getItem('asj_admin_login') === 'sukses';
        const kandidatLogged = localStorage.getItem('asj_kandidat_login') === 'sukses';
        const msg = adminLogged
          ? window.tr('ui.toast_admin_session_expired')
          : kandidatLogged
            ? window.tr('ui.toast_kandidat_session_expired')
            : 'Sesi berakhir, silakan login ulang.';
        if (typeof window.showToast === 'function') window.showToast(msg, 'error');
        else if (typeof alert === 'function') alert(msg);
      } catch (e) {
        /* toast opsional — jangan sampai memblokir reload */
      }
      localStorage.removeItem('asj_admin_login');
      localStorage.removeItem('asj_admin_session');
      localStorage.removeItem('asj_admin_name');
      localStorage.removeItem('asj_kandidat_login');
      localStorage.removeItem('asj_kandidat_name');
      localStorage.removeItem('asj_kandidat_wa');
      localStorage.removeItem('asj_kandidat_session');
      window.location.reload();
    }
    // Simpan hasil pembaca yang valid utk cache SWR-lite (skip sessionInvalid).
    if (CACHEABLE_READS.has(action) && parsed && !parsed.sessionInvalid) {
      const cacheKey = 'asj_cache_' + action + ':' + JSON.stringify(payload || []);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), value: parsed }));
      } catch (e) {
        // FIX A1#3: sessionStorage penuh → degrade ke non-cache (sudah aman)
        console.warn('[api-client] Cache write gagal:', e.message);
      }
    }
    return parsed;
  } catch (err) {
    console.error('[Netlify Error]', action, err);
    return { success: false, error: err.message || 'Network error' };
  }
}

// ============================================================
// esc() / escJs() — escape HTML global (REVIEW.md S1).
// Dipakai SEMUA halaman (bundel index/admin + halaman standalone)
// untuk data user-supplied sebelum masuk ke innerHTML / atribut /
// argumen onclick. esc() untuk teks & atribut; escJs() untuk nilai
// yang disisipkan ke string JS di dalam onclick (escape \ dan kutip).
// ============================================================
export function esc(x) {
  return String(x == null ? '' : x)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escJs(x) {
  // Nilai disisipkan ke string JS DI DALAM atribut HTML ber-tanda kutip
  // ganda: onclick="fn('...')". Dua lapis yang harus dijaga:
  //   1) JS: \\ -> \\\\ dulu, lalu ' -> \\' (urutan ini wajib supaya
  //      payload \\ + ' tidak merusak literal string).
  //   2) HTML: & < > " -> entity. Tanpa ini, " di payload tetap
  //      memutus atribut (\\" bukan escape HTML) dan sisanya bocor
  //      menjadi atribut baru (stored XSS — diverifikasi di browser).
  //      Entity ter-decode balik oleh parser HTML sebelum masuk ke JS,
  //      jadi string JS-nya tetap utuh dan aman.
  return String(x == null ? '' : x)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\r\n\u2028\u2029]/g, ' ');
}

// Alias window.* (esc/escJs/dst) dipasang via registry seam di
// js/core/bridge.js (Fase 3.5 L6) — file ini murni ESM.

// ============================================================
// resolveSelfUrl(url) — paksa URL form bridge ke origin aplikasi
// yang sedang dipakai.
// Backend siteBase() memakai env NETLIFY_SITE_URL (nilai bisa basi,
// mis. menunjuk situs lama). Akibatnya di preview lokal / Netlify aktif
// yang berbeda, tombol "Form Master Lengkap / AI CV / Lamaran / Siswa"
// melompat ke situs lain. Kalau origin hasil bridge berbeda dengan
// window.location.origin, ganti origin-nya (path/query tetap) supaya
// form terbuka di aplikasi yang sedang dipakai. URL relatif dibiarkan.
// ============================================================
export function resolveSelfUrl(url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return url;
  try {
    const u = new URL(url);
    if (u.origin !== window.location.origin) {
      return window.location.origin + u.pathname + u.search + u.hash;
    }
  } catch (e) {
    /* URL tidak valid — biarkan apa adanya */
  }
  return url;
}

// callAPI() adalah kontrak global utama — dipakai ~40 file frontend (js/*,
// js/pages/*, upload-guard) sebagai bare global. Alias window.* dipasang via
// registry seam di js/core/bridge.js (Fase 3.5 L6) — file ini murni ESM.

// Semua pemanggilan di frontend memakai callAPI() langsung ke Netlify Functions
// + Supabase — tidak ada lagi jalur Google Apps Script / callGAS.
