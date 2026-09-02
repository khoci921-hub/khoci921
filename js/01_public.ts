import { ALL_JOBS, ASSETS, CURRENT_THEME, isAdmin } from './init/state.ts';
import { renderPublicFilterUI, renderPublicFiltered } from './render/public.ts';
import { renderAdminFull } from './render/admin.ts';
import { renderSysConfig } from './admin_ops/sysconfig.ts';
import { registerSeamAliases } from './core/bridge.ts';
import { esc } from '../api-client.ts';
import { ensureJpLocale } from '../i18n/core.js';
// 1. LANGUAGE ENGINE V1.0 (LOCK)
// ==========================================
// CURRENT_LANG is now in src/i18n.js

// LANG dictionary is now in src/i18n.js

// ------------------------------------------------------------
// TAB PUBLIK (dari View_Public.html)
// ------------------------------------------------------------
// ESM (Fase 3 langkah 12): modul ES — alias window.* di bridge bawah utk HTML
// onclick (switchPublicTab/setLanguage), render/public.js + admin_modal/job.js
// (bukaDetailLoker/jobTutupUntukLamar), engine/api/i18n (renderLanguage),
// 13_rincian_builder (parseRincianBiaya). State & helper lain via window.*
// eksplisit (CURRENT_LANG accessor i18n, tr, trOption, esc, dll).

// Fungsi pindah tab langsung ditanam di sini agar tidak perlu sentuh Script.html (Anti Bentrok)
export function switchPublicTab(tab) {
  var secLoker = document.getElementById('public-loker-section');
  var secLayanan = document.getElementById('public-layanan-section');
  var btnLoker = document.getElementById('tab-pub-loker');
  var btnLayanan = document.getElementById('tab-pub-layanan');

  var light = typeof CURRENT_THEME !== 'undefined' && CURRENT_THEME === 'SAKURA';
  var inactive =
    'px-6 py-3 rounded-full text-sm font-bold transition-colors bg-transparent ' +
    (light
      ? 'text-stone-600 hover:bg-rose-900/10 hover:text-stone-900'
      : 'text-slate-400 hover:bg-white/10 hover:text-white');
  var active =
    'px-6 py-3 rounded-full text-sm font-bold transition-colors bg-sky-600 text-white shadow-md';

  if (tab === 'loker') {
    secLoker.classList.remove('hidden');
    secLayanan.classList.add('hidden');
    btnLoker.className = active;
    btnLayanan.className = inactive;
  } else {
    secLoker.classList.add('hidden');
    secLayanan.classList.remove('hidden');
    btnLayanan.className = active;
    btnLoker.className = inactive;
  }
}

// ------------------------------------------------------------
// LOGIKA UTAMA APLIKASI (dari Script.html, google.script.run
// sudah diganti callAPI di semua 45 titik pemanggilan)
// ------------------------------------------------------------

// CURRENT_LANG & LANG dictionary + tr() sudah didefinisikan di i18n.js
// yang dimuat lebih awal — tr() TIDAK dideklarasikan ulang di sini (dulu
// ada duplikat; Fase 3 konversi ESM butuh nol kolisi global lintas file).
// i18n.js: function tr(path) { LANG[CURRENT_LANG] lookup + fallback path }

