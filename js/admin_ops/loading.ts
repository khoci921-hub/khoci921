import { isAdmin, isKandidat } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// js/admin_ops/{schedule,candidates,sysconfig,loading,migration,drive}.js.
// ==========================================
// SKELETON LOADING (ANTI LAYAR HITAM) — bayangan tabel saat tarik data
// ==========================================
export function setSkeletonLoading(elementId, cols) {
  var tb = document.getElementById(elementId);
  if (!tb) return;
  var html = '';
  // Bikin 5 baris bayangan (skeleton)
  for (var i = 0; i < 5; i++) {
    html += '<tr class="rt-row border-b border-slate-800 pointer-events-none">';
    for (var j = 0; j < cols; j++) {
      // Variasi panjang blok agar terlihat natural
      var widths = ['w-full', 'w-3/4', 'w-5/6', 'w-2/3', 'w-1/2'];
      var w = widths[Math.floor(Math.random() * widths.length)];
      html +=
        '<td class="p-4"><div class="h-4 bg-slate-700/60 rounded animate-pulse ' +
        w +
        '"></div></td>';
    }
    html += '</tr>';
  }
  tb.innerHTML = html;
}

export function jalankanSemuaSkeleton() {
  // Publik
  if (document.getElementById('public-table-body')) setSkeletonLoading('public-table-body', 5);
  // Admin
  if (isAdmin) {
    if (document.getElementById('admin-table-body')) setSkeletonLoading('admin-table-body', 5);
    if (document.getElementById('admin-dbjob-body')) setSkeletonLoading('admin-dbjob-body', 6);
    if (document.getElementById('admin-kandidat-body'))
      setSkeletonLoading('admin-kandidat-body', 6);
    if (document.getElementById('admin-jadwal-body')) setSkeletonLoading('admin-jadwal-body', 5);
    if (document.getElementById('admin-mail-body')) setSkeletonLoading('admin-mail-body', 8);
  }
  // Kandidat (Riwayat)
  var kRiwayat = document.getElementById('k-dash-riwayat');
  if (isKandidat && kRiwayat) {
    kRiwayat.innerHTML =
      '<div class="p-3.5 rounded-xl border border-slate-700/50 bg-black/40 mb-2 animate-pulse"><div class="h-4 bg-slate-700/60 rounded w-1/2 mb-2"></div><div class="h-3 bg-slate-700/60 rounded w-1/3"></div></div>' +
      '<div class="p-3.5 rounded-xl border border-slate-700/50 bg-black/40 animate-pulse"><div class="h-4 bg-slate-700/60 rounded w-2/3 mb-2"></div><div class="h-3 bg-slate-700/60 rounded w-1/4"></div></div>';
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file
// (engine/init.js window.jalankanSemuaSkeleton).
registerSeamAliases({
  jalankanSemuaSkeleton,
});
