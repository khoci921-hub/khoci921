import { findJobs, mapJob } from './db/jobs';
import { findForms, findFormsByWa, findFormsLight, mapForm } from './db/forms';
import { attachBerkasBio } from './db/berkas';
import { findAssets, findSettings } from './db/misc';
import * as session from './session';
import { requireAdmin } from './actions-auth';
import * as demo from './demo';
import { cacheGet, cacheSet } from './cache';
// actions-public.js — data publik & dashboard utama (getAppData).
//
// (dispatcher pusat) supaya tiap domain punya file sendiri dan mudah di-patch.
//
// PLUS optimasi performa 2026-08-16 (terukur: 3 query berurutan 1.489 ms →
// paralel 297 ms):
//   - Query publik (jobs/assets/settings) dijalankan PARALEL (dulu berurutan,
//     ~1 detik hangus karena latensi per-request ke Supabase ~300-500 ms).
//   - Data publik di-cache TTL 20 dtk di memori (cache.js) — getAppData
//     publik berikutnya terlayani tanpa roundtrip DB (versi "Redis" tanpa
//     Redis, cukup untuk skala ASJ).

import {
  columnsFromSchema,
  findTable,
  getSchema,
  hasBackend,
  normalizeWa,
  pick,
  supabaseJson,
  tablesFromSchema,
  toText,
} from './db/client';
import {
  attachApplications,
  findAllCandidatesLight,
  findCandidateByWaFiltered,
  findCandidates,
  findCandidatesByIds,
  mapCandidate,
} from './db/candidates';

// sys_config.config_type -> key dropdown yang dikirim ke frontend
// (kunci ekstra statusLoker/lokasiZoom/dst. ikut dikirim persis seperti
// backend asli, walau UI utama hanya memakai 6 key pertama).
const DROPDOWN_MAP = {
  list_kategori: 'kategori',
  list_gender: 'gender',
  list_tahapan: 'tahapan',
  tsk: 'tsk',
  list_lokasi: 'lokasi',
  list_syarat: 'syarat',
  lokasi__link_zoom: 'lokasiZoom',
  list_status_loker: 'statusLoker',
  status_form: 'statusForm',
  list_status_lamaran: 'statusLamaran',
  broadcast: 'broadcast',
};

function parseConfigList(v) {
  if (Array.isArray(v)) return v;
  const s = String(v || '').trim();
  // Nilai bisa berupa JSON array string ("[\"a\",\"b\"]").
  if (s.startsWith('[') || s.startsWith('{')) {
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) return p;
    } catch {
      /* bukan JSON valid — lanjut split biasa */
    }
  }
  return s
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function stripRaw(list) {
  return (list || []).map(({ _raw, ...rest }) => rest);
}

// Jadwal & tugas & template WA untuk dashboard admin (database_schedule,
// database_tugas, wa_templates — bentuk yang dipakai frontend).
//
// FIX #31/#35 (audit 2026-09-02): Data ini jarang berubah (admin membuat
// jadwal/tugas beberapa kali sehari) — TTL 60 dtk (4× lebih panjang dari
// public-base 20 dtk). Cache terpisah supaya cacheClear() saat mutasi
// kandidat/mail tidak menghapus jadwal/tugas yang masih fresh.
const SCHED_CACHE_TTL_MS = 60_000;

async function loadSchedules() {
  const cached = cacheGet('schedules');
  if (cached) return cached;
  try {
    const rows = await supabaseJson('GET', 'database_schedule', {
      query: { select: '*', limit: 500, order: 'created_at.desc' },
    });
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      idJadwal: toText(r.id_jadwal || r.id || ''),
      namaAgenda: toText(r.nama_agenda || ''),
      idLoker: toText(r.id_loker_terkait || '-'),
      waktu: toText(r.tanggal_waktu || ''),
      link: toText(r.lokasi_link || '-'),
      kandidat: toText(r.daftar_kandidat || '-'),
      tsk: toText(r.tsk || ''),
      status: toText(r.status_jadwal || 'AKTIF'),
    }));
    cacheSet('schedules', data, SCHED_CACHE_TTL_MS);
    return data;
  } catch {
    return [];
  }
}

