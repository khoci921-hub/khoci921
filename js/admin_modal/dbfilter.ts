import { DROPDOWNS, dbFilterBidang, dbFilterTahapan } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// ==========================================
// FILTER & SORT TABEL DB JOB ADMIN — chip bidang/tahapan + urutan
// ==========================================
export function setFilterBidang(v) {
  window.dbFilterBidang = v;
  renderDbFilters();
  window.filterDbJob();
}
export function setFilterTahapan(v) {
  window.dbFilterTahapan = v;
  renderDbFilters();
  window.filterDbJob();
}
export function setSortDb(t) {
  window.dbSortType = t;
  ['terbaru', 'terlama', 'terbanyak'].forEach((x) => {
    var b = document.getElementById('btn-sort-' + x);
    if (b)
      b.className =
        'px-4 py-1.5 rounded-full font-bold transition ' +
        (t === x.toUpperCase()
          ? 'bg-purple-600 text-white shadow-lg'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600');
  });
  window.filterDbJob();
}

export function renderDbFilters() {
  var bContainer = document.getElementById('filter-bidang-container');
  var tContainer = document.getElementById('filter-tahapan-container');
  if (DROPDOWNS.kategori && bContainer) {
    var bHtml =
      '<button onclick="setFilterBidang(\'ALL\')" class="px-3 py-1 rounded-full ' +
      (dbFilterBidang === 'ALL' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400') +
      '">' +
      window.tr('public.all') +
      '</button>';
    // Label chip dwi bahasa (trOption); onclick tetap ID asli (trOptionId)
    // supaya filter cocok dengan data yang tersimpan.
    DROPDOWNS.kategori.forEach((kat) => {
      bHtml +=
        '<button onclick="setFilterBidang(\'' +
        window.escJs(window.trOptionId(kat)) +
        '\')" class="px-3 py-1 rounded-full ' +
        (dbFilterBidang === window.trOptionId(kat)
          ? 'bg-purple-600 text-white'
          : 'bg-slate-800 text-slate-400') +
        '">' +
        window.esc(window.trOption(kat)) +
        '</button>';
    });
    bContainer.innerHTML = bHtml;
  }
  if (DROPDOWNS.tahapan && tContainer) {
    var tHtml =
      '<button onclick="setFilterTahapan(\'ALL\')" class="px-3 py-1 rounded-full ' +
      (dbFilterTahapan === 'ALL' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400') +
      '">' +
      window.tr('public.all') +
      '</button>';
    DROPDOWNS.tahapan.forEach((thp) => {
      tHtml +=
        '<button onclick="setFilterTahapan(\'' +
        window.escJs(window.trOptionId(thp)) +
        '\')" class="px-3 py-1 rounded-full ' +
        (dbFilterTahapan === window.trOptionId(thp)
          ? 'bg-purple-600 text-white'
          : 'bg-slate-800 text-slate-400') +
        '">' +
        window.esc(window.trOption(thp)) +
        '</button>';
    });
    tContainer.innerHTML = tHtml;
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (chip filter renderDbFilters sendiri + admin/index
// setSortDb, render/admin.js window.renderDbFilters).
registerSeamAliases({
  setFilterBidang,
  setFilterTahapan,
  setSortDb,
  renderDbFilters,
});
