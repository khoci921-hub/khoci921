import { tr } from '../../i18n.ts';
import { ALL_CANDIDATES, ASSETS, limitKan } from '../init/state.ts';
import { ensureAllCandidates } from '../api/candidates.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// 7. FUNGSI RENDER — DOMAIN KANDIDAT (tabel daftar kandidat admin)
// ==========================================
// js/render/{public,admin,candidate,share,mail}.js (global scope TETAP).
// File ini: kolom "Job Dilamar", filter kandidat (teks/gender/usia/JFT) &

// Kolom "Job Dilamar" di tabel kandidat: job utama (id_loker_pilihan) +
// chip +N kalau kandidat punya lamaran lain di mail (multi-apply).
export function jobDilamarCell(c) {
  var primaryRaw = String((c && c.idLoker) || '').trim();
  var primaryCodes = primaryRaw
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  var extra = 0;
  (c.applications || []).forEach(function (a) {
    var code = a && a.code ? String(a.code).trim() : '';
    if (code && primaryCodes.indexOf(code) === -1) extra++;
  });
  var label = primaryRaw && primaryRaw !== '-' ? window.esc(primaryRaw) : window.esc('Umum');
  if (extra > 0) {
    label +=
      '<span class="px-1.5 py-0.5 ml-1 rounded-md bg-sky-900/70 text-sky-300 border border-sky-600/50 text-[9px] font-bold">+' +
      extra +
      '</span>';
  }
  // Riwayat lamaran (multi-apply): tombol CV per loker — tiap lamaran membawa
  // file_cv sendiri (CV loker lama & baru tetap utuh di folder kandidat).
  var appCvBtns = '';
  (c.applications || []).forEach(function (a) {
    var acode = a && a.code ? String(a.code).trim() : '';
    var acv = a && a.cv ? String(a.cv) : '';
    if (!acode || !acv || acv === '-' || !/^https?:/i.test(acv)) return;
    var isImg = /\.(jpe?g|png|webp|gif|bmp|svg)(\?|$)/i.test(acv) || /^data:image\//i.test(acv);
    appCvBtns +=
      '<button onclick="' +
      (isImg ? 'bukaFotoPreview' : 'bukaPdfPreview') +
      "('" +
      window.escJs(acv) +
      '\')" title="CV ' +
      window.esc(acode) +
      '" class="px-1.5 py-0.5 rounded bg-indigo-900/70 text-indigo-300 border border-indigo-600/50 text-[9px] font-bold hover:bg-indigo-700 hover:text-white transition whitespace-nowrap"><i class="fas fa-file-alt mr-0.5"></i>CV ' +
      window.esc(acode) +
      '</button>';
  });
  return (
    label + (appCvBtns ? '<span class="flex flex-wrap gap-1 mt-1.5">' + appCvBtns + '</span>' : '')
  );
}

// Mode tampilan tabel kandidat: false = lengkap (default), true = sederhana
// (mirip portal mitra Act Job: kolom minim supaya cepat di-scan & mudah
// dibaca admin di HP). Label tombol toggle + <thead> ikut mode ini.
// Preferensi per-admin disimpan di localStorage supaya tidak reset tiap reload.
let viewKandidatSimple = false;
try {
  var stored = window.localStorage.getItem('asj_view_kandidat_simple');
  if (stored !== null) {
    viewKandidatSimple = stored === '1';
  } else if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
    // Boot pertama kali di mobile: default simple (belum ada preferensi tersimpan)
    viewKandidatSimple = true;
  }
} catch (e) {}

// ── Column filter state (Excel-style) ──────────────────────────────────
// Keys: 'id', 'nama', 'job', 'tahapan', 'catatan'. Nilai = string (text)
// atau 'all' (dropdown). Dipakai oleh filterKandidat + renderKandidatHead.
// State dipersist per-admin di localStorage supaya tidak reset tiap reload.
const COL_FILTER_DEFAULTS = {
  id: '',
  nama: '',
  job: 'all',
  tahapan: 'all',
  catatan: '',
  wa: '',
  email: '',
};
const columnFilters = { ...COL_FILTER_DEFAULTS };
let _colFilterUniques = { job: [], tahapan: [] }; // cache unik value dari data

