// types/globals.d.ts — Auto-generated global type declarations for ASJ Portal
// Generated from registerSeamAliases() + window.X= assignments across all source files.

interface Window {
  PortalBridge: Record<string, unknown>;
  IS_ADMIN_PORTAL: boolean;
  currentTheme: string;
  CURRENT_LANG: string;
  tr: (key: string, replacements?: Record<string, string>) => string;
  trOption: (value: string) => string;
  trOptionId: (value: string) => string;
  callAPI: (action: string, payload?: unknown) => Promise<any>;
  esc: (x: string) => string;
  escJs: (x: string) => string;
  resolveSelfUrl: (url: string) => string;
  renderLanguage: () => void;
  renderLanguageLight: () => void;
  toggleFormLanguage: () => void;
  isAdmin: () => boolean;
  showToast: (message: string, type?: string) => void;
  toast: (message: string, type?: string) => void;
  uploadToCloudinary: (file: File, opts?: any, maxRetries?: number) => Promise<string>;
  loadCandidatesPage?: (page: number) => void;
  loadFormInboxPage?: (page: number) => void;

  // Auto-generated: 265 dynamic window functions
  adaModalTerbuka: any;
  addArrayItem: any;
  adminSwitchTab: any;
  aksiAdmin: any;
  aksiGenerateQr: any;
  applyInterMilanVibe: any;
  applyTheme: any;
  bacaFileBase64: any;
  badgeTahapanDb: any;
  batalEditWa: any;
  buildCvIdentitas: any;
  buildCvKertasA4: any;
  buildEduRows: any;
  buildFamRows: any;
  buildJobRows: any;
  bukaAdminAiCopilot: any;
  bukaDetailLoker: any;
  bukaDigitalCV: any;
  bukaEditFullLoker: any;
  bukaFormBridge: any;
  bukaFormSiswa: any;
  bukaFotoPreview: any;
  bukaLayarCanvas: any;
  bukaMasterEksternal: any;
  bukaMasterEksternalAdmin: any;
  bukaMasterLengkapPortal: any;
  bukaMatchmaking: any;
  bukaModalCekDataSiswa: any;
  bukaModalCvMini: any;
  bukaModalEditDbJob: any;
  bukaModalGantiPass: any;
  bukaModalKandidat: any;
  bukaModalListKandidat: any;
  bukaModalPemberkasan: any;
  bukaModalShare: any;
  bukaModalTambahKandidat: any;
  bukaModalTtd: any;
  bukaModalUndanganKelas: any;
  bukaModalWaPintar: any;
  bukaPamflet: any;
  bukaPdfPreview: any;
  bukaPreviewCV: any;
  bukaPreviewCV_Admin: any;
  bukaPreviewDokumen: any;
  bukaSimulatorInterview: any;
  bukaSuperEditKandidat: any;
  cariKandidatManual: any;
  cekEkstensiFile: any;
  cekKandidatOtomatis: any;
  cekRiwayat: any;
  cekUkuranFile: any;
  cekUploadFile: any;
  cetakCVRirekisho: any;
  changePage: any;
  changeStep: any;
  clearColumnFilters: any;
  clearFsCanvas: any;
  closePreview: any;
  cloudinaryEndpoint: any;
  cobaInstallApp: any;
  compressImage: any;
  copasShareWa: any;
  copyShareLink: any;
  currentAdminName: any;
  currentCopyListTxt: any;
  currentKandidatId: any;
  currentKandidatName: any;
  currentKandidatWa: any;
  currentPublicFilter: any;
  dbFilterBidang: any;
  dbFilterTahapan: any;
  dbSortType: any;
  debouncedFilterDbJob: any;
  dynamicExtraFiles: any;
  dynamicReqStr: any;
  editWaTemplate: any;
  ensureAllCandidates: any;
  evaluasiTahapanKandidat: any;
  exportKandidatCsv: any;
  filterCbx: any;
  filterDbJob: any;
  filterKandidat: any;
  filterKelolaLoker: any;
  filterPublicData: any;
  fmtMonthYearJp: any;
  formatInputWA: any;
  formatPendidikanTingkat: any;
  gateLogin: any;
  generateWawancaraModelAdmin: any;
  getDirectDownloadUrl: any;
  getHighResImage: any;
  getPath: any;
  getSavedTheme: any;
  getTahapanProgress: any;
  getThemeKey: any;
  handleDocUpload: any;
  handleEnter: any;
  handleExtraFile: any;
  handleFile: any;
  hapusBarisLain: any;
  hapusConfigItem: any;
  hapusFormMail: any;
  hapusFormMailTerpilih: any;
  hapusLoker: any;
  hapusRingWA: any;
  hapusTugasAdmin: any;
  initApp: any;
  injectModalWaPintar: any;
  isGood: any;
  isKandidat: any;
  isPreviewableFile: any;
  isValidWaInput: any;
  isVipCatatan: any;
  jalankanMatchmaking: any;
  jalankanMigrasi: any;
  jalankanSemuaSkeleton: any;
  jobTutupUntukLamar: any;
  kalkulasiProgress: any;
  keluarkanKandidatDariJob: any;
  kirimPesanAdminAi: any;
  kirimTawaranMassal: any;
  kirimTemplateKelas: any;
  kirimUndanganKelas: any;
  kirimWaPintar: any;
  lamarJob: any;
  lihatHasilWawancaraAdmin: any;
  limitPub: any;
  logoutApp: any;
  lokerGenderBadge: any;
  mailSelectAll: any;
  makeV: any;
  muatLebihKandidat: any;
  mulaiKirimUndanganGrup: any;
  normalizePhone: any;
  normalizeWaInput: any;
  oldExtraFilesMap: any;
  onColumnFilterChange: any;
  onFamPekerjaanSelect: any;
  onPekerjaanSelect: any;
  onSswSelect: any;
  onload: any;
  openPreview: any;
  openRincianBuilder: any;
  parseDaftarOrtu: any;
  parseRincianBiaya: any;
  parseVarianPesan: any;
  pastikanBarParseAdminAi: any;
  pesanPreviewTidakTersedia: any;
  pilihKandidatManual: any;
  pilihLokerRiwayat: any;
  pindahConfigItem: any;
  populate: any;
  populateCheckboxes: any;
  previewFileInFrame: any;
  previewFinalUrl: any;
  previewUndanganKelas: any;
  prosesApproveForm: any;
  prosesDaftarKandidat: any;
  prosesGantiPasswordKandidat: any;
  prosesHapusJadwal: any;
  prosesHapusWa: any;
  prosesLoginKandidat: any;
  prosesLoginMaster: any;
  prosesLoginPersonal: any;
  prosesRejectForm: any;
  prosesReviewForm: any;
  prosesSimpanBiodataLengkap: any;
  prosesSimpanCvMini: any;
  prosesUploadKandidat: any;
  prosesUploadPemberkasan: any;
  prosesUploadRevisi: any;
  rbAddChip: any;
  rbAddTahapan: any;
  rbBatal: any;
  rbRemoveTahapan: any;
  rbRenderPreview: any;
  rbSimpan: any;
  rbSummaryFromData: any;
  rePopulateDropdowns: any;
  refreshDataDinamis: any;
  removeArrayItem: any;
  renderAdmin: any;
  renderDashboardAgenda: any;
  renderDbFilters: any;
  renderFormInbox: any;
  renderGrid: any;
  renderJadwal: any;
  renderMailFilterUI: any;
  renderPublicFiltered: any;
  renderSysConfig: any;
  renderTugas: any;
  requestNotificationPermission: any;
  safeSet: any;
  safeSetVal: any;
  salinSqlMigrasi: any;
  salinTeksDecode: any;
  saveFsCanvas: any;
  saveToDatabase: any;
  sedangDiscrollTabel: any;
  sendInterviewMessage: any;
  sendMessage: any;
  setBg: any;
  setFilterBidang: any;
  setFilterTahapan: any;
  setImg: any;
  setLanguage: any;
  setSortDb: any;
  showLoginAdminMaster: any;
  showLoginPersonal: any;
  showMonthlyReport: any;
  simpanCatatanCv: any;
  simpanDokumenShare: any;
  simpanEditCepatCv: any;
  simpanKandidatDariAi: any;
  simpanPengumuman: any;
  simpanSuperEditKandidat: any;
  simpanUpdateDbJob: any;
  submitApply: any;
  submitDataEsignFull: any;
  submitEditFullLoker: any;
  submitFormAdmin: any;
  submitJadwal: any;
  submitMaster: any;
  submitRejectForm: any;
  submitSelection: any;
  submitWaTemplate: any;
  switchPublicTab: any;
  switchTab: any;
  tahapanPipeline: any;
  tahapanStepIndex: any;
  tambahBarisLain: any;
  tambahConfigItem: any;
  tambahPesanAdminAi: any;
  tambahTugasAdmin: any;
  tandaiDibacaForm: any;
  tandaiFileDipilih: any;
  terapkanTemplateWa: any;
  thumbnailUrl: any;
  toDateInputValue: any;
  toastWaFormat: any;
  toggleEditCepatCv: any;
  toggleImaMade: any;
  toggleLang: any;
  toggleMailSelect: any;
  toggleMinimize: any;
  toggleMobileMenu: any;
  toggleSelection: any;
  toggleSharePreview: any;
  toggleTheme: any;
  toggleViewKandidat: any;
  tutupAdminAi: any;
  tutupDetailLoker: any;
  tutupFotoPreview: any;
  tutupModalGantiPass: any;
  tutupModalQr: any;
  tutupModalShare: any;
  tutupPamflet: any;
  tutupPreviewDokumen: any;
  updateArrayField: any;
  updateBiodataDariHasilAdmin: any;
  updateFormUI: any;
  updateMailBadge: any;
  updateStatusTugas: any;
  uploadDokumenBiodataAdmin: any;
  urlFotoJeklin: any;
}

