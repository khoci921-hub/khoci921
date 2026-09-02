// ==========================================
// STATE GLOBAL — semua variabel global aplikasi (data dashboard, filter,
// sesi aktif, timer). Diinisialisasi saat script dimuat (urutan STACK).
//
// ESM (Fase 3): file ini adalah modul ES. Semua state di-export agar modul
// ESM lain bisa `import { ALL_JOBS } from './state.ts'` (live binding).
// Pemakai classic (bundel admin/index, sloppy mode) membaca/MENULIS state
// sebagai bare global (`ALL_JOBS = ...`, `isAdmin = true`) — window.* di
// bawah dipasang sebagai ACCESSOR get/set yang mendelegasikan ke binding
// modul, jadi satu sumber kebenaran TIDAK PERNAH basi/desync.
// js/init/* TIDAK dimuat halaman standalone — bridge cukup untuk bundel.
// ==========================================
export var ALL_JOBS: Record<string, any>[] = [];
export var ALL_DB_JOBS: Record<string, any>[] = [];
export var ALL_CANDIDATES: Record<string, any>[] = [];
export var ALL_CANDIDATES_TOTAL = 0; // phantom global lama — kini dideklarasikan resmi (dipakai pagination candidates.js + render admin)
export var ALL_SCHEDULES: Record<string, any>[] = [];
export var ALL_TUGAS: Record<string, any>[] = [];
export var ALL_FORM: Record<string, any>[] = [];
export var ALL_WA_TEMPLATES: Record<string, any>[] = [];
export var ALL_RIWAYAT_KANDIDAT: Record<string, any>[] = [];
export var ASSETS: Record<string, any> = {};
export var CURRENT_THEME = 'TOKYO';
export var DROPDOWNS: Record<string, any> = {};
export var isAdmin = false;
export var isKandidat = false;
export var currentAdminName = '';
export var currentKandidatName = '';
export var currentKandidatWa = '';
export var currentKandidatId = '';
export var limitPub = 10,
  limitAdm = 10,
  limitKan = 50, // 50 baris awal (sebelumnya 10), muat lebih +25
  limitJad = 10,
  limitDb = 10;
export var dbSortType = 'TERBARU',
  dbFilterBidang = 'ALL',
  dbFilterTahapan = 'ALL';
export var mailFilterStatus = 'MENUNGGU';
export var mailSearchText = '';
export var currentPublicFilter = 'ALL';
export var currentCopyListTxt = '';
export var CURRENT_WA_KANDIDAT = null;
export var PREV_MAIL_COUNT = null;
export var AUTO_REFRESH_TIMER = null;

// Variabel state untuk Modal Pemberkasan Sentral
export let ACTIVE_PEMBERKASAN_WA = '';
export let ACTIVE_PEMBERKASAN_NAMA = '';

// ---------------------------------------------------------------------------
// BRIDGE ESM → classic: accessor get/set di window untuk SEMUA state di atas.
// Kenapa accessor (bukan alias biasa): pemakai classic melakukan REASSIGNMENT
// bare (`ALL_JOBS = res.jobs`, `isAdmin = true`, `CURRENT_THEME = theme`).
// Alias data property hanya meng-update window — binding modul jadi basi dan
// import ESM berikutnya membaca nilai lama. Accessor men-delegate tulis/baca
// langsung ke binding modul (satu sumber kebenaran).
// ---------------------------------------------------------------------------
function bridgeState(name, get, set) {
  Object.defineProperty(window, name, { configurable: true, get, set });
}

