import { tr } from '../../i18n.ts';
import { ASSETS } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// ==========================================
// DASHBOARD KANDIDAT — badge job, progres pemberkasan, progres profil
// ==========================================

// Logika Pemunculan Tombol Modal Pemberkasan
export function evaluasiTahapanKandidat(thpRaw) {
  if (!thpRaw) return;
  let thp = String(thpRaw).toUpperCase();
  let btnArea = document.getElementById('btn-pemberkasan-area');

  if (btnArea) btnArea.classList.add('hidden');

  let isTahap1 =
    /LOLOS|PEMBERKASAN|MCU|MEDICAL|MEDIKAL|PARPOR|PASPOR|PASPORT|MATCH|TERIMA|SIAP/i.test(thp);
  let isTahap2 = /TTD|KONTRAK|VISA|COE|KTKLN|SISKOP|FLIGHT|BERANGKAT|TERBANG|TIKET|E-ID/i.test(thp);

  // Jika masuk salah satu tahapan ini, tampilkan Tombol Sakti di Dashboard Kandidat
  if (isTahap1 || isTahap2) {
    if (btnArea) btnArea.classList.remove('hidden');
  }
}

// Badge job di dashboard kandidat: tampilkan SEMUA lamaran (mail) sebagai
// chip kode job + warna status; fallback ke id_loker_pilihan kalau kosong.
export function renderJobDilamar(myData) {
  var apps = (myData && myData.applications) || [];
  var loker = (myData && myData.idLoker) || '';
  // Filter: hanya tampilkan lamaran yang SUDAH di-approve/diproses admin.
  // Lamaran MENUNGGU (belum di-approve) tidak masuk list loker kandidat.
  var approvedApps = apps.filter(function (a) {
    var st = String((a && a.status) || 'MENUNGGU').toUpperCase();
    return st !== 'MENUNGGU';
  });
  if (!approvedApps.length && !loker) return '-';
  if (!approvedApps.length) return window.esc(loker);
  var chips = '';
  approvedApps.forEach(function (a) {
    if (!a || !a.code) return;
    var st = String(a.status || 'MENUNGGU').toUpperCase();
    var color =
      st === 'LULUS' || st === 'AKTIF'
        ? 'bg-emerald-900/70 text-emerald-300 border-emerald-600/70'
        : st === 'GAGAL' || st === 'REJECT' || st === 'DITOLAK'
          ? 'bg-red-900/70 text-red-300 border-red-600/70'
          : 'bg-sky-900/70 text-sky-300 border-sky-600/70';
    chips +=
      '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ' +
      color +
      '" title="' +
      window.esc(a.code) +
      ' — ' +
      window.esc(st) +
      '">' +
      window.esc(a.code) +
      '</span> ';
  });
  return chips;
}

// Ringkasan progres pemberkasan di dashboard kandidat: x/17 dokumen + status
// biodata KTKLN/VISA. Data berkas & bio di-populate backend (get-app-data).
export var BERKAS_17 = [
  ['kk', 'KK'],
  ['akte', 'AKTE'],
  ['sd', 'IJAZAH SD'],
  ['smp', 'IJAZAH SMP'],
  ['sma', 'IJAZAH SMA'],
  ['pasport', 'PASPORT'],
  ['mcu', 'MCU'],
  ['kontrak', 'KONTRAK KERJA'],
  ['cert', 'CERTIFICATE JAPAN'],
  ['ktp', 'KTP'],
  ['foto2', 'PAS FOTO STUDIO'],
  ['ijinortu', 'SURAT IJIN ORTU'],
  ['cpmi', 'PERNYATAAN CPMI'],
  ['kawin', 'STATUS PERKAWINAN'],
  ['sehat', 'SURAT SEHAT PUSKESMAS'],
  ['bpjs', 'BPJS KETENAGAKERJAAN'],
  ['psikotes', 'HASIL PSIKOTES'],
];
export var BIO_FIELDS_19 = [
  'email',
  'tmplahir',
  'tgllahir',
  'alamat',
  'ayah',
  'ttl_ayah',
  'ibu',
  'ttl_ibu',
  'pasport',
  'coe',
  'kotapasport',
  'tglpasport',
  'exppasport',
  'pt',
  'shacou',
  'telppt',
  'webpt',
  'alamatpt',
];