async function loadTugas() {
  const cached = cacheGet('tugas');
  if (cached) return cached;
  try {
    const rows = await supabaseJson('GET', 'database_tugas', {
      query: { select: '*', limit: 500, order: 'created_at.desc' },
    });
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: toText(r.id_tugas || r.id || ''),
      task: toText(r.nama_tugas || ''),
      status: toText(r.status || 'BARU'),
      dibuatOleh: toText(r.dibuat_oleh || ''),
      waktuDibuat: toText(r.waktu_dibuat || ''),
    }));
    cacheSet('tugas', data, SCHED_CACHE_TTL_MS);
    return data;
  } catch {
    return [];
  }
}

async function loadWaTemplates() {
  const cached = cacheGet('wa-templates');
  if (cached) return cached;
  try {
    const rows = await supabaseJson('GET', 'wa_templates', {
      query: { select: '*', limit: 500 },
    });
    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: toText(r.id || ''),
      nama: toText(r.nama || ''),
      isi: toText(r.isi || ''),
    }));
    cacheSet('wa-templates', data, SCHED_CACHE_TTL_MS);
    return data;
  } catch {
    return [];
  }
}

// Satu kandidat = satu baris di panel admin. (OK) Baris `database_candidate` dengan
// WA yang sama dianggap duplikat (warisan data lama / baris ganda); simpan yang
// paling baru (updated_at/created_at). Baris tanpa WA tetap dipertahankan.
function dedupeKandidatRaw(rows) {
  if (!Array.isArray(rows)) return rows;
  const seen = new Map();
  const out = [];
  const tsOf = (r) => String(pick(r, ['updated_at', 'created_at', 'tanggal_daftar']) || '');
  for (const r of rows) {
    const wa = normalizeWa(
      String(pick(r, ['no_wa', 'wa', 'whatsapp', 'telepon', 'phone', 'no_hp', 'telp']) || ''),
    );
    if (!wa) {
      out.push(r);
      continue;
    }
    const ts = tsOf(r);
    const prev = seen.get(wa);
    // Seri: timestamp sama (mis. insert dalam satu request) → prefer baris
    // dengan id lebih besar (insert terakhir).
    if (!prev || ts > prev.ts || (ts === prev.ts && Number(r.id || 0) > Number(prev.row.id || 0))) {
      seen.set(wa, { ts, row: r });
    }
  }
  for (const v of seen.values()) out.push(v.row);
  return out;
}

// Saring daftar kandidat unik dengan kata kunci (nama / WA) — dipakai jalur
// cepat & fallback supaya perilaku sama persis.
function saringKandidatUnik(uniq, q) {
  const needle = String(q || '')
    .trim()
    .toLowerCase();
  if (!needle) return uniq;
  const digit = needle.replace(/\D/g, '');
  return uniq.filter((r) => {
    const nama = String(pick(r, ['nama_lengkap', 'nama', 'name']) || '').toLowerCase();
    const wa = normalizeWa(
      String(pick(r, ['no_wa', 'wa', 'whatsapp', 'telepon', 'phone', 'no_hp', 'telp']) || ''),
    );
    return nama.includes(needle) || (digit && wa.includes(digit));
  });
}

// Daftar kandidat UNIK (satu baris per WA) urut paling baru di atas + total.
// Dipakai getAppData & getCandidatesPage supaya "satu kandidat = satu baris"
// konsisten DAN ukuran halaman & total selalu dihitung dari baris UNIK.
//
// Jalur cepat: baris RINGAN (proyeksi kolom dedupe/filter/sort) paginasi penuh
// TANPA batas 300 baris → dedupe+filter+sort di JS → baris PENUH hanya untuk
// halaman yang diminta (findCandidatesByIds). Semantik urutan TIDAK berubah.
// Fallback: scan penuh lama (skema kolom/tabel tidak dikenal).
// TTL cache hasil dedupe kandidat (Fase 3 langkah 17) — getAppData admin
// dipanggil tiap buka halaman / ganti tab / auto-refresh 120 dtk; tanpa cache,
// SETIAP panggilan full-scan seluruh tabel kandidat (findAllCandidatesLight
// paginasi penuh tanpa limit). TTL pendek + invalidasi saat mutasi
// (cacheClear di handler review/approve/reject/delete/kandidat/master/upload/
// register) menjaga data tetap segar. Cache per (q, page, pageSize).
const CAND_CACHE_TTL_MS = 25_000;

