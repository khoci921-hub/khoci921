import { tr } from '../../i18n.ts';
import { ALL_JOBS, CURRENT_THEME, currentPublicFilter, limitPub } from '../init/state.ts';
import { renderAdmin } from './admin.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// 7. FUNGSI RENDER — DOMAIN PUBLIK (index.html)
// ==========================================
// js/render/{public,admin,candidate,share,mail}.js (global scope TETAP).
// File ini: filter & tabel lowongan publik (Semua/Buka/Urgent/Tutup) + filter
// berubah.

export function filterPublicData(s) {
  window.currentPublicFilter = s;
  window.limitPub = 10;
  renderPublicFiltered();
}

// Filter status publik (Semua/Buka/Urgent/Tutup) dengan hitungan per status
// + state aktif yang kontras di bar terang (Sakura) maupun gelap (Tokyo).
export function renderPublicFilterUI() {
  var light = CURRENT_THEME === 'SAKURA';
  var defs = {
    ALL: {
      key: 'public.all',
      icon: 'fa-th-large',
      active: 'bg-slate-700 hover:bg-slate-600 text-white',
    },
    OPEN: {
      key: 'public.open',
      icon: 'fa-door-open',
      active: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    },
    URGENT: {
      key: 'public.urgent',
      icon: 'fa-bolt',
      active: 'bg-amber-500 hover:bg-amber-400 text-white',
    },
    CLOSE: {
      key: 'public.close',
      icon: 'fa-door-closed',
      active: 'bg-red-600 hover:bg-red-500 text-white',
    },
  };
  var count = function (st) {
    if (st === 'ALL') return ALL_JOBS.length;
    return ALL_JOBS.filter(function (j) {
      return String(j.status || '')
        .toUpperCase()
        .includes(st);
    }).length;
  };
  var baseInactive = light
    ? 'bg-slate-100 hover:bg-slate-200 text-stone-700'
    : 'bg-slate-700 hover:bg-slate-600 text-slate-200';
  ['ALL', 'OPEN', 'URGENT', 'CLOSE'].forEach(function (st) {
    var btn = document.getElementById('public-f-' + st);
    if (!btn) return;
    var active = currentPublicFilter === st;
    btn.className =
      'px-4 py-2 rounded-lg text-xs font-bold shadow-md transition ' +
      (active ? defs[st].active : baseInactive);
    btn.innerHTML =
      '<i class="fas ' +
      defs[st].icon +
      ' mr-1"></i> ' +
      tr(defs[st].key) +
      ' <span class="px-1.5 py-0.5 rounded-full text-[9px] ml-0.5 font-black ' +
      (active
        ? 'bg-white/30 text-white'
        : light
          ? 'bg-slate-200 text-stone-700'
          : 'bg-slate-900 text-slate-200') +
      '">' +
      count(st) +
      '</span>';
  });
}