export function renderLanguage() {
  // Header (desktop) + menu hamburger (mobile) — keduanya update.
  ['lang-current', 'lang-current-menu'].forEach((id) => {
    const langCurrent = document.getElementById(id);
    if (langCurrent) langCurrent.textContent = window.CURRENT_LANG === 'jp' ? 'JP' : 'ID';
  });

  document.querySelectorAll('[data-lang]').forEach((el) => {
    const key = el.dataset.lang;
    const text = window.tr(key);
    if (text !== key) {
      // Pertahankan penanda versi (asj-ver-badge) yang ditempel pwa.js ke
      // [data-lang="footer.copyright"] — innerHTML pengganti bahasa akan
      // menghapusnya (chip versi hilang dari footer, 2026-08-18).
      const badge = el.querySelector('.asj-ver-badge');
      el.innerHTML = text;
      if (badge) el.appendChild(badge);
    }
  });

  document.querySelectorAll('[data-lang-placeholder]').forEach((el) => {
    const key = el.dataset.langPlaceholder;
    const text = window.tr(key);
    if (text !== key) el.placeholder = text;
  });

  document.querySelectorAll('[data-lang-title]').forEach((el) => {
    const key = el.dataset.langTitle;
    const text = window.tr(key);
    if (text !== key) el.title = text;
  });

  // aria-label untuk tombol icon-only (close X, copy, send, dll) —
  // label AT ikut bahasa (ID/JP), sama seperti data-lang-title.
  document.querySelectorAll('[data-lang-aria]').forEach((el) => {
    const key = el.dataset.langAria;
    const text = window.tr(key);
    if (text !== key) el.setAttribute('aria-label', text);
  });
}

export async function setLanguage(lang) {
  // Ensure JP locale is loaded before switching to JP (fix: raw keys showing)
  if (lang === 'jp') {
    await ensureJpLocale();
  }
  if (!window.LANG[lang]) return;
  // FIX Fase 3 langkah 12: CURRENT_LANG kini accessor bridge di i18n.js —
  // tulis via window.* supaya binding modul i18n ikut berubah (sebelumnya
  // hanya window.CURRENT_LANG yang berubah → tr() baca bahasa LAMA).
  window.CURRENT_LANG = lang;
  localStorage.setItem('asj_lang', lang);
  renderLanguage();
  // Re-render komponen yang punya teks dinamis (dibuat via JS, bukan data-lang)
  if (
    document.getElementById('page-public') &&
    !document.getElementById('page-public').classList.contains('hidden')
  ) {
    if (typeof renderPublicFilterUI === 'function') renderPublicFilterUI();
    if (typeof renderPublicFiltered === 'function') renderPublicFiltered();
  }
  // Re-render tabel admin jika sedang mode admin
  if (typeof isAdmin !== 'undefined' && isAdmin && typeof renderAdminFull === 'function') {
    renderAdminFull();
  }
  // Re-render chip Pengaturan Sistem (label dropdown sesuai bahasa)
  if (typeof renderSysConfig === 'function' && document.getElementById('config-container')) {
    renderSysConfig();
  }
  // Re-populate dropdown/checkbox form yang nilainya dari sys config
  // (label ikut bahasa; value tetap ID asli).
  if (typeof window.rePopulateDropdowns === 'function') window.rePopulateDropdowns();
  var langMenu = document.getElementById('language-menu');
  if (langMenu) langMenu.classList.add('hidden');
}

// ==========================================
// POPUP DETAIL LOKER (Tab Publik) — pamflet + rincian biaya + syarat
// dalam 1 popup, tanpa pindah halaman.
// ==========================================
export function parseRincianBiaya(text) {
  var out = { total: '', sections: [] };
  if (!text || typeof text !== 'string') return out;
  var current = null;
  var lines = text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = (lines[i] || '').trim();
    if (!line) continue;
    var mt = line.match(/^TOTAL\s*BIAYA\s*[:=]?\s*(.+)$/i);
    if (mt) {
      out.total = mt[1].trim();
      continue;
    }
    var mh = line.match(/^(TAHAPAN\s*PEMBAYARAN|INCLUDE|EXCLUDE|BENEFIT|PERSYARATAN|CATATAN)\b/i);
    if (mh) {
      var key = mh[1].toUpperCase().replace(/\s+/g, '_');
      if (key === 'TAHAPAN_PEMBAYARAN') key = 'TAHAPAN';
      current = { type: key, items: [] };
      out.sections.push(current);
      continue;
    }
    var ms = line.match(/^\s*(\d+)[.)]\s*(.+?)\s*[:=]\s*(.+)$/);
    if (ms) {
      if (!current || current.type !== 'TAHAPAN') {
        current = { type: 'TAHAPAN', items: [] };
        out.sections.push(current);
      }
      current.items.push({ nomor: ms[1], nama: ms[2].trim(), nominal: ms[3].trim() });
      continue;
    }
    var mb = line.match(/^\s*([•▪‣\-*])\s*(.*)$/);
    var content = mb ? mb[2].trim() : line;
    if (!current) {
      current = { type: 'INFO', items: [] };
      out.sections.push(current);
    }
    current.items.push(content);
  }
  return out;
}

