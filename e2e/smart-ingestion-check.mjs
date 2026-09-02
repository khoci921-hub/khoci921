// =============================================================
// E2E SMART INGESTION CHECK — ASJ Portal
// -------------------------------------------------------------
// Menguji Smart Ingestion end-to-end:
//   1. Setup: buat kandidat + master tes di Supabase
//   2. Login admin → upload PDF via simpanBerkasTahapan (HTTP)
//   3. Tunggu Smart Ingestion process (fire-and-forget → Gemini)
//   4. Verifikasi: master_database_candidate.ai_data_json ter-update
//   5. Cleanup
//
// Jalankan: BASE_URL=<url> node e2e/smart-ingestion-check.mjs
// =============================================================
import { check, waitFor as harnessWaitFor, launchBrowser, finish, BASE } from './harness.mjs';
const { supabaseKey, supabaseUrl } = await import('../netlify/functions/_lib/db/client.ts');

const waitFor = (c, t, i) => harnessWaitFor(c, t ?? 60000, i);
const TEST_WA =
  process.env.E2E_UPLOAD_WA || '62813' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const TEST_PIN = process.env.E2E_UPLOAD_PIN || '9911';
const TEST_NAMA = 'E2E INGEST TEST';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'asj-files';

// ---- Supabase direct --------------------------------------------------------
const SB = supabaseUrl().replace(/\/$/, '');
const KEY = supabaseKey();
if (!SB || !KEY) {
  console.error('Supabase belum dikonfigurasi.');
  process.exit(1);
}
const sbH = {
  apikey: KEY,
  Authorization: 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function sbGet(table, query = '') {
  const r = await fetch(`${SB}/rest/v1/${table}?${query}`, { headers: sbH });
  if (!r.ok) return [];
  const t = await r.text();
  try {
    return JSON.parse(t) || [];
  } catch {
    return [];
  }
}
async function sbPost(table, body) {
  const r = await fetch(`${SB}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbH,
    body: JSON.stringify(body),
  });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
async function sbDel(table, filter) {
  await fetch(`${SB}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  }).catch(() => {});
}

// Minimal valid PDF with text content
const PDF_B64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDcyIDcyMCBUZCAoRTJFIFRFU1QgUERGKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMzNCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQwNAolJUVPRgo=';

const browser = await launchBrowser();
console.log(`\nTarget: ${BASE} | Kandidat tes: ${TEST_WA}\n`);

try {
  // =============================================================
  // TEST 1 — Setup
  // =============================================================
  let candId = null,
    masterId = null;
  {
    console.log('TEST 1: Setup kandidat + master tes');
    const ins = await sbPost('database_candidate', [
      {
        id_kandidat: 'E2E' + Math.floor(Date.now() / 1000),
        nama_lengkap: TEST_NAMA,
        no_wa: TEST_WA,
        password_kandidat: TEST_PIN,
        gender: 'LAKI-LAKI',
        tahapan_seleksi: 'PEMBERKASAN',
        created_at: new Date().toISOString(),
      },
    ]);
    candId = Array.isArray(ins) && ins[0] ? ins[0].id : null;
    check('Kandidat tes dibuat', !!candId);

    const mins = await sbPost('master_database_candidate', [
      {
        id_kandidat: 'E2E' + Math.floor(Date.now() / 1000),
        nama_lengkap: TEST_NAMA,
        no_wa: TEST_WA,
        gender: 'LAKI-LAKI',
        created_at: new Date().toISOString(),
      },
    ]);
    masterId = Array.isArray(mins) && mins[0] ? mins[0].id : null;
    check('Master tes dibuat', !!masterId);

    const rows = await sbGet('master_database_candidate', `id=eq.${masterId}&select=ai_data_json`);
    const aiBefore = rows[0]?.ai_data_json;
    console.log(`   ai_data_json sebelum: ${aiBefore || '(kosong)'}`);
    check('ai_data_json kosong sebelum upload', !aiBefore);
  }

  // =============================================================
  // TEST 2 — Login admin + upload via HTTP
  // =============================================================
  let sessionToken = null;
  {
    console.log('\nTEST 2: Login admin + upload PDF');

    // Login
    const loginRes = await fetch(`${BASE}/.netlify/functions/app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkAdminPersonal', payload: ['KHOCI', '4444'] }),
    });
    const login = await loginRes.json();
    sessionToken = login.sessionToken;
    check('Admin login sukses', !!sessionToken);

    // Upload via simpanBerkasTahapan
    const uploadRes = await fetch(`${BASE}/.netlify/functions/app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'simpanBerkasTahapan',
        payload: [
          {
            wa: TEST_WA,
            nama: TEST_NAMA,
            jenisBerkas: 'CV',
            file: { name: 'cv.pdf', data: 'data:application/pdf;base64,' + PDF_B64 },
          },
        ],
        sessionToken,
      }),
    });
    const upload = await uploadRes.json();
    console.log(`   Upload result: ${JSON.stringify(upload).slice(0, 200)}`);
    check('simpanBerkasTahapan sukses', upload.success);

    // Wait for Smart Ingestion (fire-and-forget, max 30s)
    console.log('   Waiting 15s for Smart Ingestion...');
    await new Promise((r) => setTimeout(r, 15000));
  }

  // =============================================================
  // TEST 3 — Verifikasi
  // =============================================================
  {
    console.log('\nTEST 3: Verifikasi Smart Ingestion');
    if (masterId) {
      const rows = await sbGet(
        'master_database_candidate',
        `id=eq.${masterId}&select=ai_data_json,nama_lengkap,no_wa`,
      );
      const m = rows[0];
      if (m) {
        console.log(`   Master: ${m.nama_lengkap} (${m.no_wa})`);
        const ai = m.ai_data_json;
        if (ai && ai !== 'null' && ai !== '') {
          console.log(`   ai_data_json: ${String(ai).slice(0, 300)}`);
          check('ai_data_json terisi', true);
          try {
            const parsed = typeof ai === 'string' ? JSON.parse(ai) : ai;
            check('JSON valid', !!parsed);
            if (parsed.source)
              check('source = smart_ingestion', parsed.source === 'smart_ingestion');
            if (parsed.nama_lengkap) check('nama_lengkap extracted', true, parsed.nama_lengkap);
          } catch {
            check('JSON valid', false, 'parse error');
          }
        } else {
          console.log(
            '   ⚠️ ai_data_json kosong — Smart Ingestion belum selesai atau Gemini API belum siap',
          );
          console.log('   (Normal jika pertama kali / Gemini quota habis)');
          check('ai_data_json (opsional)', false, 'pending — Gemini API dependent');
        }
      } else {
        check('Master ditemukan', false);
      }
    }
  }

  // =============================================================
  // CLEANUP
  // =============================================================
  {
    console.log('\nCLEANUP...');
    if (candId) await sbDel('database_candidate', `id=eq.${candId}`);
    if (masterId) await sbDel('master_database_candidate', `id=eq.${masterId}`);
    await sbDel('database_asj_form', `no_wa=eq.${TEST_WA}`);
    await sbDel('pemberkasan_checklist', `wa=eq.${TEST_WA}`);
    console.log('  ✅ DB bersih');
  }
} catch (e) {
  console.error('FATAL:', e.message);
} finally {
  await browser.close();
  finish();
}