export function renderPublicFiltered() {
  var tb = document.getElementById('public-table-body');
  if (!tb) return;
  renderPublicFilterUI();
  var html = '';
  var arr = ALL_JOBS;
  if (currentPublicFilter !== 'ALL') {
    arr = ALL_JOBS.filter((j) => j.status.includes(currentPublicFilter));
  }

  var sourceArray = [...arr];
  sourceArray.sort(function (a, b) {
    var aOpen = (a.status || '').toUpperCase().includes('OPEN') ? 1 : 0;
    var bOpen = (b.status || '').toUpperCase().includes('OPEN') ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;

    var timeA = a.createdAt
      ? new Date(a.createdAt).getTime()
      : parseInt((a.code || '').replace(/\D/g, '')) || 0;
    var timeB = b.createdAt
      ? new Date(b.createdAt).getTime()
      : parseInt((b.code || '').replace(/\D/g, '')) || 0;
    return timeB - timeA;
  });

  for (var i = 0; i < Math.min(sourceArray.length, limitPub); i++) {
    var j = sourceArray[i];

    let statusKey = j.status.toLowerCase().replace(/[^a-z0-9]/g, '');
    let translatedStatus = tr('status.' + statusKey);
    if (translatedStatus === 'status.' + statusKey) translatedStatus = j.status;

    // FIX: tombol Lamar ikut tertutup kalau tahapan job sudah berjalan
    // (CHECK KAIWA dst) — bukan hanya dari kolom status CLOSE.
    var tutupLamar = window.jobTutupUntukLamar(j);
    var btnLamar = tutupLamar
      ? '<button disabled class="w-full sm:w-auto px-4 py-2.5 bg-slate-600 rounded-lg text-white text-[10px] font-bold opacity-50 cursor-not-allowed shadow-inner border border-slate-500">' +
        tr('button.closed') +
        '</button>'
      : '<button onclick="lamarJob(\'' +
        window.escJs(j.code) +
        "', '" +
        window.escJs(j.kategori) +
        "', '" +
        window.escJs(j.dokumenShare || '') +
        '\')" class="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-[0_4px_15px_rgba(5,150,105,0.4)] transition text-[11px] font-bold border border-emerald-500/50"><i class="fas fa-paper-plane mr-1"></i> ' +
        tr('button.apply') +
        '</button>';

    var directUrl = window.getDirectDownloadUrl(j.templateCv);
    var btnTemplate = directUrl
      ? '<a href="' +
        directUrl +
        '" target="_blank" download class="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-[0_4px_15px_rgba(2,132,199,0.4)] transition text-[10px] font-bold border border-sky-500/50"><i class="fas fa-download mr-1"></i> ' +
        tr('button.format') +
        '</a>'
      : '';

    var actionBtns = '<div class="flex flex-col xl:flex-row gap-2 w-full justify-center">';
    actionBtns +=
      '<button onclick="bukaDetailLoker(\'' +
      window.escJs(j.code) +
      '\')" class="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-[0_4px_15px_rgba(245,158,11,0.4)] transition text-[10px] font-black border border-amber-500/50" title="' +
      tr('button.detail') +
      '"><i class="fas fa-eye mr-1"></i> ' +
      tr('button.detail') +
      '</button>';
    if (btnTemplate) actionBtns += btnTemplate;
    actionBtns += btnLamar;
    actionBtns += '</div>';

    let ketHtml =
      j.keterangan && j.keterangan !== '-'
        ? '<div class="mt-2 pt-2 border-t border-slate-700/50 text-[10px] ' +
          (CURRENT_THEME === 'SAKURA' ? 'text-amber-700' : 'text-amber-300/90') +
          ' leading-relaxed"><i class="fas fa-info-circle mr-1"></i> ' +
          window.esc(j.keterangan) +
          '</div>'
        : '';

    let gText = (j.gender || '').toUpperCase();
    let gLabel = window.trOption(j.gender);
    // Badge gender ikut theme: di SAKURA (light) pakai latar terang + teks gelap.
    let light = CURRENT_THEME === 'SAKURA';
    let genderBadge = '';
    if (gText.includes('PRIA') || gText.includes('LAKI')) {
      genderBadge =
        '<span class="px-2 py-0.5 ' +
        (light
          ? 'bg-blue-100 text-blue-700 border-blue-300'
          : 'bg-blue-900/50 text-blue-300 border-blue-500/50') +
        ' rounded text-[10px] font-bold shadow-sm whitespace-nowrap"><i class="fas fa-mars mr-1"></i> ' +
        gLabel +
        '</span>';
    } else if (gText.includes('WANITA') || gText.includes('PEREMPUAN')) {
      genderBadge =
        '<span class="px-2 py-0.5 ' +
        (light
          ? 'bg-pink-100 text-pink-700 border-pink-300'
          : 'bg-pink-900/50 text-pink-300 border-pink-500/50') +
        ' rounded text-[10px] font-bold shadow-sm whitespace-nowrap"><i class="fas fa-venus mr-1"></i> ' +
        gLabel +
        '</span>';
    } else {
      genderBadge =
        '<span class="px-2 py-0.5 ' +
        (light
          ? 'bg-purple-100 text-purple-700 border-purple-300'
          : 'bg-purple-900/50 text-purple-300 border-purple-500/50') +
        ' rounded text-[10px] font-bold shadow-sm whitespace-nowrap"><i class="fas fa-venus-mars mr-1"></i> ' +
        (gLabel || '-') +
        '</span>';
    }

    let pamfletHtml = '';
    if (j.pamflet && j.pamflet !== '-' && j.pamflet.length > 5) {
      // Pamflet di Supabase Storage. Thumbnail versi kecil + lazy;
      // gambar penuh hanya diunduh saat diklik zoom (bukaPamflet).
      let thumbUrl = window.thumbnailUrl(j.pamflet, 200);
      let fullUrl = j.pamflet;
      pamfletHtml =
        '<img src="' +
        window.esc(thumbUrl) +
        '" loading="lazy" decoding="async" onclick="bukaPamflet(\'' +
        window.escJs(fullUrl) +
        '\')" class="w-16 h-24 sm:w-20 sm:h-28 object-cover rounded-lg border ' +
        (light ? 'border-rose-200' : 'border-slate-600') +
        ' shadow-md cursor-pointer hover:opacity-80 hover:scale-105 transition-all flex-shrink-0" title="' +
        tr('ui.click_zoom') +
        '" alt="Pamflet">';
    }

    // Baris tabel ikut theme: SAKURA = wrap terang + teks gelap (bukan
    // putih), TOKYO = wrap gelap + teks terang seperti sebelumnya.
    let textTitle = light ? 'text-stone-800' : 'text-white';
    let textSub = light ? 'text-stone-600' : 'text-slate-300';
    let ketText = 'text-amber-300/90';
    let rowHover = light ? 'hover:bg-rose-900/5' : 'hover:bg-black/10';

    html +=
      '<tr class="rt-row border-b ' +
      (window.THEMES[CURRENT_THEME] ? window.THEMES[CURRENT_THEME].border : 'border-slate-800') +
      ' ' +
      rowHover +
      ' transition">' +
      '<td data-label="' +
      tr('table.code') +
      '" class="p-4 font-mono text-sm text-center font-bold align-top ' +
      (light ? 'text-sky-600' : 'text-sky-400') +
      '">' +
      window.esc(j.code) +
      '</td>' +
      '<td data-label="' +
      tr('table.job') +
      '" class="rt-full p-4 align-top whitespace-normal min-w-[250px]">' +
      '<div class="flex items-start gap-4">' +
      pamfletHtml +
      '<div class="flex flex-col pt-1">' +
      '<span class="font-bold text-base ' +
      textTitle +
      ' leading-tight">' +
      window.esc(j.pekerjaan) +
      '</span>' +
      '<div class="flex flex-wrap items-center gap-2 mt-2"><span class="text-[11px] ' +
      textSub +
      ' font-normal"><i class="fas fa-map-marker-alt mr-1 text-red-400"></i> ' +
      window.esc(window.trOption(j.lokasi)) +
      '</span>' +
      genderBadge +
      '</div>' +
      '</div>' +
      '</div>' +
      '</td>' +
      '<td data-label="' +
      tr('table.status') +
      '" class="p-4 text-center align-top">' +
      window.badgeTahapanDb(j.status) +
      '</td>' +
      '<td data-label="' +
      tr('table.req') +
      '" class="rt-full p-4 text-xs ' +
      textSub +
      ' whitespace-normal min-w-[250px] max-w-sm leading-relaxed align-top">' +
      String(j.syarat || '')
        .split(',')
        .map(function (s) {
          return window.esc(window.trOption(s.trim()));
        })
        .join(', ') +
      ketHtml +
      '</td>' +
      '<td data-label="' +
      tr('table.action') +
      '" class="rt-full p-4 align-top w-48">' +
      actionBtns +
      '</td>' +
      '</tr>';
  }

  if (arr.length === 0) {
    html =
      '<tr><td colspan="5" class="p-10 text-center text-slate-500 font-bold">' +
      tr('public.empty') +
      '</td></tr>';
  } else if (arr.length > limitPub) {
    html +=
      '<tr><td colspan="5" class="p-5 text-center"><button onclick="window.limitPub+=10; renderPublicFiltered();" class="px-6 py-2.5 bg-slate-800 text-white rounded-full text-xs font-bold shadow-lg hover:bg-slate-700">' +
      tr('button.more') +
      ' <i class="fas fa-chevron-down ml-2"></i></button></td></tr>';
  }
  tb.innerHTML = html;
}

export function filterKelolaLoker() {
  var el = document.getElementById('search-kelola');
  var val = el ? el.value.toLowerCase() : '';
  var arr = ALL_JOBS.filter(function (db) {
    return db.code.toLowerCase().includes(val) || db.pekerjaan.toLowerCase().includes(val);
  });
  renderAdmin(arr);
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (filterPublicData, renderPublicFiltered, window.limitPub+=10;...).
registerSeamAliases({
  filterPublicData,
  renderPublicFiltered,
  filterKelolaLoker,
});