async function loadCandidatesUnik(q, opts = {}) {
  // FIX #8/#29 (audit 2026-09-02): Clamp page & pageSize supaya cache key
  // tetap bounded dan findCandidatesByIds tidak melewati batas PostgREST.
  // Tanpa clamp, attacker bisa mengirim pageSize=999999 → id=in.(…)
  // melebihi batas URL → 414 → fallback full-table-scan tanpa cache.
  // @ts-expect-error JS→TS migration
  const page = Math.max(1, Math.min(Math.floor(Number(opts.page)) || 1, 10_000));
  // @ts-expect-error JS→TS migration
  const pageSize = Math.max(1, Math.min(Math.floor(Number(opts.pageSize)) || 50, 100));
  const cacheKey = 'cand:' + String(q || '') + '|p' + page + '|s' + pageSize;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const start = (page - 1) * pageSize;
  const tsOf = (r) => String(pick(r, ['updated_at', 'created_at', 'tanggal_daftar']) || '');
  const urutkan = (uniq) =>
    uniq.sort((a, b) => (tsOf(b) > tsOf(a) ? 1 : tsOf(b) < tsOf(a) ? -1 : 0));

  const light = await findAllCandidatesLight();
  if (light !== undefined) {
    let uniq = dedupeKandidatRaw(light);
    uniq = saringKandidatUnik(uniq, q);
    urutkan(uniq);
    const total = uniq.length;
    const slice = uniq.slice(start, start + pageSize);
    const full = await findCandidatesByIds(slice.map((r) => r.id));
    if (full !== undefined) {
      const byId = new Map(full.map((r) => [String(r.id), r]));
      // Semua id halaman harus ter-resolve ke baris penuh; kalau ada yang
      // tidak (data legacy tanpa id) → fallback scan penuh biar aman.
      if (slice.every((r) => byId.has(String(r.id)))) {
        const result: Record<string, any> = {
          rows: slice.map((r) => byId.get(String(r.id))),
          total,
        };
        cacheSet(cacheKey, result, CAND_CACHE_TTL_MS);
        return result;
      }
    }
  }

  // Fallback lama: scan penuh (perilaku persis sebelum optimasi).
  const found = await findCandidates();
  const rows = Array.isArray(found.rows) ? found.rows : [];
  let uniq = dedupeKandidatRaw(rows);
  uniq = saringKandidatUnik(uniq, q);
  urutkan(uniq);
  return { rows: uniq.slice(start, start + pageSize), total: uniq.length };
}

const PUBLIC_CACHE_TTL_MS = 20_000;

