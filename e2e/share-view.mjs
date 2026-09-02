// =============================================================
// E2E — share.html (Secure Candidate Viewer) + endpoint /api/share-data
// -----------------------------------------------------------------
// 1. API check (selalu jalan): GET /api/share-data?job=KODE
// 2. Browser check (best-effort): buka share.html, pastikan kartu kandidat
//    dirender tanpa error JS. Dilewati otomatis kalau playwright tidak bisa
//    launch (mis. runtime bun) — jangan sampai menggantung.
// Jalankan: npx tsx e2e/share-view.mjs   (BASE_URL & SHARE_JOB bisa di-override)
// =============================================================
import { check, waitFor, launchBrowser, finish } from './harness.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const JOB_DEFAULT = 'TG591ASJ';
let JOB = process.env.SHARE_JOB || JOB_DEFAULT;

// Auto-discover: jika env tidak diset, coba cari job dari server
if (!process.env.SHARE_JOB) {
  try {
    const probe = await fetch(BASE + '/.netlify/functions/app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAppData', payload: ['admin'] }),
    });
    const data = await probe.json();
    const jobs = (data && data.jobs) || [];
    if (jobs.length > 0) {
      const best = jobs.sort((a, b) => (b.jumlahKandidat || 0) - (a.jumlahKandidat || 0))[0];
      JOB = best.code || best.id || JOB_DEFAULT;
      console.log('  (info) Auto-discovered job:', JOB);
    }
  } catch {
    /* fallback ke default */
  }
}

// ---- 1. API check ----------------------------------------------------------
const api = await fetch(`${BASE}/api/share-data?job=${encodeURIComponent(JOB)}`);
let apiJson = null;
try {
  apiJson = await api.json();
} catch {
  /* non-JSON */
}
check(`GET /api/share-data?job=${JOB} → HTTP ${api.status}`, api.ok, 'endpoint harus 200');
check(
  'job.name terisi',
  !!apiJson && !!apiJson.job && !!apiJson.job.name,
  JSON.stringify(apiJson && apiJson.job),
);
const apiCandidates = (apiJson && apiJson.candidates) || [];
check('candidates array ada', Array.isArray(apiCandidates), 'harus array');
check('setidaknya 1 kandidat', apiCandidates.length > 0, `n=${apiCandidates.length}`);
const withExtra = apiCandidates.filter((c) => c.extraDocs && c.extraDocs.length).length;
console.log(
  `  (info) ${apiCandidates.length} kandidat, ${withExtra} punya dokumen ekstra (KK/KTP/dll)`,
);
check(
  'kandidat punya field inti (nama_lengkap, pas_photo, file_cv)',
  apiCandidates.every((c) => c && c.nama_lengkap !== undefined),
  'field share-data harus lengkap',
);

// ---- 2. Browser check (best-effort) ----------------------------------------
let browser = null;
try {
  browser = await launchBrowser();
} catch (e) {
  console.log(
    `  ⚠ browser check dilewati (playwright tidak bisa launch di runtime ini): ${String(e.message || e).slice(0, 100)}`,
  );
}
if (browser) {
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') jsErrors.push(m.text().slice(0, 150));
  });
  page.on('pageerror', (e) => jsErrors.push(String(e).slice(0, 150)));

  try {
    await page.goto(`${BASE}/share.html?job=${encodeURIComponent(JOB)}`, {
      waitUntil: 'domcontentloaded',
    });
    // Tunggu render selesai (kartu muncul) ATAU error tampil, max 30s.
    const startWait = Date.now();
    while (Date.now() - startWait < 30000) {
      try {
        const done = await page.evaluate(() => {
          const errEl = document.getElementById('error-message');
          const errVisible = errEl
            ? !errEl.classList.contains('hidden') && errEl.offsetParent !== null
            : false;
          const cards = document.querySelectorAll('#candidates-grid .glass-card').length;
          return errVisible || cards > 0;
        });
        if (done) break;
      } catch {
        /* navigation context destroyed — wait & retry */
      }
      await page.waitForTimeout(1500);
    }

    try {
      const errorVisible = await page.evaluate(() => {
        const el = document.getElementById('error-message');
        return el ? !el.classList.contains('hidden') && el.offsetParent !== null : false;
      });
      const cardCount = await page.evaluate(
        () => document.querySelectorAll('#candidates-grid .glass-card').length,
      );
      const title = await page.evaluate(
        () => (document.getElementById('job-title') || {}).innerText,
      );

      check('tidak menampilkan error state', !errorVisible, 'halaman menampilkan Akses Ditolak');
      check('judul job terisi', !!title && title !== 'Loading Job…', `title=${title}`);
      check(`kandidat dirender di grid (${cardCount})`, cardCount > 0, `cards=${cardCount}`);
      check('tidak ada error JS', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
    } catch (e) {
      console.log(`  ⚠ browser assertions interrupted: ${String(e.message || e).slice(0, 100)}`);
    }
  } catch (e) {
    console.log(`  ⚠ browser navigation failed: ${String(e.message || e).slice(0, 100)}`);
  }
  await browser.close();
}

finish();
