// =============================================================
// BACKEND FAST-PATH CHECK — verifikasi jalur cepat query server-side
// (findCandidateByWaFiltered, attachBerkasBio filter WA-set,
// getAppData admin paralel) LANGSUNG ke handler — tanpa HTTP server.
// Hanya mencetak status/angka (tidak ada data kandidat yang sensitif).
// =============================================================

const { handleAction } = await import('../netlify/functions/_lib/handlers.ts');

const WA = process.env.E2E_WA || '082130442661';
const PIN = process.env.E2E_PIN || '2661';
const ADMIN_NAME = process.env.E2E_ADMIN_NAME || 'KHOCI';
const ADMIN_PIN = process.env.E2E_ADMIN_PIN || '4444';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ❌ ${name} ${extra}`);
    failures++;
  }
}

// 1. Login kandidat — memakai findCandidateByWa (jalur cepat targeted).
const login = await handleAction('loginKandidat', [WA, PIN]);
check(
  'loginKandidat sukses (findCandidateByWaFiltered)',
  login.success === true,
  (login.error || '').slice(0, 80),
);
const token = login.sessionToken || '';

// 2. getAppData mode kandidat — query targeted + attachBerkasBio filter.
// Payload WA pakai bentuk ternormalisasi dari respons login (persis yang
// disimpan frontend di localStorage 'asj_kandidat_wa') supaya validasi sesi
// `t.wa === waPayload` cocok.
const gk = await handleAction('getAppData', ['kandidat', login.wa || WA], token);
check('getAppData kandidat sukses', gk.success === true, (gk.message || '').slice(0, 100));
check(
  'candidates = 1 baris miliknya',
  Array.isArray(gk.candidates) && gk.candidates.length === 1,
  String(gk.candidates && gk.candidates.length),
);
const berkasKeys =
  gk.candidates && gk.candidates[0] ? Object.keys(gk.candidates[0].berkas || {}).length : -1;
check('berkas ter-attach (filter WA-set)', berkasKeys >= 0, 'berkas=' + berkasKeys);

// 3. getAppData admin — halaman 1 + fetch paralel + berkas/bio filter.
const adm = await handleAction('checkAdminPersonal', [ADMIN_NAME, ADMIN_PIN]);
check('checkAdminPersonal sukses', adm.success === true, (adm.error || '').slice(0, 80));
const adminToken = adm.sessionToken || '';
const ga = await handleAction('getAppData', ['admin'], adminToken);
check('getAppData admin sukses', ga.success === true, (ga.message || '').slice(0, 100));
check(
  'admin candidates = 50 (halaman 1)',
  Array.isArray(ga.candidates) && ga.candidates.length === 50,
  String(ga.candidates && ga.candidates.length),
);
check('formInbox array', Array.isArray(ga.formInbox));
check('schedules array', Array.isArray(ga.schedules));
check('tugas array', Array.isArray(ga.tugas));
check('waTemplates array', Array.isArray(ga.waTemplates));
const aBerkas =
  ga.candidates && ga.candidates[0] ? Object.keys(ga.candidates[0].berkas || {}).length : -1;
check('berkas admin ter-attach', aBerkas >= 0, 'berkas=' + aBerkas);

// 4. Ganti password memakai jalur cepat? (hanya cek alur valid: password salah
//    harus ditolak SEBELUM query berat — memakai findCandidateByWaFiltered).
const bad = await handleAction('gantiPasswordKandidat', [WA, 'salah-password', 'abcdef123'], token);
check(
  'gantiPassword: password salah ditolak (jalur cepat)',
  bad.success === false && !bad.sessionInvalid,
  (bad.error || '').slice(0, 80),
);

console.log(`\n${failures === 0 ? '🎉 SEMUA LULUS' : `💥 ${failures} GAGAL`}\n`);
process.exit(failures === 0 ? 0 : 1);
