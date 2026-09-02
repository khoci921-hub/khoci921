#!/usr/bin/env node
// generate-api-docs.mjs — Generate OpenAPI 3.1 spec from action-registry.js.
//
// Usage: node scripts/generate-api-docs.mjs > docs/api.yaml
// Atau:  bun run generate-api-docs

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- Parse action-registry.js (CommonJS, read as text) ---
const registrySrc = readFileSync(join(ROOT, 'netlify/functions/_lib/action-registry.js'), 'utf8');

// Extract action names from ACTION_HANDLERS = { ... }
const handlerBlock = registrySrc.match(/const ACTION_HANDLERS = \{([\s\S]*?)\};/)?.[1];
if (!handlerBlock) {
  console.error('Could not parse ACTION_HANDLERS from action-registry.js');
  process.exit(1);
}

// Parse each action: "actionName: module.handler,"
const actionRegex = /^\s*(\w+)\s*:\s*\w+/gm;
const actions = [];
let m;
while ((m = actionRegex.exec(handlerBlock)) !== null) {
  actions.push(m[1]);
}

// Parse rate limit groups
function parseSet(name) {
  const block = registrySrc.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
  if (!block) return new Set();
  return new Set([...block[1].matchAll(/'(\w+)'/g)].map((x) => x[1]));
}

const loginActions = parseSet('LOGIN_ACTIONS');
const aiActions = parseSet('AI_ACTIONS');
const fonnteActions = parseSet('FONNTE_ACTIONS');

// Categorize actions based on handler module (from source)
function categorize(action) {
  const line = handlerBlock.match(new RegExp(`^\\s*${action}\\s*:`))?.[0] || '';
  if (line.includes('publicData')) return 'Data Publik';
  if (line.includes('diagnostics')) return 'Diagnostics';
  if (line.includes('auth.')) return 'Autentikasi';
  if (line.includes('jobActions')) return 'Lowongan';
  if (line.includes('candidateActions')) return 'Kandidat';
  if (line.includes('mailActions')) return 'Mail Inbox';
  if (line.includes('upload.')) return 'Upload & Berkas';
  if (line.includes('master.')) return 'Master Data & CV';
  if (line.includes('schedule')) return 'Jadwal & Tugas';
  if (line.includes('wa.')) return 'Template & Kirim WA';
  if (line.includes('config.')) return 'Konfigurasi';
  if (line.includes('register')) return 'Siswa Baru';
  if (line.includes('drive.')) return 'Drive & Migrasi';
  if (line.includes('aiChat')) return 'AI Chat';
  if (line.includes('aiClassify')) return 'AI Klasifikasi';
  if (line.includes('aiCv')) return 'AI CV & Naitei';
  return 'Lainnya';
}

function rateLimitGroup(action) {
  if (loginActions.has(action)) return 'LOGIN (rate limit ketat)';
  if (aiActions.has(action)) return 'AI (rate limit)';
  if (fonnteActions.has(action)) return 'FONNTE (rate limit)';
  return 'Publik (tanpa rate limit)';
}