// Load column filters dari localStorage.
function loadColumnFilters() {
  try {
    var raw = window.localStorage.getItem('asj_col_filters');
    if (raw) {
      var saved = JSON.parse(raw);
      Object.keys(COL_FILTER_DEFAULTS).forEach(function (k) {
        if (saved[k] !== undefined) columnFilters[k] = saved[k];
      });
    }
  } catch (e) {}
}
// Simpan column filters ke localStorage.
function saveColumnFilters() {
  try {
    window.localStorage.setItem('asj_col_filters', JSON.stringify(columnFilters));
  } catch (e) {}
}
// Load saat modul di-eval (pertama kali).
loadColumnFilters();

// Bangun daftar unik per kolom dropdown dari data kandidat + simpan ke cache.
function buildColumnUniques() {
  var jobs: Record<string, any> = {};
  var stages: Record<string, any> = {};
  (ALL_CANDIDATES || []).forEach(function (c) {
    var j = String(c.idLoker || '').trim();
    if (j && j !== '-') jobs[j] = 1;
    var s = String(c.tahapan || '').trim();
    if (s) stages[s] = 1;
  });
  _colFilterUniques.job = Object.keys(jobs).sort();
  _colFilterUniques.tahapan = Object.keys(stages).sort();
}

// Reset semua filter kolom + sinkronkan UI.
export function clearColumnFilters() {
  columnFilters.id = '';
  columnFilters.nama = '';
  columnFilters.job = 'all';
  columnFilters.tahapan = 'all';
  columnFilters.catatan = '';
  columnFilters.wa = '';
  columnFilters.email = '';
  saveColumnFilters();
  // Clear input/select UI
  [
    'col-filter-id',
    'col-filter-nama',
    'col-filter-catatan',
    'col-filter-wa',
    'col-filter-email',
  ].forEach(function (elId) {
    var el = document.getElementById(elId);
    if (el) el.value = '';
  });
  ['col-filter-job', 'col-filter-tahapan'].forEach(function (elId) {
    var el = document.getElementById(elId);
    if (el) el.value = 'all';
  });
  syncClearBtn();
  filterKandidat();
}

// Sinkronkan visibility tombol "Clear Filters" berdasarkan apakah ada filter aktif.
function syncClearBtn() {
  var btn = document.getElementById('btn-clear-col-filters');
  if (!btn) return;
  var hasFilter = Object.keys(columnFilters).some(function (k) {
    return columnFilters[k] !== '' && columnFilters[k] !== 'all';
  });
  btn.classList.toggle('hidden', !hasFilter);
}

// Shared filter predicate — dipakai oleh filterKandidat() DAN exportKandidatCsv().
// Mengembalikan true kalau kandidat cocok dengan semua filter aktif.
function matchesCandidateFilters(c, val, genF, ageF, jftF) {
  if (!c) return false;
  // Text search
  if (val) {
    var matchText =
      String(c.nama || '')
        .toLowerCase()
        .includes(val) ||
      String(c.idKandidat || '')
        .toLowerCase()
        .includes(val) ||
      String(c.tahapan || '')
        .toLowerCase()
        .includes(val) ||
      String(c.idLoker || '')
        .toLowerCase()
        .includes(val);
    if (!matchText) return false;
  }
  // Gender
  if (genF !== 'all') {
    var g = (c.gender || '').toUpperCase().includes('PEREMPUAN') ? 'p' : 'l';
    if (g !== genF) return false;
  }
  // Age
  if (ageF !== 'all') {
    var usia = parseInt(String(c.usia).replace(/\D/g, '')) || 0;
    if (ageF === 'under20' && (usia === 0 || usia >= 20)) return false;
    if (ageF === '20to25' && (usia < 20 || usia > 25)) return false;
    if (ageF === 'over25' && usia <= 25) return false;
  }
  // JFT
  if (jftF !== 'all') {
    var jftText = (c.jft || c.nilai_jft || c.bahasa || c.catatanInt || '').toUpperCase();
    if (jftF === 'a2' && !jftText.includes('A2') && !jftText.includes('N4')) return false;
    if (jftF === 'b1' && !jftText.includes('B1') && !jftText.includes('N3')) return false;
  }
  // Column filters
  if (
    columnFilters.id &&
    !(c.idKandidat || '').toLowerCase().includes(columnFilters.id.toLowerCase())
  )
    return false;
  if (
    columnFilters.nama &&
    !(c.nama || '').toLowerCase().includes(columnFilters.nama.toLowerCase())
  )
    return false;
  if (columnFilters.wa && !(c.wa || '').toLowerCase().includes(columnFilters.wa.toLowerCase()))
    return false;
  if (
    columnFilters.email &&
    !(c.email || '').toLowerCase().includes(columnFilters.email.toLowerCase())
  )
    return false;
  if (columnFilters.job !== 'all' && String(c.idLoker || '').trim() !== columnFilters.job)
    return false;
  if (columnFilters.tahapan !== 'all' && String(c.tahapan || '').trim() !== columnFilters.tahapan)
    return false;
  if (
    columnFilters.catatan &&
    !(c.catatanExt || c.catatan || '').toLowerCase().includes(columnFilters.catatan.toLowerCase())
  )
    return false;
  return true;
}

