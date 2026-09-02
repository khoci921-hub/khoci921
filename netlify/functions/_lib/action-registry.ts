import * as publicData from './actions-public';
import * as diagnostics from './actions-diagnostics';
import * as auth from './actions-auth';
import * as jobActions from './actions-job';
import * as aiChat from './ai/chat';
import * as aiClassify from './ai/classify';
import * as candidateActions from './actions-candidate';
import * as mailActions from './actions-mail';
import * as upload from './actions-upload';
import * as master from './actions-master';
import * as schedule from './actions-schedule';
import * as wa from './actions-wa';
import * as config from './actions-config';
import * as register from './actions-register';
import * as aiCv from './ai/cv';
import * as download from './actions-download';
// =============================================================================
// action-registry.js — SATU-SATUNYA sumber kebenaran kontrak action backend.
// -----------------------------------------------------------------------------
// Tabel nama action → handler + grup rate limit. Dispatcher (handlers.js)
// memakai tabel ini — bukan switch string. Test kontrak
// (action-registry.test.js) memastikan:
//   - setiap action yang dipanggil frontend (callAPI) ADA di tabel ini,
//   - grup rate limit (LOGIN/AI/FONNTE) hanya berisi action yang terdaftar.
// Tambah action baru = tambah 1 baris DI SINI (jangan di switch lagi).
// =============================================================================