// Vendor globals
declare const QRCode: {
  toCanvas: (
    canvas: HTMLCanvasElement,
    text: string,
    opts?: Record<string, unknown>,
  ) => Promise<void>;
  toDataURL: (text: string, opts?: Record<string, unknown>) => string;
};
declare const XLSX: {
  read: (
    data: ArrayBuffer,
    opts?: Record<string, unknown>,
  ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: (sheet: unknown, opts?: Record<string, unknown>) => Record<string, unknown>[];
    sheet_to_csv: (sheet: unknown, opts?: Record<string, unknown>) => string;
  };
};
declare const mammoth: {
  convertToHtml: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

// Netlify runtime
interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string>;
  path: string;
  queryStringParameters: Record<string, string> | null;
  body: string | null;
  isBase64Encoded: boolean;
}
interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// Utility types
type Nullable<T> = T | null;
type Optional<T> = T | undefined;
type ActionName = string;
type ActionPayload = unknown[];
// DOM helpers — querySelector returns Element, but codebase expects HTMLElement
declare function $el(selector: string, root?: Element | Document): HTMLElement | null;
declare function $els(selector: string, root?: Element | Document): HTMLElement[];

// ASSETS global (defined in state.ts)
declare const ASSETS: {
  LOGO?: string;
  SOCIAL?: Record<string, string>;
  [key: string]: unknown;
};