// Debounce timer untuk filter input (hindari render 223 baris tiap keystroke).
let _filterDebounceTimer = null;
function debouncedFilterKandidat(delay) {
  clearTimeout(_filterDebounceTimer);
  _filterDebounceTimer = setTimeout(function () {
    filterKandidat();
  }, delay || 250);
}

// Handler perubahan filter kolom (dipanggil dari onchange/oninput di thead).
export function onColumnFilterChange(colKey, value) {
  columnFilters[colKey] = value;
  saveColumnFilters();
  syncClearBtn();
  // @ts-expect-error JS→TS migration
  debouncedFilterKandidat();
}

// Header tabel kandidat mengikuti mode tampilan (lengkap vs sederhana).
// Mode lengkap: baris kedua berisi input/select filter per kolom (Excel-style).
export function renderKandidatHead() {
  var head = document.getElementById('admin-kandidat-head');
  if (!head) return;

  buildColumnUniques();
  var inputCls =
    'w-full bg-black/50 border border-slate-600 text-white text-[11px] px-2 py-1 rounded focus:border-sky-500 outline-none transition placeholder-slate-500';
  var selectCls =
    'w-full bg-black/50 border border-slate-600 text-white text-[11px] px-1 py-1 rounded focus:border-sky-500 outline-none transition';

  // Build job dropdown options
  var jobOpts = '<option value="all">—</option>';
  _colFilterUniques.job.forEach(function (j) {
    var sel = columnFilters.job === j ? ' selected' : '';
    jobOpts += '<option value="' + window.esc(j) + '"' + sel + '>' + window.esc(j) + '</option>';
  });
  // Build tahapan dropdown options
  var tahOpts = '<option value="all">—</option>';
  _colFilterUniques.tahapan.forEach(function (t) {
    var sel = columnFilters.tahapan === t ? ' selected' : '';
    tahOpts +=
      '<option value="' +
      window.esc(t) +
      '"' +
      sel +
      '>' +
      window.esc(window.trOption(t)) +
      '</option>';
  });

  if (viewKandidatSimple) {
    var cols = [
      ['table.full_name', 'Nama'],
      ['table.wa_num', 'No. WA'],
      ['table.email', 'Email'],
      ['table.applied_job', 'Job'],
      ['table.stage_status', 'Tahapan'],
      ['table.tanggal', 'Tanggal'],
    ];
    var headerRowSimple =
      '<tr>' +
      cols
        .map(function (c) {
          return '<th class="p-4" data-lang="' + c[0] + '">' + tr(c[0]) + '</th>';
        })
        .join('') +
      '</tr>';

    var filterRowSimple =
      '<tr class="border-b border-slate-700">' +
      '<th class="px-3 pb-2"><input id="col-filter-nama" type="text" placeholder="' +
      tr('table.full_name') +
      '…" value="' +
      window.esc(columnFilters.nama) +
      '" oninput="window.onColumnFilterChange(\'nama\', this.value)" class="' +
      inputCls +
      '"></th>' +
      '<th class="px-3 pb-2"><input id="col-filter-wa" type="text" placeholder="' +
      tr('table.wa_num') +
      '…" value="' +
      window.esc(columnFilters.wa) +
      '" oninput="window.onColumnFilterChange(\'wa\', this.value)" class="' +
      inputCls +
      '"></th>' +
      '<th class="px-3 pb-2"><input id="col-filter-email" type="text" placeholder="' +
      tr('table.email') +
      '…" value="' +
      window.esc(columnFilters.email) +
      '" oninput="window.onColumnFilterChange(\'email\', this.value)" class="' +
      inputCls +
      '"></th>' +
      '<th class="px-3 pb-2"><select id="col-filter-job" onchange="window.onColumnFilterChange(\'job\', this.value)" class="' +
      selectCls +
      '">' +
      jobOpts +
      '</select></th>' +
      '<th class="px-3 pb-2"><select id="col-filter-tahapan" onchange="window.onColumnFilterChange(\'tahapan\', this.value)" class="' +
      selectCls +
      '">' +
      tahOpts +
      '</select></th>' +
      '<th class="px-3 pb-2"></th>' +
      '</tr>';

    head.innerHTML = headerRowSimple + filterRowSimple;
    syncClearBtn();
    return;
  }

  // ── Mode Lengkap: header + filter row ──

  var headerRow =
    '<tr>' +
    '<th class="p-4" data-lang="table.candidate_id">' +
    tr('table.candidate_id') +
    '</th>' +
    '<th class="p-4" data-lang="table.full_name">' +
    tr('table.full_name') +
    '</th>' +
    '<th class="p-4" data-lang="table.applied_job">' +
    tr('table.applied_job') +
    '</th>' +
    '<th class="p-4" data-lang="table.stage_status">' +
    tr('table.stage_status') +
    '</th>' +
    '<th class="p-4" data-lang="table.admin_note">' +
    tr('table.admin_note') +
    '</th>' +
    '<th class="p-4 text-center" data-lang="table.action_candidate">' +
    tr('table.action_candidate') +
    '</th>' +
    '</tr>';

  var filterRow =
    '<tr class="border-b border-slate-700">' +
    '<th class="px-3 pb-2"><input id="col-filter-id" type="text" placeholder="' +
    tr('table.candidate_id') +
    '…" value="' +
    window.esc(columnFilters.id) +
    '" oninput="window.onColumnFilterChange(\'id\', this.value)" class="' +
    inputCls +
    '"></th>' +
    '<th class="px-3 pb-2"><input id="col-filter-nama" type="text" placeholder="' +
    tr('table.full_name') +
    '…" value="' +
    window.esc(columnFilters.nama) +
    '" oninput="window.onColumnFilterChange(\'nama\', this.value)" class="' +
    inputCls +
    '"></th>' +
    '<th class="px-3 pb-2"><select id="col-filter-job" onchange="window.onColumnFilterChange(\'job\', this.value)" class="' +
    selectCls +
    '">' +
    jobOpts +
    '</select></th>' +
    '<th class="px-3 pb-2"><select id="col-filter-tahapan" onchange="window.onColumnFilterChange(\'tahapan\', this.value)" class="' +
    selectCls +
    '">' +
    tahOpts +
    '</select></th>' +
    '<th class="px-3 pb-2"><input id="col-filter-catatan" type="text" placeholder="' +
    tr('table.admin_note') +
    '…" value="' +
    window.esc(columnFilters.catatan) +
    '" oninput="window.onColumnFilterChange(\'catatan\', this.value)" class="' +
    inputCls +
    '"></th>' +
    '<th class="px-3 pb-2"></th>' +
    '</tr>';

  head.innerHTML = headerRow + filterRow;
  syncClearBtn();
}

