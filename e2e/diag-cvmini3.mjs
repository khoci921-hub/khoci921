// Diag: apakah field CV Mini (jft_text, ssw_text, pendidikan, photo) tersimpan?

const { handleAction } = await import('../netlify/functions/_lib/handlers.ts');

const WA = '082130442661';
const PIN = '2661';
const login = await handleAction('loginKandidat', [WA, PIN]);
const waNorm = String(login.wa || WA).replace(/\D/g, '');
const tok = login.sessionToken;

// Baca nilai SEBELUM
const before = await handleAction('getDrafCvMaster', [waNorm], tok);
const b = before && before.data ? before.data : before;
const getPath = (o, ...ks) => {
  for (const k of ks) {
    if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  }
  return '-';
};
console.log(
  'SEBELUM  jft:',
  getPath(b, 'jft', 'nilai'),
  '| bidangssw:',
  getPath(b, 'bidangssw', 'ssw'),
  '| pend1:',
  getPath(b, 'pendidikan_1_tingkat'),
  '| foto:',
  getPath(b, 'pas_photo'),
);

// Simpan via payload PERSIS CV Mini (prosesSimpanCvMini)
const res = await handleAction(
  'simpanUpdateMaster',
  [
    {
      wa: waNorm,
      nama: 'AGUS KHOCI',
      gender: 'LAKI-LAKI',
      usia: '24',
      tb: '165',
      bb: '57',
      pendidikan: 'SMK PARIWISATA', // string (CV Mini kirim string!)
      jft_text: 'JFT-BASIC', // key jft_text
      ssw_text: 'KAIGO-3NEN', // key ssw_text
      photo: null,
    },
  ],
  tok,
);
console.log('simpan:', res.success);

const after = await handleAction('getDrafCvMaster', [waNorm], tok);
const a = after && after.data ? after.data : after;
console.log(
  'SESUDAH  jft:',
  getPath(a, 'jft', 'nilai'),
  '| bidangssw:',
  getPath(a, 'bidangssw', 'ssw'),
  '| pend1:',
  getPath(a, 'pendidikan_1_tingkat'),
);
console.log('=> JFT tersimpan :', getPath(a, 'jft', 'nilai') !== '-');
console.log('=> SSW tersimpan :', getPath(a, 'bidangssw', 'ssw') !== '-');
console.log('=> pendidikan tersimpan:', getPath(a, 'pendidikan_1_tingkat') !== '-');

// Restore nilai asli (jangan rusak data user)
await handleAction(
  'simpanUpdateMaster',
  [
    {
      wa: waNorm,
      nama: 'AGUS KHOCI',
      gender: 'LAKI-LAKI',
      usia: '24',
      tb: '165',
      bb: '57',
      pendidikan: String(
        getPath(b, 'pendidikan_1_tingkat') !== '-' ? getPath(b, 'pendidikan_1_tingkat') : 'SMAN 1',
      ),
      jft_text: getPath(b, 'jft', 'nilai') !== '-' ? String(getPath(b, 'jft', 'nilai')) : '',
      ssw_text:
        getPath(b, 'bidangssw', 'ssw') !== '-' ? String(getPath(b, 'bidangssw', 'ssw')) : '',
    },
  ],
  tok,
);
console.log('restore OK');
process.exit(0);