// Bagian data PUBLIK dari getAppData (jobs/dropdowns/assets/pengumuman) —
// identik untuk semua mode (public/admin/kandidat) → aman di-cache TTL.
async function loadPublicBase(mode) {
  const cached = cacheGet('public-base');
  if (cached) return cached;

  const base = demo.demoGetAppData(mode || 'public'); // reuse assets default
  // PARALEL: 3 query independen (dulu berurutan ~1 detik).
  const [found, assets, settings] = await Promise.all([findJobs(), findAssets(), findSettings()]);

  // Fallback skema: hanya bila findJobs tidak menemukan tabel (query tambahan
  // dependen — tidak bisa ikut paralel).
  let foundTable = found;
  if (!foundTable.table) {
    // Skema asli beda nama tabel — cari lewat skema OpenAPI berdasarkan kolom.
    const spec = await getSchema();
    const names = tablesFromSchema(spec);
    for (const name of names) {
      const cols = columnsFromSchema(spec, name);
      if (
        cols.some((c) => /pekerjaan|judul|nama_loker|lowongan|title/.test(c)) &&
        cols.some((c) => /status|kode|code/.test(c))
      ) {
        const hit = await findTable([name]);
        if (hit.table) {
          foundTable = hit;
          break;
        }
      }
    }
  }
  if (!foundTable.table) {
    base.pengumuman =
      '⚠ Backend Supabase terhubung, tapi tabel lowongan belum terdeteksi otomatis. Mapping skema perlu disesuaikan.';
    return { notFound: true, base };
  }

  const jobs = foundTable.rows.map(mapJob).filter((j) => j.pekerjaan && j.pekerjaan !== '');

  // dropdowns + pengumuman dari sys_config (list_*, broadcast).
  const dropdowns: Record<string, any> = {};
  let pengumuman = '';
  if (settings.table) {
    for (const row of settings.rows) {
      const type = toText(row.config_type);
      const key = DROPDOWN_MAP[type];
      // Setiap baris sys_config = SATU opsi (atau satu daftar) — gabungkan.
      if (key) {
        dropdowns[key] = (dropdowns[key] || []).concat(parseConfigList(row.config_value));
      }
      if (type === 'broadcast' && toText(row.config_value).trim() && !pengumuman) {
        pengumuman = toText(row.config_value);
      }
    }
    // TANPA dedupe — backend asli mengirim apa adanya (termasuk duplikat
    // pada tsk), dan kita samakan persis.
  }

  const data = {
    jobs: stripRaw(jobs),
    assets: assets || base.assets,
    dropdowns,
    pengumuman,
  };
  cacheSet('public-base', data, PUBLIC_CACHE_TTL_MS);
  return data;
}