// Sinkronkan label tombol dengan mode aktif (dipanggil tiap render
// supaya mode persist dari localStorage konsisten sejak boot).
// CATATAN: TIDAK boleh memanggil renderKandidatHead() di sini — fungsi ini
// dipanggil dari renderKandidatTable() yang dipicu tiap keystroke filter.
// Memanggil renderKandidatHead() akan menghancurkan input filter di <thead>
// dan menyebabkan focus hilang (bug 2026-08-19). Head hanya di-render saat
// init (pertama kali) atau toggle tampilan (toggleViewKandidat).
function syncViewKandidatUi() {
  var btn = document.getElementById('btn-view-kandidat');
  if (btn) {
    var span = btn.querySelector('span[data-lang]');
    var key = viewKandidatSimple ? 'admin.view_full' : 'admin.view_simple';
    if (span) {
      span.setAttribute('data-lang', key);
      span.textContent = tr(key);
    } else {
      btn.textContent = tr(key);
    }
  }
}

// Toggle Tampilan Sederhana ↔ Lengkap (tombol di header Data Pelamar).
// Di mobile (≤768px), otomatis pakai mode sederhana.
export function toggleViewKandidat() {
  viewKandidatSimple = !viewKandidatSimple;
  try {
    window.localStorage.setItem('asj_view_kandidat_simple', viewKandidatSimple ? '1' : '0');
  } catch (e) {}
  syncViewKandidatUi();
  renderKandidatHead(); // Render ulang head karena mode berubah
  filterKandidat();
}