bridgeState(
  'ALL_JOBS',
  () => ALL_JOBS,
  (v) => {
    ALL_JOBS = v;
  },
);
bridgeState(
  'ALL_DB_JOBS',
  () => ALL_DB_JOBS,
  (v) => {
    ALL_DB_JOBS = v;
  },
);
bridgeState(
  'ALL_CANDIDATES',
  () => ALL_CANDIDATES,
  (v) => {
    ALL_CANDIDATES = v;
  },
);
bridgeState(
  'ALL_CANDIDATES_TOTAL',
  () => ALL_CANDIDATES_TOTAL,
  (v) => {
    ALL_CANDIDATES_TOTAL = v;
  },
);
bridgeState(
  'ALL_SCHEDULES',
  () => ALL_SCHEDULES,
  (v) => {
    ALL_SCHEDULES = v;
  },
);
bridgeState(
  'ALL_TUGAS',
  () => ALL_TUGAS,
  (v) => {
    ALL_TUGAS = v;
  },
);
bridgeState(
  'ALL_FORM',
  () => ALL_FORM,
  (v) => {
    ALL_FORM = v;
  },
);
bridgeState(
  'ALL_WA_TEMPLATES',
  () => ALL_WA_TEMPLATES,
  (v) => {
    ALL_WA_TEMPLATES = v;
  },
);
bridgeState(
  'ALL_RIWAYAT_KANDIDAT',
  () => ALL_RIWAYAT_KANDIDAT,
  (v) => {
    ALL_RIWAYAT_KANDIDAT = v;
  },
);
bridgeState(
  'ASSETS',
  () => ASSETS,
  (v) => {
    ASSETS = v;
  },
);
bridgeState(
  'CURRENT_THEME',
  () => CURRENT_THEME,
  (v) => {
    CURRENT_THEME = v;
  },
);
bridgeState(
  'DROPDOWNS',
  () => DROPDOWNS,
  (v) => {
    DROPDOWNS = v;
  },
);
bridgeState(
  'isAdmin',
  () => isAdmin,
  (v) => {
    isAdmin = v;
  },
);
bridgeState(
  'isKandidat',
  () => isKandidat,
  (v) => {
    isKandidat = v;
  },
);
bridgeState(
  'currentAdminName',
  () => currentAdminName,
  (v) => {
    currentAdminName = v;
  },
);
bridgeState(
  'currentKandidatName',
  () => currentKandidatName,
  (v) => {
    currentKandidatName = v;
  },
);
bridgeState(
  'currentKandidatWa',
  () => currentKandidatWa,
  (v) => {
    currentKandidatWa = v;
  },
);
bridgeState(
  'currentKandidatId',
  () => currentKandidatId,
  (v) => {
    currentKandidatId = v;
  },
);
bridgeState(
  'limitPub',
  () => limitPub,
  (v) => {
    limitPub = v;
  },
);
bridgeState(
  'limitAdm',
  () => limitAdm,
  (v) => {
    limitAdm = v;
  },
);
bridgeState(
  'limitKan',
  () => limitKan,
  (v) => {
    limitKan = v;
  },
);
bridgeState(
  'limitJad',
  () => limitJad,
  (v) => {
    limitJad = v;
  },
);
bridgeState(
  'limitDb',
  () => limitDb,
  (v) => {
    limitDb = v;
  },
);
bridgeState(
  'dbSortType',
  () => dbSortType,
  (v) => {
    dbSortType = v;
  },
);
bridgeState(
  'dbFilterBidang',
  () => dbFilterBidang,
  (v) => {
    dbFilterBidang = v;
  },
);
bridgeState(
  'dbFilterTahapan',
  () => dbFilterTahapan,
  (v) => {
    dbFilterTahapan = v;
  },
);
bridgeState(
  'mailFilterStatus',
  () => mailFilterStatus,
  (v) => {
    mailFilterStatus = v;
  },
);
bridgeState(
  'mailSearchText',
  () => mailSearchText,
  (v) => {
    mailSearchText = v;
  },
);
bridgeState(
  'currentPublicFilter',
  () => currentPublicFilter,
  (v) => {
    currentPublicFilter = v;
  },
);
bridgeState(
  'currentCopyListTxt',
  () => currentCopyListTxt,
  (v) => {
    currentCopyListTxt = v;
  },
);
bridgeState(
  'CURRENT_WA_KANDIDAT',
  () => CURRENT_WA_KANDIDAT,
  (v) => {
    CURRENT_WA_KANDIDAT = v;
  },
);
bridgeState(
  'PREV_MAIL_COUNT',
  () => PREV_MAIL_COUNT,
  (v) => {
    PREV_MAIL_COUNT = v;
  },
);
bridgeState(
  'AUTO_REFRESH_TIMER',
  () => AUTO_REFRESH_TIMER,
  (v) => {
    AUTO_REFRESH_TIMER = v;
  },
);
bridgeState(
  'ACTIVE_PEMBERKASAN_WA',
  () => ACTIVE_PEMBERKASAN_WA,
  (v) => {
    ACTIVE_PEMBERKASAN_WA = v;
  },
);
bridgeState(
  'ACTIVE_PEMBERKASAN_NAMA',
  () => ACTIVE_PEMBERKASAN_NAMA,
  (v) => {
    ACTIVE_PEMBERKASAN_NAMA = v;
  },
);