export function renderProgresPemberkasan(myData) {
  var berkas = (myData && myData.berkas) || {};
  var bio = (myData && myData.bio) || {};
  var done = 0;
  var listHtml = '';
  BERKAS_17.forEach(function (b) {
    var isOk = !!(berkas[b[0]] && berkas[b[0]] !== '-');
    if (isOk) done++;
    listHtml +=
      '<div class="flex items-center gap-1.5 text-[9px] font-bold ' +
      (isOk ? 'text-emerald-400' : 'text-slate-500') +
      '">' +
      '<i class="fas ' +
      (isOk ? 'fa-check-circle' : 'fa-circle') +
      ' text-[9px]"></i><span class="truncate">' +
      b[1] +
      '</span></div>';
  });
  var pct = Math.round((done / BERKAS_17.length) * 100);
  var bar = document.getElementById('prog-berkas-bar');
  var pctEl = document.getElementById('prog-berkas-persen');
  var txtEl = document.getElementById('prog-berkas-txt');
  var listEl = document.getElementById('prog-berkas-list');
  if (bar) bar.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (txtEl) txtEl.textContent = done + tr('ui.docs_count');
  if (listEl) listEl.innerHTML = listHtml;

  // Biodata: 18 field yang tersedia (19 di antaranya; pasport/coe dibagi jadi
  // 18 key unik). Hitung berapa yang terisi & tandai "Lengkap/Belum lengkap".
  var bioDone = 0;
  BIO_FIELDS_19.forEach(function (k) {
    if (bio[k] && String(bio[k]).trim() !== '' && String(bio[k]).trim() !== '-') bioDone++;
  });
  var bioFull = bioDone >= 16; // toleransi: sebagian besar terisi = lengkap
  var badge = document.getElementById('prog-biodata-badge');
  if (badge) {
    if (bioFull)
      badge.innerHTML =
        '<i class="fas fa-check-circle mr-0.5"></i> ' + tr('ui.biodata_complete') + '';
    else
      badge.innerHTML =
        '<i class="fas fa-exclamation-circle mr-0.5"></i> ' +
        tr('ui.biodata_partial') +
        bioDone +
        '/18';
    badge.className =
      'text-[9px] font-bold px-2 py-0.5 rounded-full ' +
      (bioFull ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300');
  }
}

export function kalkulasiProgress(myData) {
  let miniFields = [
    myData.nama,
    myData.wa,
    myData.gender,
    myData.usia,
    myData.tb,
    myData.bb,
    myData.pendidikan,
    myData.pasPhoto,
  ];
  let miniFilled = 0;
  miniFields.forEach((f) => {
    if (f && String(f).trim() !== '' && String(f).trim() !== '-') miniFilled++;
  });
  let progMini = Math.round((miniFilled / miniFields.length) * 100);

  let masterFields = [
    myData.email,
    myData.tempatLahir,
    myData.tglLahir,
    myData.alamat,
    myData.jftText,
    myData.sswText,
  ];
  let masterFilled = 0;
  masterFields.forEach((f) => {
    if (f && String(f).trim() !== '' && String(f).trim() !== '-') masterFilled++;
  });
  let progMaster = Math.round((masterFilled / masterFields.length) * 100);

  let elMiniBar = document.getElementById('prog-mini-bar');
  let elMiniTxt = document.getElementById('prog-mini-txt');
  if (elMiniBar) elMiniBar.style.width = progMini + '%';
  if (elMiniTxt) elMiniTxt.innerText = progMini + '%';

  let elMasterBar = document.getElementById('prog-master-bar');
  let elMasterTxt = document.getElementById('prog-master-txt');
  if (elMasterBar) elMasterBar.style.width = progMaster + '%';
  if (elMasterTxt) elMasterTxt.innerText = progMaster + '%';

  let isVip = (myData.catatanInt || '').includes('[VIP]');
  let badges = '<span class="inline-flex items-center gap-1.5 ml-3 align-middle">';

  badges +=
    '<i class="fas fa-medal text-orange-500 text-2xl md:text-3xl drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]" title="' +
    tr('ui.badge_bronze') +
    '"></i>';
  if (progMini === 100) {
    badges +=
      '<i class="fas fa-award text-slate-300 text-2xl md:text-3xl drop-shadow-[0_0_10px_rgba(203,213,225,0.8)]" title="' +
      tr('ui.badge_silver') +
      '"></i>';
  }
  if (progMaster === 100) {
    badges +=
      '<i class="fas fa-crown text-yellow-400 text-3xl md:text-4xl drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" title="' +
      tr('ui.badge_gold') +
      '"></i>';
  }
  if (isVip) {
    let logoSrc =
      ASSETS.LOGO ||
      'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/logo_asj.png';
    badges +=
      '<img src="' +
      window.esc(logoSrc) +
      '" class="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[0_0_15px_rgba(52,211,153,0.8)] rounded-full border border-emerald-500/50" title="' +
      tr('ui.badge_official') +
      '">';
  }

  // Cek Badge Kelas
  let catatanIntStr = myData.catatanInt || '';
  let kelasMatch = catatanIntStr.match(/\[KELAS\s*([A-Z0-9]+)\]/i);
  if (kelasMatch) {
    badges += `<span class="px-2 py-0.5 ml-1 bg-indigo-900/60 text-indigo-300 border border-indigo-500/50 rounded text-xs font-bold shadow-sm whitespace-nowrap align-middle"><i class="fas fa-users mr-1"></i>KELAS ${window.esc(kelasMatch[1].toUpperCase())}</span>`;
  }

  badges += '</span>';

  let namaHeader = document.getElementById('k-dash-nama');
  if (namaHeader) {
    namaHeader.innerHTML = tr('candidate.welcome') + ', ' + window.esc(myData.nama) + badges;
  }

  let progMsg = document.getElementById('prog-msg');
  if (progMsg) {
    if (isVip && progMaster === 100 && progMini === 100) {
      progMsg.innerHTML =
        '<span class="text-amber-400 font-black tracking-widest"><i class="fas fa-star mr-1"></i> ' +
        tr('ui.perfect_student') +
        ' <i class="fas fa-star ml-1"></i></span>';
    } else if (progMaster === 100 && progMini === 100) {
      progMsg.innerHTML =
        '<span class="text-yellow-400 font-bold">' + tr('ui.profile_100') + '</span>';
    } else if (progMini === 100) {
      progMsg.innerHTML =
        '<span class="text-slate-300 font-bold">' + tr('ui.profile_silver_next') + '</span>';
    } else {
      progMsg.innerHTML = '' + tr('ui.profile_incomplete') + '';
    }
  }
}

// Multi-Job Progress View — render SEMUA lamaran kandidat sebagai card detail.
// Setiap card menampilkan: kode job, status, tahapan, waktu lamaran.
// Uses window.esc/window.trOption (globals via bridge) for consistency with rest of codebase.
export function renderMultiJobProgress(myData) {
  var container = document.getElementById('k-dash-multi-job');
  if (!container) return;
  var apps = (myData && myData.applications) || [];
  if (apps.length === 0) {
    container.innerHTML =
      '<div class="text-xs text-slate-500 text-center py-4 border border-dashed border-slate-700/50 rounded-xl">' +
      tr('candidate.multi_job_empty') +
      '</div>';
    container.classList.remove('hidden');
    return;
  }
  var html =
    '<h3 class="text-sm font-black text-slate-300 mb-3 tracking-wide uppercase"><i class="fas fa-layer-group mr-2 text-emerald-400"></i>' +
    tr('candidate.multi_job_title') +
    ' <span class="text-slate-500 text-[10px]">(' +
    apps.length +
    ')</span></h3>';
  html += '<div class="space-y-2">';
  apps.forEach(function (a) {
    if (!a || !a.code) return;
    var st = String(a.status || 'MENUNGGU').toUpperCase();
    var cls =
      st === 'LULUS' || st === 'AKTIF'
        ? {
            box: 'bg-emerald-900/60 text-emerald-300 border-emerald-600/50',
            icon: 'fa-check-circle',
            txt: 'text-emerald-300',
          }
        : st === 'GAGAL' || st === 'REJECT' || st === 'DITOLAK'
          ? {
              box: 'bg-red-900/60 text-red-300 border-red-600/50',
              icon: 'fa-times-circle',
              txt: 'text-red-300',
            }
          : st === 'REVIEW' || st === 'REVIEW ADMIN'
            ? {
                box: 'bg-amber-900/60 text-amber-300 border-amber-600/50',
                icon: 'fa-eye',
                txt: 'text-amber-300',
              }
            : {
                box: 'bg-sky-900/60 text-sky-300 border-sky-600/50',
                icon: 'fa-clock',
                txt: 'text-sky-300',
              };
    var statusLabel = window.trOption(st);
    var dateStr = a.timestamp ? a.timestamp.split('T')[0] || a.timestamp : '';
    html +=
      '<div class="flex items-center gap-3 p-3 bg-black/40 border border-slate-700/50 rounded-xl hover:border-emerald-500/30 transition">' +
      '<div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ' +
      cls.box +
      '">' +
      '<i class="fas ' +
      cls.icon +
      ' text-xs"></i></div>' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-xs font-black text-emerald-400 truncate">' +
      window.esc(a.code) +
      '</p>' +
      '<p class="text-[10px] text-slate-400">' +
      tr('candidate.job_status_label') +
      ' <span class="font-bold ' +
      cls.txt +
      '">' +
      window.esc(statusLabel) +
      '</span></p>' +
      '</div>' +
      (dateStr
        ? '<span class="text-[9px] text-slate-500 whitespace-nowrap">' +
          window.esc(dateStr) +
          '</span>'
        : '') +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  container.classList.remove('hidden');
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file
// (engine/init.js via window.*, render/candidate.js, dll).
registerSeamAliases({
  evaluasiTahapanKandidat,
  kalkulasiProgress,
  renderMultiJobProgress,
});