// --- Build OpenAPI spec ---
const actionDescriptions = {
  getAppData: 'Data publik kandidat untuk admin (total, per-stage, per-job)',
  getAppConfig: 'Konfigurasi aplikasi (admin only)',
  reportWebVital: 'Laporkan Web Vitals metrics',
  checkAdminMaster: 'Login admin dengan master PIN',
  checkAdminPersonal: 'Login admin dengan PIN personal',
  refreshAdminSession: 'Refresh token sesi admin',
  refreshKandidatSession: 'Refresh token sesi kandidat',
  loginKandidat: 'Login kandidat dengan WA + password',
  daftarKandidat: 'Registrasi kandidat baru',
  gantiPasswordKandidat: 'Ganti password kandidat',
  registerFcmToken: 'Daftarkan FCM token untuk notifikasi',
  logout: 'Logout (clear session)',
  simpanJobBaru: 'Buat lowongan baru',
  editLokerFull: 'Edit lowongan lengkap',
  ubahStatusJob: 'Ubah status lowongan (OPEN/CLOSE)',
  hapusJobData: 'Hapus lowongan',
  updateTahapanDbJob: 'Update tahapan seleksi di lowongan',
  updateDokumenShare: 'Update dokumen share di lowongan',
  tandaiGagalJob: 'Tandai kandidat gagal di lowongan',
  updateCatatanKandidat: 'Update catatan admin untuk kandidat',
  updateKandidatSuper: 'Update data kandidat (super admin)',
  getCandidatesPage: 'Ambil data kandidat (paginated)',
  reviewForm: 'Review lamaran masuk',
  approveForm: 'Setujui lamaran',
  rejectForm: 'Tolak lamaran',
  deleteForm: 'Hapus lamaran',
  tandaiDibacaForm: 'Tandai lamaran sudah dibaca',
  getUploadUrls: 'Dapatkan URL upload Cloudinary',
  cekDataPelamar: 'Cek data pelamar untuk apply',
  isJobRequiresCv: 'Cek apakah lowongan butuh CV',
  submitApply: 'Submit lamaran dari apply-full.html',
  getExistingCandidateJsonByWa: 'Ambil data kandidat existing berdasarkan WA',
  getMasterDataByWa: 'Ambil master data kandidat berdasarkan WA',
  getDrafCvMaster: 'Generate draf CV dari master data',
  submitMasterForm: 'Submit/simpan master data (CV lengkap)',
  simpanBiodataLengkap: 'Alias submitMasterForm',
  simpanUpdateMaster: 'Update master data kandidat',
  simpanKandidatDanUpload: 'Simpan kandidat + upload berkas sekaligus',
  simpanBerkasTahapan: 'Upload berkas untuk tahap tertentu',
  simpanRevisiKandidat: 'Simpan revisi data kandidat',
  simpanJadwalBaru: 'Buat jadwal baru',
  hapusJadwal: 'Hapus jadwal',
  tambahTugasBaru: 'Tambah tugas ke jadwal',
  setTugasStatus: 'Update status tugas',
  hapusTugas: 'Hapus tugas',
  checkAndSendAgendaReminders: 'Cek & kirim pengingat agenda',
  simpanWaTemplate: 'Simpan template pesan WA',
  hapusWaTemplate: 'Hapus template pesan WA',
  kirimSatuPesanFonnte: 'Kirim satu pesan WA via Fonnte',
  kirimTawaranMassal: 'Kirim tawaran massal via Fonnte',
  updateSysConfig: 'Update konfigurasi sistem',
  getRincianPresets: 'Ambil preset rincian biaya',
  saveRincianPreset: 'Simpan preset rincian biaya',
  deleteRincianPreset: 'Hapus preset rincian biaya',
  getDaftarSiswaBaru: 'Ambil daftar siswa baru',
  submitDaftarSiswa: 'Submit pendaftaran siswa baru',
  getLinkSiswaBaru: 'Generate link pendaftaran siswa baru',
  generateFormBridge: 'Generate link form bridge (QR)',
  generateLegacyMasterBridge: 'Generate link master legacy',
  generateAiFormBridge: 'Generate link AI form bridge',
  getDriveLinkCandidates: 'Ambil link Drive untuk kandidat',
  uploadDriveReplacement: 'Upload pengganti file Drive',
  runMigration: 'Jalankan migrasi data',
  processAIChat: 'Proses chat AI untuk kandidat',
  processAdminAIChat: 'Proses chat AI untuk admin',
  processSiswaAIChat: 'Proses chat AI untuk siswa baru',
  processAiInterview: 'Proses simulasi wawancara AI',
  generateWawancaraModel: 'Generate model pertanyaan wawancara',
  simpanHasilWawancara: 'Simpan hasil wawancara',
  selesaikanWawancara: 'Tandai wawancara selesai',
  getHasilWawancara: 'Ambil hasil wawancara',
  parseDokumenBiodata: 'Parse dokumen biodata via AI',
  getAdminAiContext: 'Ambil konteks AI untuk admin',
  buildAdminAiCandidateSummary: 'Build summary kandidat via AI',
  submitDataAsj: 'Submit data ASJ (NAITEI)',
  simpanDataTtdNaitei: 'Simpan data tanda tangan NAITEI',
};

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'ASJ Portal API',
    description:
      'Backend API untuk ASJ Portal — platform rekrutmen PT Amanah Sakura Japan.\n\n' +
      'Semua action melewati **satu endpoint dispatcher** (`POST /`) dengan request body ' +
      '`{ action: string, payload: unknown[] }`. Response berisi hasil dari handler terkait.\n\n' +
      '## Rate Limiting\n\n' +
      '- **LOGIN_ACTIONS** (login, daftar, refresh session) — rate limit ketat\n' +
      '- **AI_ACTIONS** (AI chat, interview, klasifikasi) — rate limit sedang\n' +
      '- **FONNTE_ACTIONS** (kirim WA) — rate limit sedang\n' +
      '- **Publik** (getAppData, dll) — tanpa rate limit\n\n' +
      '## Autentikasi\n\n' +
      'Admin: header `Authorization: Bearer <session_token>` (HMAC-SHA256 signed).\n' +
      'Kandidat: token sesi dari `loginKandidat` / `daftarKandidat`.',
    version: '2026.08.19',
    contact: { name: 'PT Amanah Sakura Japan' },
    license: { name: 'Proprietary' },
  },
  servers: [{ url: '/', description: 'Netlify Functions (same origin)' }],
  paths: {
    '/': {
      post: {
        operationId: 'dispatchAction',
        summary: 'Dispatcher utama — panggil semua action backend',
        description:
          'Semua action backend dipanggil melalui endpoint ini. ' +
          'Isi `action` dengan nama action dan `payload` dengan array argument.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ActionRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Success — response bergantung pada action',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ActionResponse' },
              },
            },
          },
          400: { description: 'Action tidak dikenal atau payload invalid' },
          429: { description: 'Rate limit exceeded' },
          500: { description: 'Internal server error' },
        },
        tags: ['Dispatcher'],
      },
    },
  },
  components: {
    schemas: {
      ActionRequest: {
        type: 'object',
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: actions,
            description: 'Nama action yang akan dipanggil',
          },
          payload: {
            type: 'array',
            items: {},
            description: 'Argument yang diteruskan ke handler',
            default: [],
          },
        },
      },
      ActionResponse: {
        oneOf: [
          { type: 'object', properties: { success: { type: 'boolean' } } },
          { type: 'array', items: { type: 'object' } },
          { type: 'object' },
        ],
        description: 'Response bergantung pada action yang dipanggil',
      },
    },
  },
  tags: [{ name: 'Dispatcher', description: 'Endpoint utama untuk semua action' }],
};

// Add per-action documentation as custom x-action metadata
for (const action of actions) {
  const cat = categorize(action);
  const group = rateLimitGroup(action);
  const desc = actionDescriptions[action] || action;

  // Find or create tag
  if (!spec.tags.find((t) => t.name === cat)) {
    spec.tags.push({ name: cat, description: `Action dalam kategori: ${cat}` });
  }
}

// --- Write output ---
const outDir = join(ROOT, 'docs');
mkdirSync(outDir, { recursive: true });

const yaml = JSON.stringify(spec, null, 2);
const outPath = join(outDir, 'api.json');
writeFileSync(outPath, yaml + '\n');

console.log(`✅ OpenAPI spec generated: docs/api.json`);
console.log(`   ${actions.length} actions, ${spec.tags.length} categories`);
console.log(
  `   Rate limits: LOGIN=${loginActions.size}, AI=${aiActions.size}, FONNTE=${fonnteActions.size}`,
);