// ---------------------------------------------------------------------------
// getAppData — data utama dashboard
// ---------------------------------------------------------------------------
async function handleGetAppData(payload, sessionToken) {
  const mode = (payload && payload[0]) || 'public';

  if (!hasBackend()) {
    // Belum ada key Supabase -> mode demo supaya preview tetap hidup.
    return demo.demoGetAppData(mode);
  }

  try {
    // Mode admin/kandidat: validasi sesi DULU (murni lokal, tanpa query
    // Supabase) — sesi tidak valid langsung pulang tanpa menunggu tarikan
    // data berat. Respons sama persis: data publik + sessionInvalid:true
    // (frontend lalu membersihkan sesi & reload ke layar login).
    let t = null;
    if (mode === 'admin' || mode === 'kandidat') {
      const role = mode === 'admin' ? 'admin' : 'kandidat';
      t = session.verifyToken(sessionToken);
      const waPayload = String((payload && payload[1]) || '').replace(/\D/g, '');
      const valid =
        t &&
        t.role === role &&
        (mode !== 'kandidat' || (t.wa || '') === waPayload || waPayload === '');
      if (!valid) {
        const pub0 = await loadPublicBase(mode);
        if (pub0.notFound) return { success: false, sessionInvalid: true, error: 'Backend tidak tersedia.' };
        return {
          success: true,
          activeTheme: '',
          sessionInvalid: true,
          jobs: pub0.jobs,
          dropdowns: pub0.dropdowns,
          assets: pub0.assets,
          pengumuman: pub0.pengumuman,
        };
      }
    }

    // FIX #31/#35 (audit 2026-09-02): SEMUA query independen dijalankan
    // dalam SATU gelombang paralel — dulu jadwal/tugas/templates menunggu
    // wave 1 (kandidat) selesai, menambah ~300-500ms serial.
    //
    // Wave 1 (5 paralel): publicBase + candidates + schedules + tugas + templates
    // Wave 2 (2 paralel, depends on wave 1): attachBerkasBio + findFormsLight
    const w = mode === 'kandidat' ? normalizeWa(t.wa || '') : '';
    const wave1 = [loadPublicBase(mode)];
    if (mode === 'admin') {
      wave1.push(
        loadCandidatesUnik('', { page: 1, pageSize: 50 }),
        loadSchedules(),
        loadTugas(),
        loadWaTemplates(),
      );
    }
    if (mode === 'kandidat') {
      wave1.push(findCandidateByWaFiltered(w), findFormsByWa(w), loadSchedules());
    }
    const results = await Promise.all(wave1);
    const pub = results[0];
    if (pub.notFound) {
      // Supabase unreachable — return error for authenticated modes, demo data
      // for public mode. Admin/kandidat must NOT silently see stale demo data.
      if (mode === 'admin' || mode === 'kandidat') {
        return { success: false, error: 'Backend Supabase tidak dapat diakses. Silakan coba lagi.' };
      }
      return pub.base;
    }

    const result: Record<string, any> = {
      success: true,
      activeTheme: '',
      sessionInvalid: false,
      jobs: pub.jobs,
      dropdowns: pub.dropdowns,
      assets: pub.assets,
      pengumuman: pub.pengumuman,
    };

    if (mode === 'admin') {
      // Satu kandidat = satu baris: WA ganda (duplikat warisan) di-dedupe
      // GLOBAL dulu, baru ambil halaman 1 (50). Total = jumlah UNIK supaya
      // pagination frontend (Muat Lebih) tetap konsisten. Jalur cepat: baris
      // ringan untuk dedupe+sort, baris penuh hanya untuk halaman ini.
      const { rows: candRows, total: candidatesTotal } = results[1]; // wave 1
      result.dbJobs = pub.jobs;
      result.candidates = stripRaw(candRows.map(mapCandidate));
      // Jadwal/tugas/templates sudah di-fetch di wave 1 (results[2..4]).
      // Wave 2: hanya data yang DEPENDEN pada kandidat (berkas/bio + forms).
      const [berkas, allForms] = await Promise.all([
        attachBerkasBio(result.candidates),
        // Inbox admin: proyeksi kolom ringan (mapForm & attachApplications
        // hanya membaca kolom itu); fallback findForms() bila skema tidak
        // cocok dengan FORM_LIGHT_COLS.
        findFormsLight().then((r) => (r === undefined ? findForms() : r)),
      ]);
      result.candidates = berkas;
      // Lampirkan SEMUA lamaran (per WA) ke tiap kandidat — mail inbox bisa
      // berisi banyak job per kandidat (multi-apply).
      attachApplications(result.candidates, allForms);
      result.candidatesTotal = candidatesTotal;
      result.schedules = results[2]; // cached, wave 1
      result.tugas = results[3];     // cached, wave 1
      result.formInbox = allForms.map(mapForm);
      result.waTemplates = results[4]; // cached, wave 1
      result.kandidatRiwayat = [];
    }

    if (mode === 'kandidat') {
      // Data kandidat miliknya sendiri — query server-side (filter WA),
      // bukan tarik 300 baris lalu cari di JS. Sudah ditarik PARALEL dengan
      // data publik di atas (results[1]); fallback scan bila kolom WA tidak
      // dikenal (results[1] === undefined).
      let row = results[1];
      if (row === undefined) {
        // Fallback: scan penuh (skema kolom WA tidak dikenal).
        const foundCand = await findCandidates();
        row =
          foundCand.rows.find(
            (r) =>
              normalizeWa(
                pick(r, ['no_wa', 'wa', 'whatsapp', 'telepon', 'phone', 'no_hp']) || '',
              ) === w,
          ) || null;
      }
      result.dbJobs = pub.jobs;
      // Kandidat juga mengisi ALL_CANDIDATES dengan datanya sendiri (sama
      // seperti backend asli) supaya dashboard (progres pemberkasan x/17,
      // biodata, progress bar) punya myData — plus berkas/bio dari master &
      // pemberkasan_checklist.
      const myCands = row ? stripRaw([mapCandidate(row)]) : [];
      await attachBerkasBio(myCands);
      // Dashboard kandidat menampilkan semua job yang dilamar dari mail.
      // Jalur cepat: sudah ditarik paralel di atas (results[2]).
      let myForms = results[2];
      if (myForms === undefined) myForms = await findForms();
      attachApplications(myCands, myForms);
      result.candidates = myCands;
      // Riwayat lamaran kandidat = daftar aplikasi (code/status/timestamp),
      // bukan objek kandidat — frontend renderRiwayatKandidat membaca field
      // r.jobCode/r.kode/r.code. Sebelumnya dikirim myCands (objek kandidat)
      // → kode loker selalu kosong & card progres tidak bisa di-filter per loker.
      result.kandidatRiwayat = (myCands[0] && myCands[0].applications) || [];
      // Jadwal untuk kandidat: filter jadwal yang relevan — WA kandidat ada di
      // daftar_kandidat ATAU jadwal terkait loker yang kandidat lamar. Bentuk
      // objek disesuaikan dgn render frontend (agenda/status/waktu/lokasi/link).
      // Sebelumnya `mySchedules` tidak pernah dibangun backend → box jadwal
      // kandidat selalu kosong walau admin sudah membuat jadwal.
      try {
        const allSched = results[3]; // jadwal — sudah ditarik paralel di atas
        const myJobCodes = new Set(
          (Array.isArray(myForms) ? myForms : [])
            .map((f) => String(pick(f, ['code_job', 'code']) || '').toUpperCase())
            .filter(Boolean),
        );
        result.mySchedules = allSched
          .filter((s) => {
            const kandidatList = String(s.kandidat || '')
              .split(/[\n,;]+/)
              .map((x) => normalizeWa(x))
              .filter(Boolean);
            const inDaftar =
              kandidatList.length > 0 &&
              kandidatList.some((k) => k === w || k.endsWith(w.slice(-9)));
            const lokerSama =
              String(s.idLoker || '').toUpperCase() !== '-' &&
              myJobCodes.has(String(s.idLoker || '').toUpperCase());
            return inDaftar || lokerSama;
          })
          .map((s) => ({
            agenda: s.namaAgenda || '',
            status: s.status || 'AKTIF',
            waktu: s.waktu || '',
            lokasi: s.link && s.link !== '-' ? s.link : '-',
            link: s.link && s.link !== '-' ? s.link : '',
          }));
      } catch {
        result.mySchedules = [];
      }
    }

    return result;
  } catch (e) {
    return { success: false, message: 'Gagal memuat data dari Supabase: ' + e.message };
  }
}