// Baris sederhana (mode Act Job): Nama, WA (link wa.me), Email, Job, Tahapan,
// Tanggal — tanpa aksi, murni untuk dibaca cepat.
function renderKandidatTableSimple(tb, arr) {
  var html = '';
  for (var i = 0; i < Math.min(arr.length, limitKan); i++) {
    var c = arr[i];
    var waNum = String(c.wa || '').replace(/\D/g, '');
    var waLink = waNum ? 'https://wa.me/' + waNum : '#';
    var tgl = String(c.tanggalDaftar || c.createdAt || '').slice(0, 10) || '-';
    html +=
      '<tr class="rt-row border-b border-slate-800 hover:bg-white/5">' +
      '<td data-label="' +
      tr('table.full_name') +
      '" class="p-4 font-bold text-white">' +
      window.esc(c.nama || '-') +
      '</td>' +
      '<td data-label="' +
      tr('table.wa_num') +
      '" class="p-4 font-mono text-emerald-300 text-xs"><a href="' +
      waLink +
      '" target="_blank" rel="noopener" class="hover:underline">' +
      window.esc(waNum || '-') +
      '</a></td>' +
      '<td data-label="' +
      tr('table.email') +
      '" class="p-4 text-slate-300 text-xs break-all">' +
      window.esc(c.email || '-') +
      '</td>' +
      '<td data-label="' +
      tr('table.applied_job') +
      '" class="p-4 font-mono text-amber-300 text-xs">' +
      window.esc(c.idLoker && c.idLoker !== '-' ? c.idLoker : 'Umum') +
      '</td>' +
      '<td data-label="' +
      tr('table.stage_status') +
      '" class="p-4 text-xs font-bold text-sky-400">' +
      window.esc(window.trOption(c.tahapan)) +
      '</td>' +
      '<td data-label="' +
      tr('table.tanggal') +
      '" class="p-4 text-[11px] text-slate-400 whitespace-nowrap">' +
      window.esc(tgl) +
      '</td></tr>';
  }
  if (arr.length > limitKan) {
    html +=
      '<tr id="load-more-kan-simple"><td colspan="6" class="p-4 text-center"><button onclick="window.limitKan+=25; window.filterKandidat();" class="text-xs text-sky-400 font-bold">' +
      tr('form.txt_lebih_banyak') +
      '</button></td></tr>';
  }
  tb.innerHTML = html;
}