// Augment Element to include HTMLElement properties — codebase uses
// querySelector (returns Element) but accesses HTMLElement-specific props.
// This is the pragmatic JS→TS migration approach.
interface Element {
  value: string;
  checked: boolean;
  disabled: boolean;
  files: FileList | null;
  src: string;
  href: string;
  placeholder: string;
  title: string;
  dataset: DOMStringMap;
  innerHTML: string;
  textContent: string | null;
  style: CSSStyleDeclaration;
  classList: DOMTokenList;
  focus(): void;
  blur(): void;
  click(): void;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  querySelector<T extends Element = HTMLElement>(selectors: string): T | null;
  querySelectorAll<T extends Element = HTMLElement>(selectors: string): NodeListOf<T>;
  closest<T extends Element = HTMLElement>(selectors: string): T | null;
  parentElement: HTMLElement | null;
  children: HTMLCollectionOf<HTMLElement>;
  firstElementChild: HTMLElement | null;
  lastElementChild: HTMLElement | null;
  nextElementSibling: HTMLElement | null;
  previousElementSibling: HTMLElement | null;
  append(...nodes: (Node | string)[]): void;
  prepend(...nodes: (Node | string)[]): void;
  remove(): void;
  replaceWith(...nodes: (Node | string)[]): void;
  matches(selectors: string): boolean;
}

// Pragmatic helpers for JS→TS migration
// $() shorthand for querySelector with HTMLElement cast
declare function $(selector: string): HTMLElement | null;
declare function $$(selector: string): HTMLElement[];
// safeVal — extract .value from Element without type error
declare function safeVal(el: Element | null, fallback?: string): string;

// Common object types used across the codebase
interface JobRow {
  code: string;
  nama: string;
  pekerjaan: string;
  status: string;
  tahapan: string;
  kategori: string;
  gender: string;
  lokasi: string;
  kuota: string;
  pamflet: string;
  deskripsi: string;
  syarat: string;
  keterangan: string;
  rincianBiaya: string;
  totalBiaya: string;
  templateCv: string;
  dokumenShare: string;
  shareToken: string;
  [key: string]: unknown;
}
interface MasterRow {
  nama_lengkap: string;
  nama_panggilan: string;
  tempat_lahir: string;
  tgl_lahir: string;
  gender: string;
  usia: string;
  tb: string;
  bb: string;
  nik: string;
  email: string;
  alamat_lengkap: string;
  pekerjaan: string;
  pendidikan: string;
  jft: string;
  ssw_url: string;
  jft_url: string;
  file_cv: string;
  pas_photo: string;
  bidangssw: string;
  kenalan_jepang: string;
  keluarga: string;
  formatCv: string;
  id_kandidat: string;
  [key: string]: unknown;
}

// HTMLFormElement methods (used via querySelector)
interface Element {
  reset(): void;
  download: string;
  options: HTMLCollectionOf<HTMLOptionElement>;
  srcdoc: string;
  width: number;
  height: number;
}

// Firebase compat modules (loaded via CDN script tags)
declare module 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js' {
  const messaging: any;
  export default messaging;
}
declare module 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js' {
  const firebase: any;
  export default firebase;
}

declare function showToast(msg: string, type?: string): void;