// Laporan ringkas per loker: jumlah kandidat per tahapan + status.
// FIX #29 (audit 2026-09-02): Gunakan findAllCandidatesLight langsung
// (sudah paginated 1000/baris, full table scan) alih-alih
// loadCandidatesUnik(pageSize:5000) yang akan clamp ke 100 dan hanya
// mengembalikan 100 baris.
async function handleGetMonthlyReport(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  try {
    // Ambil semua kandidat unik via light projection (full table scan)
    const light = await findAllCandidatesLight();
    const rows = light !== undefined ? light : [];
    const uniq = dedupeKandidatRaw(rows);
    const candRows = uniq;
    const cands = candRows.map(mapCandidate);
    // Aggregate by loker
    const byLoker: Record<string, any> = {};
    for (const c of cands) {
      const loker = String(c.idLoker || 'UNKNOWN').trim();
      if (!byLoker[loker]) {
        byLoker[loker] = { total: 0, tahapan: {}, status: {} };
      }
      byLoker[loker].total++;
      const tahap = String(c.tahapan || '-').trim() || '-';
      byLoker[loker].tahapan[tahap] = (byLoker[loker].tahapan[tahap] || 0) + 1;
      const stat = String(c.status || '-').trim() || '-';
      byLoker[loker].status[stat] = (byLoker[loker].status[stat] || 0) + 1;
    }
    // Sort by total desc
    const report = Object.entries(byLoker)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([loker, data]) => ({ loker, ...data }));
    return {
      success: true,
      report,
      totalCandidates: cands.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (e) {
    return { success: false, error: 'Gagal generate laporan: ' + e.message };
  }
}

export {
  handleGetAppData,
  handleGetMonthlyReport,
  // Helper yang masih dipakai handler lain di handlers.js (getCandidatesPage,
  // getJobMapped, dll) — export supaya tidak dobel definisi.
  loadCandidatesUnik,
  stripRaw,
  loadSchedules,
  loadTugas,
  loadWaTemplates,
};