// Escaping sel CSV: kutip + gandakan quote kalau ada koma/kutip/newline.
function csvCell(v) {
  var s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Export kandidat ke CSV — kalau ada filter aktif (search/gender/age/JFT/column),
// hanya baris yang match; kalau tidak, export semua. BOM UTF-8 untuk Excel.
export async function exportKandidatCsv() {
  try {
    try {
      await ensureAllCandidates();
    } catch (e) {}
    // Kumpulkan semua filter aktif (persis sama dengan filterKandidat)
    var el = document.getElementById('search-kandidat');
    var val = el ? el.value.toLowerCase() : '';
    var genF = document.getElementById('filter-db-gender')
      ? document.getElementById('filter-db-gender').value
      : 'all';
    var ageF = document.getElementById('filter-db-age')
      ? document.getElementById('filter-db-age').value
      : 'all';
    var jftF = document.getElementById('filter-db-jft')
      ? document.getElementById('filter-db-jft').value
      : 'all';
    var hasAnyFilter =
      val ||
      genF !== 'all' ||
      ageF !== 'all' ||
      jftF !== 'all' ||
      columnFilters.id ||
      columnFilters.nama ||
      columnFilters.job !== 'all' ||
      columnFilters.tahapan !== 'all' ||
      columnFilters.catatan;
    var rows = (ALL_CANDIDATES || []).filter(function (c) {
      if (!hasAnyFilter) return true;
      return matchesCandidateFilters(c, val, genF, ageF, jftF);
    });
    var head = [
      'ID Kandidat',
      'Nama',
      'No WA',
      'Email',
      'Gender',
      'Usia',
      'Job ID',
      'Tahapan',
      'Status',
      'Catatan Admin',
      'Tanggal Daftar',
    ];
    var lines = [head.join(',')];
    rows.forEach(function (c) {
      var safeGender = String(c.gender || '').toUpperCase();
      var gender = safeGender.includes('PEREMPUAN') ? 'P' : safeGender.includes('LAKI') ? 'L' : '';
      lines.push(
        [
          c.idKandidat,
          c.nama,
          c.wa,
          c.email,
          gender,
          c.usia,
          c.idLoker,
          window.trOption(c.tahapan),
          c.status,
          c.catatanExt || c.catatan || '',
          c.tanggalDaftar || c.createdAt || '',
        ]
          .map(csvCell)
          .join(','),
      );
    });
    var csv = '\uFEFF' + lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'asj-kandidat-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 5000);
    var filtered = hasAnyFilter && rows.length < (ALL_CANDIDATES || []).length;
    var msg = window.tr('admin.toast_csv_downloaded').replace('{n}', String(rows.length));
    if (filtered) msg += ' (' + tr('admin.filtered') + ')';
    window.showToast(msg, 'success');
  } catch (err) {
    window.showToast(
      window.tr('ui.toast_failed_prefix') + ' ' + String((err && err.message) || err),
      'error',
    );
  }
}

export async function filterKandidat() {
  // Pencarian admin butuh daftar penuh - pastikan semua halaman sudah dimuat.
  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  var el = document.getElementById('search-kandidat');
  var val = el ? el.value.toLowerCase() : '';

  var genF = document.getElementById('filter-db-gender')
    ? document.getElementById('filter-db-gender').value
    : 'all';
  var ageF = document.getElementById('filter-db-age')
    ? document.getElementById('filter-db-age').value
    : 'all';
  var jftF = document.getElementById('filter-db-jft')
    ? document.getElementById('filter-db-jft').value
    : 'all';

  var arr = (ALL_CANDIDATES || []).filter(function (c) {
    return matchesCandidateFilters(c, val, genF, ageF, jftF);
  });
  renderKandidatTable(arr);
}

let _headInitialized = false;

export function renderKandidatTable(arr) {
  var tb = document.getElementById('admin-kandidat-body');
  if (!tb) return;
  syncViewKandidatUi();
  // Head hanya di-render sekali saat pertama kali (init). Setelahnya, head
  // dikelola oleh toggleViewKandidat/clearColumnFilters — BUKAN tiap keystroke.
  if (!_headInitialized) {
    renderKandidatHead();
    _headInitialized = true;
  }
  if (viewKandidatSimple) {
    renderKandidatTableSimple(tb, arr);
    setupInfiniteScroll();
    return;
  }
  var html = '';
  for (var i = 0; i < Math.min(arr.length, limitKan); i++) {
    var c = arr[i];
    var waLink = 'https://wa.me/' + String(c.wa).replace(/\D/g, '');

    let isVip = (c.catatanInt || '').includes('[VIP]');
    let logoSrc =
      ASSETS.LOGO ||
      'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/logo_asj.png';

    let namaTampil = isVip
      ? window.esc(c.nama) +
        ' <img src="' +
        window.esc(logoSrc) +
        '" class="inline-block w-4 h-4 ml-1 rounded-full border border-emerald-500/50 object-contain drop-shadow-md" title="' +
        tr('ui.badge_official') +
        '">'
      : window.esc(c.nama);

    html +=
      '<tr class="rt-row border-b border-slate-800 hover:bg-white/5">' +
      '<td data-label="' +
      tr('table.candidate_id') +
      '" class="p-4 font-mono text-sky-300 font-bold">' +
      window.esc(c.idKandidat) +
      '</td>' +
      '<td data-label="' +
      tr('table.full_name') +
      '" class="p-4 font-bold text-white">' +
      namaTampil +
      '</td>' +
      '<td data-label="' +
      tr('table.applied_job') +
      '" class="p-4 text-amber-300 font-mono text-xs max-w-[200px]">' +
      jobDilamarCell(c) +
      '</td>' +
      '<td data-label="' +
      tr('table.stage_status') +
      '" class="rt-full p-4 text-xs font-bold text-sky-400">' +
      window.esc(window.trOption(c.tahapan)) +
      '<br><span class="text-[10px] font-normal text-slate-400">' +
      window.esc(window.trOption(c.status)) +
      '</span></td>' +
      '<td data-label="' +
      tr('table.admin_note') +
      '" class="rt-full p-4 text-[11px] text-slate-400 max-w-[150px] truncate">' +
      window.esc(c.catatanExt || c.catatan || '-') +
      '</td>' +
      '<td data-label="' +
      tr('table.action_candidate') +
      '" class="rt-full p-4 text-center flex gap-2 justify-center flex-wrap">' +
      // TOMBOL 1: Lihat Dashboard/Profil Digital
      '<button onclick="bukaDigitalCV(\'' +
      window.escJs(c.idKandidat) +
      '\')" aria-label="' +
      tr('button.view_cv') +
      '" class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] shadow transition" title="' +
      tr('button.view_cv') +
      '"><i class="fas fa-user-circle"></i></button> ' +
      // TOMBOL 2: Tombol Baru Admin Lihat & Print CV
      '<button onclick="bukaPreviewCV_Admin(\'' +
      window.escJs(c.wa) +
      '\')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] shadow transition font-bold" title="' +
      tr('ui.view_rireki') +
      '"><i class="fas fa-file-pdf mr-1"></i> CV</button> ' +
      // TOMBOL 3: Super Edit Kandidat
      '<button onclick="bukaSuperEditKandidat(\'' +
      window.escJs(c.idKandidat) +
      '\')" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold shadow transition" title="' +
      tr('ui.edit_candidate') +
      '"><i class="fas fa-user-shield"></i> ' +
      tr('admin.btn_edit') +
      '</button> ' +
      // TOMBOL 4 & 5: Buka Form Master Manual & Kirim WA
      '<button onclick="bukaMasterEksternalAdmin(\'' +
      window.escJs(c.wa) +
      "', '" +
      window.escJs(c.nama) +
      '\')" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded text-[10px] shadow transition" title="' +
      tr('ui.open_master_form') +
      '"><i class="fas fa-file-alt"></i> AI CV</button>' +
      '<button onclick="bukaModalWaPintar(\'' +
      window.escJs(c.idKandidat) +
      '\')" aria-label="' +
      tr('ui.send_wa_call') +
      '" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] shadow transition" title="' +
      tr('ui.send_wa_call') +
      '"><i class="fab fa-whatsapp"></i></button>' +
      '</td></tr>';
  }
  if (arr.length > limitKan) {
    html +=
      '<tr id="load-more-kan"><td colspan="6" class="p-4 text-center"><button onclick="window.limitKan+=25; window.filterKandidat();" class="text-xs text-sky-400 font-bold">' +
      tr('form.txt_lebih_banyak') +
      '</button></td></tr>';
  }
  tb.innerHTML = html;
  setupInfiniteScroll();
}

let _kanObserver = null;
function setupInfiniteScroll() {
  if (_kanObserver) {
    _kanObserver.disconnect();
  }
  let target =
    document.getElementById('load-more-kan') || document.getElementById('load-more-kan-simple');
  if (target) {
    _kanObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          // @ts-expect-error JS→TS migration
          window.limitKan += 25;
          window.filterKandidat();
        }
      },
      { rootMargin: '100px' },
    );
    _kanObserver.observe(target);
  }
}

