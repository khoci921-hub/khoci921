// Diag: simpan CV Mini — login kandidat sungguhan lalu simpanUpdateMaster
// dengan payload PERSIS yang dikirim frontend (prosesSimpanCvMini).

const { handleAction } = await import('../netlify/functions/_lib/handlers.ts');

const WA = process.env.E2E_WA || '082130442661'; // AGUS KHOCI
const PIN = process.env.E2E_PIN || '2661';

// 1) Login kandidat
const login = await handleAction('loginKandidat', [WA, PIN]);
console.log(
  'login:',
  login.success,
  login.error || '',
  login.sessionToken ? 'token OK' : 'NO TOKEN',
);
if (!login.sessionToken) process.exit(1);
const waNorm = String(login.wa || WA).replace(/\D/g, '');

// 2) Payload persis dari prosesSimpanCvMini (js/03_candidate.js)
const payload = {
  wa: waNorm,
  nama: 'AGUS KHOCI',
  gender: 'LAKI-LAKI',
  usia: '24',
  tb: '165',
  bb: '57',
  pendidikan: 'SMAN 1', // string, bukan array (CV Mini kirim string)
  jft_text: 'JFT A',
  ssw_text: 'KAIGO',
  photo: null, // tanpa file dipilih
};

const t0 = Date.now();
const res = await handleAction('simpanUpdateMaster', [payload], login.sessionToken);
console.log('simpanUpdateMaster:', JSON.stringify(res), Date.now() - t0 + 'ms');

// 3) Baca balik untuk verifikasi field tersimpan
const back = await handleAction('getMasterDataByWa', [waNorm], login.sessionToken);
if (back && back.data) {
  const d = back.data;
  const flat = typeof d.flat === 'function' ? d.flat : {};
  console.log('  nama:', d.nama_lengkap || flat.nama_lengkap);
  console.log('  tb:', d.tb || flat.tb, '| bb:', d.bb || flat.bb);
  console.log('  gender:', d.gender || flat.gender);
  console.log('  pendidikan_1_tingkat:', d.pendidikan_1_tingkat || flat.pendidikan_1_tingkat);
  console.log('  jft (nilai):', d.jft || flat.jft, '| bidangssw:', d.bidangssw || flat.bidangssw);
} else {
  console.log('  getMasterDataByWa:', JSON.stringify(back).slice(0, 200));
}
process.exit(0);