export function renderRincianSections(sections) {
  if (!sections || !sections.length) return '';
  // Kelompokkan section: TAHAPAN full-width, lalu INCLUDE+EXCLUDE dan
  // BENEFIT+PERSYARATAN saling berdampingan (grid 2 kolom) supaya tampilan
  // popup Detail proporsional & tidak timpang (kiri-kanan seimbang).
  var byType: Record<string, any> = {};
  for (var i = 0; i < sections.length; i++) {
    var t = sections[i].type;
    if (t === 'TAHAPAN_PEMBAYARAN') t = 'TAHAPAN';
    if (!byType[t]) byType[t] = [];
    byType[t].push(sections[i]);
  }
  var html = '';

  function itemsOf(s) {
    if (!s) return [];
    if (Array.isArray(s)) {
      var out = [];
      for (var k = 0; k < s.length; k++)
        if (s[k] && s[k].items) out = out.concat(s[k].items.filter(Boolean));
      return out;
    }
    return (s.items || []).filter(Boolean);
  }
  function esc(x) {
    return String(x == null ? '' : x)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 1. TAHAPAN (full width) — nomor langkah 1,2,3... dengan garis penghubung
  var tahap = byType.TAHAPAN;
  if (tahap) {
    var steps = [].concat(Array.isArray(tahap) ? tahap : [tahap]);
    html +=
      '<div class="mb-6"><h4 class="text-xs font-black text-white uppercase tracking-widest mb-4"><i class="fas fa-stairs mr-1.5 text-amber-400"></i> ' +
      window.tr('ui.payment_stage') +
      '</h4><div class="space-y-0">';
    var stepAll = [];
    for (var si = 0; si < steps.length; si++) {
      var ss = steps[si];
      if (!ss || !ss.items) continue;
      for (var t2 = 0; t2 < ss.items.length; t2++) {
        var it = ss.items[t2];
        stepAll.push(typeof it === 'object' ? it : { nama: it, nominal: '' });
      }
    }
    for (var t3 = 0; t3 < stepAll.length; t3++) {
      var st = stepAll[t3];
      var stName = st.nama || '';
      var stNom = st.nominal || '';
      var isLast = t3 === stepAll.length - 1;
      html +=
        '<div class="flex gap-3 relative pb-5' +
        (isLast ? ' last:pb-0' : '') +
        '">' +
        '<div class="flex flex-col items-center"><div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500/20 border border-emerald-400/60 text-emerald-400 text-xs font-black">' +
        (t3 + 1) +
        '</div>' +
        (!isLast ? '<div class="w-px flex-1 bg-emerald-500/25 my-1"></div>' : '') +
        '</div>' +
        '<div class="flex-1 pt-1.5"><div class="flex flex-wrap items-center justify-between gap-2"><p class="font-black text-white text-[13px] tracking-wide">' +
        esc(stName) +
        '</p>' +
        (stNom
          ? '<span class="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-black shadow">' +
            esc(stNom) +
            '</span>'
          : '') +
        '</div></div></div>';
    }
    html += '</div></div>';
  }

  // 2. INCLUDE + EXCLUDE — grid 2 kolom seimbang
  var inc = byType.INCLUDE,
    exc = byType.EXCLUDE;
  if (inc || exc) {
    html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">';
    if (inc) {
      var incList = itemsOf(inc);
      html +=
        '<div class="bg-emerald-900/15 border border-emerald-500/30 rounded-2xl p-4">' +
        '<h5 class="text-emerald-400 font-black text-[11px] uppercase tracking-widest mb-3"><i class="fas fa-check-circle mr-1"></i> ' +
        window.tr('ui.include') +
        '</h5>' +
        '<div class="flex flex-wrap gap-2">' +
        incList
          .map(function (x) {
            return (
              '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 text-emerald-300 border-emerald-500/40 rounded-full text-[10px] font-bold border">' +
              esc(x) +
              '</span>'
            );
          })
          .join('') +
        '</div></div>';
    }
    if (exc) {
      var excList = itemsOf(exc);
      html +=
        '<div class="bg-rose-900/15 border border-rose-500/30 rounded-2xl p-4">' +
        '<h5 class="text-rose-400 font-black text-[11px] uppercase tracking-widest mb-3"><i class="fas fa-times-circle mr-1"></i> ' +
        window.tr('ui.exclude') +
        '</h5>' +
        '<div class="flex flex-wrap gap-2">' +
        excList
          .map(function (x) {
            return (
              '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/40 text-rose-300 border-rose-500/40 rounded-full text-[10px] font-bold border">' +
              esc(x) +
              '</span>'
            );
          })
          .join('') +
        '</div></div>';
    }
    html += '</div>';
  }

  // 3. BENEFIT + PERSYARATAN — grid 2 kolom seimbang
  var ben = byType.BENEFIT,
    per = byType.PERSYARATAN;
  if (ben || per) {
    html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">';
    if (ben) {
      html +=
        '<div class="bg-amber-900/15 border border-amber-500/30 rounded-2xl p-4"><h4 class="text-xs font-black text-amber-400 uppercase tracking-widest mb-3"><i class="fas fa-star mr-1.5"></i> ' +
        window.tr('ui.benefit') +
        '</h4><ul class="space-y-2">' +
        itemsOf(ben)
          .map(function (x) {
            return (
              '<li class="flex items-start text-xs text-slate-300"><i class="fas fa-circle-check text-amber-500 mt-0.5 mr-2 text-[10px]"></i>' +
              esc(x) +
              '</li>'
            );
          })
          .join('') +
        '</ul></div>';
    }
    if (per) {
      html +=
        '<div class="bg-slate-900/60 border border-slate-700 rounded-2xl p-4"><h4 class="text-xs font-black text-sky-400 uppercase tracking-widest mb-3"><i class="fas fa-clipboard-check mr-1.5"></i> ' +
        window.tr('ui.requirements') +
        '</h4><ul class="space-y-2">' +
        itemsOf(per)
          .map(function (x) {
            return (
              '<li class="flex items-start text-xs text-slate-300"><i class="fas fa-check text-emerald-500 mt-0.5 mr-2 text-[10px]"></i>' +
              esc(x) +
              '</li>'
            );
          })
          .join('') +
        '</ul></div>';
    }
    html += '</div>';
  }

  // 4. CATATAN & INFO — full width
  var cat = byType.CATATAN;
  if (cat) {
    html +=
      '<div class="bg-sky-900/15 border border-sky-500/30 rounded-2xl p-4 mb-6"><h4 class="text-xs font-black text-sky-400 uppercase tracking-widest mb-2"><i class="fas fa-info-circle mr-1.5"></i> ' +
      window.tr('ui.note') +
      '</h4><p class="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">' +
      itemsOf(cat).map(esc).join('\n') +
      '</p></div>';
  }
  var info = byType.INFO;
  if (info) {
    html +=
      '<div class="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 mb-6"><h4 class="text-xs font-black text-slate-300 uppercase tracking-widest mb-2"><i class="fas fa-info mr-1.5"></i> ' +
      window.tr('ui.info_lain') +
      '</h4><p class="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">' +
      itemsOf(info).map(esc).join('\n') +
      '</p></div>';
  }
  return html;
}

export function lokerGenderBadge(g) {
  var gText = String(g || '').toUpperCase();
  var gLabel = window.trOption(g);
  if (gText.includes('PRIA') || gText.includes('LAKI')) {
    return (
      '<span class="px-2.5 py-1 bg-blue-900/50 text-blue-300 border border-blue-500/50 rounded font-bold"><i class="fas fa-mars mr-1"></i> ' +
      gLabel +
      '</span>'
    );
  } else if (gText.includes('WANITA') || gText.includes('PEREMPUAN')) {
    return (
      '<span class="px-2.5 py-1 bg-pink-900/50 text-pink-300 border border-pink-500/50 rounded font-bold"><i class="fas fa-venus mr-1"></i> ' +
      gLabel +
      '</span>'
    );
  }
  return (
    '<span class="px-2.5 py-1 bg-purple-900/50 text-purple-300 border border-purple-500/50 rounded font-bold"><i class="fas fa-venus-mars mr-1"></i> ' +
    (gLabel || '-') +
    '</span>'
  );
}

// Job dianggap DITUTUP untuk lamaran bila status CLOSE ATAU tahapan seleksi
// sudah berjalan (CHECK KAIWA → MENDAN → … → FLIGHT). Aturan lapangan:
// begitu proses jalan, pendaftaran baru ditutup — tombol Lamar harus CLOSED
// walau kolom status belum diubah admin.
export function jobTutupUntukLamar(j) {
  if (!j) return true;
  if (String(j.status || '').includes('CLOSE')) return true;
  var t = String(j.tahapan || '')
    .toUpperCase()
    .trim();
  if (
    !t ||
    t === '-' ||
    t === 'LIST' ||
    t === 'LIST-CHECK' ||
    t === 'PENCARIAN' ||
    t === 'PENDAFTARAN' ||
    t === 'OPEN' ||
    t === 'DAFTAR' ||
    t === 'MENUNGGU' ||
    t === 'REVIEW'
  )
    return false;
  // Tahapan yang berarti seleksi/pendokumenan sudah berjalan → tutup lamar.
  return /KAIWA|MENDAN|MENSETSU|LOLOS|USER|MCU|PARPOR|PASPOR|PASPORT|KONTRAK|COE|SISKOP|E-?ID|VISA|FLIGHT|BERANGKAT|TERBANG|TIKET|NAITEI|PEMBERKASAN|MEDICAL|MEDIKAL/i.test(
    t,
  );
}

export function bukaDetailLoker(code) {
  var j = (ALL_JOBS || []).find(function (x) {
    return x.code === code;
  });
  if (!j) return;
  var modal = document.getElementById('modal-detail-loker');
  var content = document.getElementById('detail-loker-content');
  if (!modal || !content) return;

  var pamfletUrl = '';
  var thumbUrl = '';
  if (j.pamflet && j.pamflet !== '-' && j.pamflet.length > 5) {
    // Pamflet disimpan di Supabase Storage. Thumbnail (w-20 = ~80px):
    // versi kecil + lazy; full hanya saat zoom.
    thumbUrl = window.thumbnailUrl(j.pamflet, 200);
    pamfletUrl = j.pamflet;
  }

  var parsed = parseRincianBiaya(j.rincianBiaya || '');
  var total = j.totalBiaya || parsed.total || '';
  var stUp = (j.status || '').toUpperCase();
  var isOpen = stUp.indexOf('OPEN') >= 0 || stUp.indexOf('URGENT') >= 0;
  // Status loker publik: OPEN hijau, URGENT amber pulse, CLOSE merah.
  var statusLabel = window.esc(window.trOption(j.status));
  var statusBadge =
    stUp.indexOf('URGENT') >= 0
      ? '<span class="px-2.5 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black animate-pulse"><i class="fas fa-bolt mr-1"></i>' +
        statusLabel +
        '</span>'
      : isOpen
        ? '<span class="px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black"><i class="fas fa-door-open mr-1"></i>' +
          statusLabel +
          '</span>'
        : '<span class="px-2.5 py-1 bg-red-700/80 text-white rounded-full text-[10px] font-black"><i class="fas fa-door-closed mr-1"></i>' +
          statusLabel +
          '</span>';

  var html = '';
  html +=
    '<div class="flex items-start gap-4 mb-6">' +
    (pamfletUrl
      ? '<img src="' +
        window.esc(thumbUrl) +
        '" loading="lazy" decoding="async" onclick="window.bukaPamflet(\'' +
        window.escJs(pamfletUrl) +
        '\') " class="w-20 h-28 object-cover rounded-xl border border-slate-600 shadow-lg cursor-pointer hover:scale-105 transition flex-shrink-0" title="' +
        window.tr('ui.click_zoom') +
        '" alt="Pamflet">'
      : '') +
    '<div class="flex-1 min-w-0">' +
    '<div class="flex flex-wrap items-center gap-2">' +
    '<span class="text-sky-400 font-mono text-xs font-bold">' +
    window.esc(j.code) +
    '</span>' +
    statusBadge +
    (j.kuota && j.kuota !== '-'
      ? '<span class="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-600 rounded-full text-[9px] font-bold"><i class="fas fa-users mr-1"></i> ' +
        window.tr('ui.quota') +
        ': ' +
        window.esc(j.kuota) +
        '</span>'
      : '') +
    '</div>' +
    '<h3 class="text-xl md:text-2xl font-black text-white mt-1.5 leading-tight">' +
    window.esc(j.pekerjaan) +
    '</h3>' +
    '<div class="flex flex-wrap items-center gap-2 mt-3 text-[11px]">' +
    window.lokerGenderBadge(j.gender) +
    '<span class="px-2.5 py-1 bg-slate-800 text-slate-300 border border-slate-600 rounded font-bold"><i class="fas fa-map-marker-alt mr-1 text-red-400"></i> ' +
    window.esc(window.trOption(j.lokasi)) +
    '</span></div>' +
    (j.kategori
      ? '<div class="text-[10px] text-slate-500 mt-2"><i class="fas fa-tag mr-1 text-sky-500/70"></i> ' +
        window.esc(window.trOption(j.kategori)) +
        '</div>'
      : '') +
    '</div>' +
    '</div>';

  if (total) {
    html +=
      '<div class="bg-gradient-to-r from-emerald-900/40 to-sky-900/30 border border-emerald-500/40 rounded-2xl p-5 mb-6 text-center">' +
      '<p class="text-[10px] font-bold uppercase tracking-[4px] text-emerald-400 mb-1"><i class="fas fa-wallet mr-1"></i> ' +
      window.tr('ui.detail_total_title') +
      '</p>' +
      '<p class="text-4xl font-black text-white tracking-wide">' +
      total +
      '</p>' +
      '<p class="text-[10px] text-slate-400 mt-1">' +
      window.tr('ui.detail_total_sub') +
      '</p>' +
      '</div>';
  }

  html += renderRincianSections(parsed.sections);

  var syaratList =
    j.syarat && j.syarat !== '-'
      ? String(j.syarat)
          .split(',')
          .map(function (x) {
            return x.trim();
          })
          .filter(Boolean)
      : [];
  if (syaratList.length) {
    html +=
      '<div class="bg-slate-900/60 border border-slate-700 rounded-2xl p-5 mb-6">' +
      '<h4 class="text-xs font-black text-sky-400 uppercase tracking-widest mb-4"><i class="fas fa-clipboard-check mr-1.5"></i> ' +
      window.tr('ui.detail_syarat') +
      '</h4>' +
      '<ul class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">' +
      syaratList
        .map(function (s) {
          return (
            '<li class="flex items-start text-xs text-slate-300"><i class="fas fa-check text-emerald-500 mt-0.5 mr-2 text-[10px]"></i>' +
            window.esc(window.trOption(s)) +
            '</li>'
          );
        })
        .join('') +
      '</ul></div>';
  }

  if (j.keterangan && j.keterangan !== '-') {
    html +=
      '<div class="bg-sky-900/15 border border-sky-500/30 rounded-2xl p-5 mb-6">' +
      '<h4 class="text-xs font-black text-sky-400 uppercase tracking-widest mb-2"><i class="fas fa-info-circle mr-1.5"></i> ' +
      window.tr('ui.detail_keterangan') +
      '</h4>' +
      '<p class="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">' +
      window.esc(j.keterangan) +
      '</p></div>';
  }

  var waNum =
    ASSETS && ASSETS.SOCIAL && ASSETS.SOCIAL.whatsapp
      ? String(ASSETS.SOCIAL.whatsapp).replace(/\D/g, '')
      : '';
  var waMsg =
    'Halo Admin ASJ, saya tertarik lowongan ' +
    j.code +
    ' (' +
    j.pekerjaan +
    '). Mohon info lebih lanjut.';
  var directUrl = window.getDirectDownloadUrl(j.templateCv);
  var katEsc = window.escJs(j.kategori || '');
  var reqEsc = window.escJs(j.dokumenShare || '');
  var tutupLamar = window.jobTutupUntukLamar(j);
  var btnLamar = tutupLamar
    ? '<button disabled class="flex-1 px-5 py-3.5 bg-slate-600 text-white text-sm font-black text-center rounded-xl shadow-inner opacity-60 cursor-not-allowed"><i class="fas fa-door-closed mr-1.5"></i> ' +
      window.tr('button.closed') +
      '</button>'
    : '<button onclick="window.lamarJob(\'' +
      window.escJs(j.code) +
      "', '" +
      katEsc +
      "', '" +
      reqEsc +
      '\'); window.tutupDetailLoker();" class="flex-1 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black text-center rounded-xl shadow-[0_4px_15px_rgba(5,150,105,0.45)] transition"><i class="fas fa-paper-plane mr-1.5"></i> ' +
      window.tr('button.apply_now') +
      '</button>';
  html +=
    '<div class="flex flex-col sm:flex-row gap-3">' +
    (directUrl
      ? '<a href="' +
        window.esc(directUrl) +
        '" target="_blank" download class="flex-1 px-5 py-3.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold text-center rounded-xl shadow-[0_4px_15px_rgba(2,132,199,0.4)] transition"><i class="fas fa-download mr-1.5"></i> ' +
        window.tr('button.format') +
        '</a>'
      : '') +
    btnLamar +
    (waNum
      ? '<a href="https://wa.me/' +
        waNum +
        '?text=' +
        encodeURIComponent(waMsg) +
        '" target="_blank" class="flex-1 px-5 py-3.5 bg-[#25D366] hover:bg-[#1fbd5b] text-white text-sm font-bold text-center rounded-xl shadow-[0_4px_15px_rgba(37,211,102,0.4)] transition"><i class="fab fa-whatsapp mr-1.5"></i> ' +
        window.tr('button.chat_wa') +
        '</a>'
      : '') +
    '</div>';

  content.innerHTML = html;
  modal.classList.remove('hidden');
}

export function tutupDetailLoker() {
  var modal = document.getElementById('modal-detail-loker');
  if (modal) modal.classList.add('hidden');
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick. switchPublicTab/setLanguage → HTML onclick;
// renderLanguage → engine/init + api/candidates + i18n toggleFormLanguage;
// bukaDetailLoker → onclick string render/public.js; jobTutupUntukLamar →
// render/public.js + admin_modal/job.js; parseRincianBiaya →
// 13_rincian_builder (rbSeedFromText/rbSummaryFromData); tutupDetailLoker →
// onclick string di bukaDetailLoker sendiri (string dieval global).
registerSeamAliases({
  switchPublicTab,
  setLanguage,
  parseRincianBiaya,
  lokerGenderBadge,
  jobTutupUntukLamar,
  bukaDetailLoker,
  tutupDetailLoker,
});

// ==========================================