// Laporan bulanan: panggil backend getMonthlyReport, tampilkan di toast.
async function showMonthlyReport() {
  try {
    const res = await window.callAPI('getMonthlyReport');
    if (!res || !res.success) {
      window.showToast(
        window.tr('ui.toast_failed_prefix') + ' ' + ((res && res.error) || ''),
        'error',
      );
      return;
    }
    const report = res.report || [];
    let html = '<div class="text-left max-h-[60vh] overflow-y-auto">';
    html +=
      '<p class="text-xs text-slate-400 mb-3">' +
      window.tr('admin.report_total') +
      ': <b class="text-white">' +
      res.totalCandidates +
      '</b>' +
      ' &middot; ' +
      res.generatedAt.slice(0, 10) +
      '</p>';
    if (report.length === 0) {
      html += '<p class="text-slate-500 text-sm">' + tr('admin.report_empty') + '</p>';
    }
    for (const r of report) {
      html += '<div class="mb-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">';
      html += '<div class="flex items-center justify-between mb-2">';
      html += '<span class="text-sm font-bold text-sky-300">' + window.esc(r.loker) + '</span>';
      html +=
        '<span class="text-xs font-bold text-white bg-sky-600/30 px-2 py-0.5 rounded">' +
        r.total +
        '</span>';
      html += '</div>';
      // Tahapan
      // @ts-expect-error JS→TS migration
      const tahapEntries = Object.entries(r.tahapan).sort((a, b) => b[1] - a[1]);
      if (tahapEntries.length > 0) {
        html +=
          '<div class="text-[10px] text-slate-400 mb-1">' +
          window.tr('admin.report_by_stage') +
          ':</div>';
        html += '<div class="flex flex-wrap gap-1">';
        for (const [t, n] of tahapEntries) {
          html +=
            '<span class="text-[10px] px-1.5 py-0.5 bg-slate-700/60 rounded text-slate-300">' +
            window.esc(t) +
            ': ' +
            n +
            '</span>';
        }
        html += '</div>';
      }
      // Status
      // @ts-expect-error JS→TS migration
      const statEntries = Object.entries(r.status).sort((a, b) => b[1] - a[1]);
      if (statEntries.length > 0) {
        html +=
          '<div class="text-[10px] text-slate-400 mt-1 mb-1">' +
          window.tr('admin.report_by_status') +
          ':</div>';
        html += '<div class="flex flex-wrap gap-1">';
        for (const [s, n] of statEntries) {
          html +=
            '<span class="text-[10px] px-1.5 py-0.5 bg-slate-700/60 rounded text-slate-300">' +
            window.esc(s) +
            ': ' +
            n +
            '</span>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    // @ts-expect-error JS→TS migration
    window.showToast(window.tr('admin.report_title'), 'info', 8000);
    // Tampilkan sebagai modal sederhana
    var existing = document.getElementById('modal-monthly-report');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'modal-monthly-report';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70';
    var box = document.createElement('div');
    box.className =
      'bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4';
    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-4';
    var title = document.createElement('h3');
    title.className = 'text-lg font-bold text-white';
    title.textContent = window.tr('admin.report_title');
    var closeBtn = document.createElement('button');
    closeBtn.className = 'text-slate-400 hover:text-white text-xl';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', function () {
      overlay.remove();
    });
    header.appendChild(title);
    header.appendChild(closeBtn);
    var content = document.createElement('div');
    content.innerHTML = html;
    box.appendChild(header);
    box.appendChild(content);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
  } catch (e) {
    window.showToast(window.tr('ui.toast_failed_prefix') + ' ' + String(e.message || e), 'error');
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (window.filterKandidat, window.limitKan+=25;...).
registerSeamAliases({
  filterKandidat,
  toggleViewKandidat,
  exportKandidatCsv,
  clearColumnFilters,
  onColumnFilterChange,
  showMonthlyReport,
  // Debounced filter untuk search input (hindari render 223 baris tiap keystroke)
  _debouncedFilter: function () {
    debouncedFilterKandidat(250);
  },
});