// nama action → handler(payload, sessionToken). Handler dengan arity lebih
// kecil aman (argumen ekstra diabaikan JS).
const ACTION_HANDLERS = {
  // Data publik & diagnostik
  getAppData: publicData.handleGetAppData,
  getMonthlyReport: publicData.handleGetMonthlyReport,
  getAppConfig: diagnostics.handleGetAppConfig,
  reportWebVital: diagnostics.handleReportWebVital,
  // Auth
  checkAdminMaster: auth.handleCheckAdminMaster,
  checkAdminPersonal: auth.handleCheckAdminPersonal,
  refreshAdminSession: auth.handleRefreshAdminSession,
  refreshKandidatSession: auth.handleRefreshKandidatSession,
  loginKandidat: auth.handleLoginKandidat,
  daftarKandidat: auth.handleDaftarKandidat,
  gantiPasswordKandidat: auth.handleGantiPasswordKandidat,
  registerFcmToken: auth.registerFcmToken,
  logout: () => ({ success: true }),
  // Kelola lowongan
  simpanJobBaru: jobActions.handleSimpanJobBaru,
  editLokerFull: jobActions.handleEditLokerFull,
  ubahStatusJob: jobActions.handleUbahStatusJob,
  hapusJobData: jobActions.handleHapusJobData,
  updateTahapanDbJob: jobActions.handleUpdateTahapanDbJob,
  updateDokumenShare: jobActions.handleUpdateDokumenShare,
  tandaiGagalJob: jobActions.handleTandaiGagalJob,
  // Kelola kandidat
  updateCatatanKandidat: candidateActions.handleUpdateCatatanKandidat,
  updateKandidatSuper: candidateActions.handleUpdateKandidatSuper,
  getCandidatesPage: candidateActions.handleGetCandidatesPage,
  // Mail inbox
  reviewForm: mailActions.handleReviewForm,
  approveForm: mailActions.handleApproveForm,
  rejectForm: mailActions.handleRejectForm,
  deleteForm: mailActions.handleDeleteForm,
  tandaiDibacaForm: mailActions.handleTandaiDibacaForm,
  // Upload & file
  getUploadUrls: upload.handleGetUploadUrls,
  // Lamaran publik (apply-full.html)
  cekDataPelamar: upload.handleCekDataPelamar,
  isJobRequiresCv: upload.handleIsJobRequiresCv,
  submitApply: upload.handleSubmitApply,
  getExistingCandidateJsonByWa: upload.handleGetExistingCandidateJsonByWa,
  // Master data (master-full.html, CV)
  getMasterDataByWa: master.handleGetMasterDataByWa,
  getDrafCvMaster: master.handleGetDrafCvMaster,
  submitMasterForm: master.handleSubmitMasterForm,
  simpanBiodataLengkap: master.handleSubmitMasterForm,
  simpanUpdateMaster: master.handleSimpanUpdateMaster,
  simpanKandidatDanUpload: upload.handleSimpanKandidatDanUpload,
  simpanBerkasTahapan: upload.handleSimpanBerkasTahapan,
  simpanRevisiKandidat: upload.handleSimpanRevisiKandidat,
  // Jadwal & tugas
  simpanJadwalBaru: schedule.handleSimpanJadwalBaru,
  hapusJadwal: schedule.handleHapusJadwal,
  tambahTugasBaru: schedule.handleTambahTugasBaru,
  setTugasStatus: schedule.handleSetTugasStatus,
  hapusTugas: schedule.handleHapusTugas,
  checkAndSendAgendaReminders: schedule.handleCheckAndSendAgendaReminders,
  // Template & kirim WA (Fonnte)
  simpanWaTemplate: wa.handleSimpanWaTemplate,
  hapusWaTemplate: wa.handleHapusWaTemplate,
  kirimSatuPesanFonnte: wa.handleKirimSatuPesanFonnte,
  kirimTawaranMassal: wa.handleKirimTawaranMassal,
  // Konfigurasi sistem
  updateSysConfig: config.handleUpdateSysConfig,
  // Preset rincian biaya
  getRincianPresets: config.handleGetRincianPresets,
  saveRincianPreset: config.handleSaveRincianPreset,
  deleteRincianPreset: config.handleDeleteRincianPreset,
  runMigration: config.handleRunMigration,
  // Siswa baru
  getDaftarSiswaBaru: register.handleGetDaftarSiswaBaru,
  submitDaftarSiswa: register.handleSubmitDaftarSiswa,
  // Link & bridge (QR / form)
  getLinkSiswaBaru: register.handleGetLinkSiswaBaru,
  generateFormBridge: register.handleGenerateFormBridge,
  generateLegacyMasterBridge: register.handleGenerateLegacyMasterBridge,
  generateAiFormBridge: register.handleGenerateAiFormBridge,
  // AI (Gemini) & submit AI form
  processAIChat: aiChat.handleProcessAIChat,
  processAdminAIChat: aiChat.handleProcessAdminAIChat,
  processSiswaAIChat: aiChat.handleProcessSiswaAIChat,
  processAiInterview: aiChat.handleProcessAiInterview,
  generateWawancaraModel: aiChat.handleGenerateWawancaraModel,
  simpanHasilWawancara: aiChat.handleSimpanHasilWawancara,
  selesaikanWawancara: aiChat.handleSelesaikanWawancara,
  getHasilWawancara: aiChat.handleGetHasilWawancara,
  parseDokumenBiodata: aiClassify.handleParseDokumenBiodata,
  getAdminAiContext: aiCv.handleGetAdminAiContext,
  buildAdminAiCandidateSummary: aiCv.handleBuildAdminAiCandidateSummary,
  // Smart Ingestion dipindah ke function terpisah (ingest.js)
  // untuk mengurangi ukuran bundle 19 function lainnya (~2.2MB per function).
  // Routing: api-client.ts → processUploadDoc: 'ingest' → /.netlify/functions/ingest
  processUploadDoc: () => ({
    success: false,
    message: 'processUploadDoc has been moved to /ingest function',
  }),
  // Download dokumen kandidat per job (ZIP)
  downloadJobDocs: download.handleDownloadJobDocs,
  submitDataAsj: aiCv.handleSubmitDataAsj,
  simpanDataTtdNaitei: aiCv.handleSimpanDataTtdNaitei,
};

// Grup rate limit (REVIEW.md M3) — dipakai handlers.js (rateLimitChecks &
// lockout login). Hanya berisi action yang terdaftar di atas (dijaga test).
const LOGIN_ACTIONS = new Set([
  'checkAdminMaster',
  'checkAdminPersonal',
  'refreshAdminSession',
  'refreshKandidatSession',
  'loginKandidat',
  'daftarKandidat',
]);
const AI_ACTIONS = new Set([
  'processAIChat',
  'processSiswaAIChat',
  'processAdminAIChat',
  'processAiInterview',
  'parseDokumenBiodata',
  'processUploadDoc',
  'generateWawancaraModel',
]);
const FONNTE_ACTIONS = new Set(['kirimSatuPesanFonnte', 'kirimTawaranMassal']);

export { ACTION_HANDLERS, LOGIN_ACTIONS, AI_ACTIONS, FONNTE_ACTIONS };
