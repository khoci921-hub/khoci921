import { ALL_SCHEDULES, limitJad } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// js/admin_ops/{schedule,candidates,sysconfig,loading,migration,drive}.js.
// ==========================================
// JADWAL & AGENDA — status waktu, agenda dashboard, tabel jadwal admin
// ==========================================
// === STATUS WARNA & PENANDA WAKTU JADWAL ===
export function getStatusWaktu(waktuStr) {
  if (!waktuStr || waktuStr === '-')
    return { text: '-', color: 'text-slate-400', bg: 'bg-slate-800' };
  let t = new Date(waktuStr.replace(' ', 'T'));
  // @ts-expect-error JS→TS migration
  if (isNaN(t)) return { text: waktuStr, color: 'text-slate-400', bg: 'bg-slate-800' };

  let now = new Date();
  // @ts-expect-error JS→TS migration
  let diff = t - now;
  let diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
  let diffHours = diff / (1000 * 60 * 60);

  if (diff < 0 && diffHours > -24)
    return { text: 'ONGOING', color: 'text-white', bg: 'bg-emerald-600 animate-pulse' };
  if (diff < 0) return { text: 'SELESAI', color: 'text-slate-400', bg: 'bg-slate-800' };
  if (diffHours <= 1.5)
    return { text: 'SEGERA', color: 'text-white', bg: 'bg-red-600 animate-pulse' };
  if (diffDays === 0 || diffDays === 1)
    return { text: 'HARI INI', color: 'text-amber-900', bg: 'bg-amber-400' };
  if (diffDays === 2) return { text: 'BESOK (H-1)', color: 'text-sky-900', bg: 'bg-sky-400' };

  return { text: `H-${diffDays - 1}`, color: 'text-purple-900', bg: 'bg-purple-400' };
}

export function renderDashboardAgenda() {
  var list = document.getElementById('dash-agenda-list');
  if (!list) return;
  var upcoming = ALL_SCHEDULES.filter((s) => {
    // @ts-expect-error JS→TS migration
    let diff = new Date(s.waktu.replace(' ', 'T')) - new Date();
    return !isNaN(diff) && diff > -86400000;
  })
    // @ts-expect-error JS→TS migration
    .sort((a, b) => new Date(a.waktu.replace(' ', 'T')) - new Date(b.waktu.replace(' ', 'T')))
    .slice(0, 5);

  var html = '';
  upcoming.forEach((j) => {
    var s = getStatusWaktu(j.waktu);
    html += `<div class="bg-black/40 border border-slate-700 p-3 rounded-xl flex justify-between items-center hover:bg-white/5 transition">
                        <div>
                            <p class="text-xs font-bold text-white">${window.esc(j.namaAgenda)} <span class="px-1.5 py-0.5 rounded text-[8px] font-bold ml-1 ${s.bg} ${s.color}">${window.esc(s.text)}</span></p>
                            <p class="text-[10px] text-amber-400 mt-0.5"><i class="fas fa-clock mr-1"></i> ${window.esc(j.waktu)} <span class="mx-1">|</span> <i class="fas fa-user mr-1"></i> ${window.esc(j.kandidat)}</p>
                        </div>
                        <a href="${window.esc(j.link !== '-' ? j.link : '#')}" target="_blank" aria-label="${window.tr('ui.open_link')}" class="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-full transition shadow"><i class="fas fa-video"></i></a>
                     </div>`;
  });
  if (upcoming.length === 0)
    html =
      '<div class="text-center text-slate-500 py-6 text-xs font-bold border border-dashed border-slate-700 rounded-xl bg-black/20">' +
      window.tr('ui.agenda_empty') +
      '</div>';
  list.innerHTML = html;
}

export function renderJadwal() {
  var tb = document.getElementById('admin-jadwal-body');
  if (!tb) return;
  var html = '';
  for (var i = 0; i < Math.min(ALL_SCHEDULES.length, limitJad); i++) {
    var j = ALL_SCHEDULES[i];
    var s = getStatusWaktu(j.waktu);
    var badgeWaktu = `<span class="px-2 py-0.5 rounded text-[9px] font-bold ml-2 ${s.bg} ${s.color}">${window.esc(s.text)}</span>`;

    html += `<tr class="rt-row border-b border-slate-800 hover:bg-white/5">
                <td data-label="ID Jadwal" class="p-4 font-mono text-amber-300 font-bold">${window.esc(j.idJadwal)}</td>
                <td data-label="Agenda" class="p-4 font-bold text-white">${window.esc(j.namaAgenda)} ${badgeWaktu}</td>
                <td data-label="Job / Waktu" class="rt-full p-4 text-xs font-bold text-sky-300">${window.esc(j.idLoker)}<br><span class="font-normal text-amber-100">${window.esc(j.waktu)}</span></td>
                <td data-label="Lokasi / Link" class="p-4 text-xs"><a href="${window.esc(j.link)}" target="_blank" class="link-chip"><i class="fas fa-video mr-1"></i> Link Zoom</a></td>
                <td data-label="Aksi" class="p-4 text-center"><button onclick="prosesHapusJadwal('${window.escJs(j.idJadwal)}')" aria-label="${window.tr('table.delete')}" class="px-3 py-1.5 bg-red-600 text-white rounded font-bold text-[10px]"><i class="fas fa-trash"></i></button></td>
                </tr>`;
  }
  if (ALL_SCHEDULES.length > limitJad) {
    html +=
      '<tr><td colspan="5" class="p-4 text-center"><button onclick="window.limitJad+=10; renderJadwal();" class="text-xs text-amber-400 font-bold">' +
      window.tr('form.txt_lebih_banyak') +
      '</button></td></tr>';
  }
  tb.innerHTML = html;
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (render/admin.js window.renderJadwal /
// window.renderDashboardAgenda, api/wa.js window.renderJadwal, tombol
// "limitJad+=10; renderJadwal();").
registerSeamAliases({
  renderDashboardAgenda,
  renderJadwal,
});
