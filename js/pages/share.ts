// js/pages/share.js. ESM (Fase 3 langkah 13): modul ES dimuat
// <script type="module"> — export + alias window.* utk HTML inline
// (toggleLang/renderGrid/submitSelection) & onclick string yang di-generate
// renderGrid (window.openPreview/toggleSelection). Helper preview lokal
// (isPreviewableFile/previewFinalUrl/render*Ke*/*KeDiv/pesanPreviewTidakTersedia)
// tetap PRIVATE modul — jangan di-window-kan (bentrok dengan util.js
// window.isPreviewableFile/previewFinalUrl). Vendor XLSX/mammoth via window.*.
// ==========================================
// SHARE VIEW — viewer kandidat aman untuk kaisha + modal preview dokumen
// ==========================================
// ENTRY ESM (Fase 3.5 Langkah 6): halaman meng-import core lewat bridge.js
// (i18n + api-client) dan mendaftarkan alias seam HTML↔JS TERPUSAT via
// registerSeamAliases — bukan window.X = X per baris.
import { registerSeamAliases } from '../core/bridge.ts';

// LANG lokal di-rename jadi SHARE_LANG supaya tidak bentrok dengan
// `const LANG` global dari i18n.js (yang dimuat sebagai satu sumber tr()).
const SHARE_LANG = {
  id: {
    secure: 'Secure Candidate Viewer',
    load: 'Loading Job…',
    skip: 'Lewati ke konten utama',
    err_acc: 'Akses Ditolak',
    err_msg: 'Silakan periksa kembali link yang diberikan.',
    empty_t: 'Belum Ada Kandidat',
    empty_s: 'Kandidat untuk job ini akan muncul di sini.',
    filter: 'Filter:',
    gen_all: 'Semua Gender',
    gen_l: 'Laki-laki (L)',
    gen_p: 'Perempuan (P)',
    age_all: 'Semua Usia',
    jft_all: 'Semua Level JFT',
    age_yr: 'thn',
    gender_m: 'L',
    gender_f: 'P',
    sel_count: 'Kandidat Terpilih',
    sel_btn: 'Kirim Pilihan',
    select: 'Pilih',
    dl: 'Download',
    close: 'Tutup',
    prev: 'Preview Dokumen',
    loading_doc: 'Memuat Dokumen…',
    prev_unavail: 'Tidak bisa dipratinjau',
    prev_unavail_hint:
      'Tipe file ini tidak bisa ditampilkan di preview browser — gunakan tombol Unduh.',
    wa_closing: 'Mohon tindak lanjutnya. Terima kasih.',
    wa_greet: 'Halo Admin ASJ, kami tertarik dengan kandidat berikut untuk Job',
  },
  jp: {
    secure: '安全な候補者ビューア',
    load: '求人を読み込み中…',
    skip: 'メインコンテンツへスキップ',
    err_acc: 'アクセス拒否',
    err_msg: '提供されたリンクをもう一度確認してください。',
    empty_t: '候補者がいません',
    empty_s: 'この求人の候補者はここに表示されます。',
    filter: '絞り込み:',
    gen_all: 'すべての性別',
    gen_l: '男性 (L)',
    gen_p: '女性 (P)',
    age_all: 'すべての年齢',
    jft_all: 'すべてのJFTレベル',
    age_yr: '歳',
    gender_m: '男',
    gender_f: '女',
    sel_count: '名 選択中',
    sel_btn: '選択を送信',
    select: '選択',
    dl: 'ダウンロード',
    close: '閉じる',
    prev: 'ドキュメントプレビュー',
    loading_doc: '読み込み中…',
    prev_unavail: 'プレビュー不可',
    prev_unavail_hint:
      'このファイル形式はブラウザのプレビューで表示できません。ダウンロードボタンをご利用ください。',
    wa_closing: 'ご対応のほどよろしくお願いいたします。ありがとうございます。',
    wa_greet: 'こんにちは、ASJ管理者。以下の候補者に興味があります。求人コード:',
  },
};

// Bahasa sinkron dengan portal utama (localStorage asj_lang) — toggle
// di share view memakai kunci yang sama, jadi pilihan pengguna konsisten
// antara share.html dan index.html/admin.html.
// Simple toast for share page (no dependency on index bundle)
function shareToast(msg, type) {
  var d = document.createElement('div');
  d.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl transition-all';
  d.style.cssText = 'background:' + (type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#1e40af') + ';color:#fff;border:1px solid ' + (type === 'error' ? '#fca5a5' : type === 'success' ? '#6ee7b7' : '#93c5fd') + ';';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function() { d.style.opacity = '0'; d.style.transform = 'translate(-50%,-10px)'; }, 3000);
  setTimeout(function() { d.remove(); }, 3500);
}

// Retry wrapper
function withRetry(fn, maxAttempts, delayMs) {
  maxAttempts = maxAttempts || 2;
  delayMs = delayMs || 2000;
  return function attempt() {
    return fn().catch(function(err) {
      if (maxAttempts <= 1) throw err;
      maxAttempts--;
      return new Promise(function(resolve) { setTimeout(resolve, delayMs); }).then(attempt);
    });
  };
}

let currentLang = localStorage.getItem('asj_lang') === 'jp' ? 'jp' : 'id';
let allCandidates = [];
let currentJob = null;
let selectedIds = new Set();
let selectedNames: Record<string, any> = {};

export function toggleLang() {
  currentLang = currentLang === 'id' ? 'jp' : 'id';
  try {
    localStorage.setItem('asj_lang', currentLang);
  } catch (e) {}
  // Sinkronkan CURRENT_LANG global i18n.js supaya tr() ikut berganti bahasa.
  if (window.CURRENT_LANG !== undefined) window.CURRENT_LANG = currentLang;
  document.getElementById('lang-ind').className =
    currentLang === 'id' ? 'text-pink-400 font-black' : 'text-slate-500 font-normal';
  document.getElementById('lang-jp').className =
    currentLang === 'jp' ? 'text-pink-400 font-black' : 'text-slate-500 font-normal';
  updateStaticText();
  renderGrid();
}

export function updateStaticText() {
  const l = SHARE_LANG[currentLang];
  const setTxt = (id, txt) => {
    let el = document.getElementById(id);
    if (el) el.innerText = txt;
  };
  setTxt('skip-link', l.skip);
  setTxt('text-secure', l.secure);
  if (
    document.getElementById('job-title').innerText === 'Loading Job…' ||
    document.getElementById('job-title').innerText === '求人を読み込み中…'
  )
    setTxt('job-title', l.load);
  if (document.getElementById('error-message')) {
    setTxt('text-err-title', l.err_acc);
    setTxt('error-message', l.err_msg);
  }
  if (document.getElementById('empty-state')) {
    setTxt('text-empty-title', l.empty_t);
    setTxt('text-empty-msg', l.empty_s);
  }
  setTxt('text-filter-title', l.filter);
  setTxt('opt-gen-all', l.gen_all);
  setTxt('opt-gen-l', l.gen_l);
  setTxt('opt-gen-p', l.gen_p);
  setTxt('opt-age-all', l.age_all);
  setTxt('opt-jft-all', l.jft_all);
  setTxt('text-sel-count', l.sel_count);
  setTxt('text-sel-btn', l.sel_btn);
  setTxt('preview-loading-txt', l.loading_doc);
  // Modal preview: judul + tombol Download/Tutup ikut bahasa.
  setTxt('preview-title', l.prev);
  setTxt('preview-download', l.dl);
  setTxt('preview-close', l.close);
  // aria-label tombol icon-only (label teks disembunyikan di mobile)
  // — ikut bahasa ID/JP supaya label AT tetap konsisten.
  const dlA = document.getElementById('preview-download');
  if (dlA) dlA.setAttribute('aria-label', l.dl);
  const pcA = document.getElementById('preview-close');
  if (pcA) pcA.setAttribute('aria-label', l.close);
}

export function toggleSelection(id, name) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    delete selectedNames[id];
  } else {
    selectedIds.add(id);
    selectedNames[id] = name;
  }
  updateSelectionBar();
  renderGrid();
}

function updateSelectionBar() {
  const bar = document.getElementById('selection-bar');
  const count = document.getElementById('selection-count');
  // @ts-expect-error JS→TS migration
  count.innerText = selectedIds.size;
  if (selectedIds.size > 0) {
    bar.classList.remove('translate-y-full');
  } else {
    bar.classList.add('translate-y-full');
  }
}

export function submitSelection() {
  if (!currentJob || selectedIds.size === 0) return;
  let l = SHARE_LANG[currentLang];
  let msg = l.wa_greet + ' *' + currentJob.code + ' - ' + currentJob.name + '*:\n\n';
  let i = 1;
  for (let id of selectedIds) {
    // @ts-expect-error JS→TS migration
    msg += i + '. ' + selectedNames[id] + ' (ID: ' + id + ')\n';
    i++;
  }
  msg += '\n' + l.wa_closing;

  let url = 'https://wa.me/6287889502004?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}

// Tipe yang bisa ditampilkan INLINE: gambar/PDF native + format Office
// (xls/xlsx/doc/docx/ppt/pptx) — dirender client-side (SheetJS/mammoth).
function isPreviewableFile(url) {
  var u = String(url || '').toLowerCase();
  if (/[.](jpe?g|png|gif|webp|bmp|svg|pdf)([?#].*)?$/i.test(u)) return true;
  if (/[.](xls|xlsx|xlsm|doc|docx|ppt|pptx|odt|ods|odp|txt|rtf|csv)([?#].*)?$/i.test(u))
    return true;
  return false;
}

// URL aman untuk iframe per tipe (sama dengan previewFinalUrl di 02_init.js).
function previewFinalUrl(url) {
  var u = String(url || '');
  var lower = u.toLowerCase();
  var isImage =
    /[.](jpe?g|png|gif|webp|bmp|svg)([?#].*)?$/i.test(lower) || lower.includes('pas_photo');
  var isPdf = /[.]pdf([?#].*)?$/i.test(lower);
  if (isImage || isPdf) return u;
  var isOffice = /[.](doc|docx|xls|xlsx|ppt|pptx)([?#].*)?$/i.test(lower);
  if (isOffice) {
    return 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(u);
  }
  return u;
}

// Render file Excel (xls/xlsx/xlsm/csv) CLIENT-SIDE via SheetJS -> HTML
// table di iframe — render lokal tidak bergantung layanan eksternal.
function renderExcelKeFrame(frame, url) {
  if (typeof window.XLSX === 'undefined' || !frame) return Promise.resolve(false);
  return fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('fetch fail');
      return res.arrayBuffer();
    })
    .then(function (buf) {
      // @ts-expect-error JS→TS migration
      var wb = window.XLSX.read(buf, { type: 'array' });
      if (!wb || !wb.SheetNames || !wb.SheetNames.length) throw new Error('no sheet');
      var sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('empty sheet');
      // @ts-expect-error JS→TS migration
      var html = window.XLSX.utils.sheet_to_html(sheet);
      var nama = decodeURIComponent(String(url).split('/').pop() || 'spreadsheet');
      var doc =
        '<!doctype html><html><head><meta charset="utf-8"><title>' +
        nama +
        '</title>' +
        '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:16px;font-size:13px}table{border-collapse:collapse;background:#fff;color:#0f172a;min-width:60%}td,th{border:1px solid #cbd5e1;padding:6px 10px;white-space:nowrap}th{background:#e2e8f0;position:sticky;top:0;font-weight:700}tr:nth-child(even) td{background:#f8fafc}</style>' +
        '</head><body><div style="margin-bottom:10px;color:#94a3b8;font-size:12px">📊 ' +
        nama +
        '</div>' +
        html +
        '</body></html>';
      frame.removeAttribute('src');
      frame.srcdoc = doc;
      return true;
    })
    .catch(function (e) {
      console.error('[Preview] Excel render gagal:', e);
      return false;
    });
}

// Render Word (docx) CLIENT-SIDE via mammoth -> HTML di iframe.
function renderDocxKeFrame(frame, url) {
  if (typeof window.mammoth === 'undefined' || !frame) return Promise.resolve(false);
  return fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('fetch fail');
      return res.arrayBuffer();
    })
    .then(function (buf) {
      // @ts-expect-error JS→TS migration
      return window.mammoth.convertToHtml({ arrayBuffer: buf });
    })
    .then(function (result) {
      if (!result || !result.value) throw new Error('empty');
      var nama = decodeURIComponent(String(url).split('/').pop() || 'document.docx');
      var doc =
        '<!doctype html><html><head><meta charset="utf-8"><title>' +
        nama +
        '</title>' +
        "<style>body{font-family:Georgia,'Times New Roman',serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px;font-size:15px;line-height:1.65}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #94a3b8;padding:4px 8px}a{color:#38bdf8}</style>" +
        '</head><body>' +
        result.value +
        '</body></html>';
      frame.removeAttribute('src');
      frame.srcdoc = doc;
      return true;
    })
    .catch(function (e) {
      console.error('[Preview] Docx render gagal:', e);
      return false;
    });
}

// Render PowerPoint (pptx) CLIENT-SIDE via pptx-preview: iframe diberi
// Render PowerPoint (pptx) CLIENT-SIDE via pptx-preview -> div HOST di
// modal (parent page): lib ini merender ke elemen DOM, bukan iframe.
// Host ditampilkan DULU sebelum init — kalau display:none (0x0),
// pptx-preview mengukur container kosong dan render jadi tidak ada.
function renderPptxKeDiv(host, url) {
  if (typeof window.pptxPreview === 'undefined' || !host) return Promise.resolve(false);
  return fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('fetch fail');
      return res.arrayBuffer();
    })
    .then(function (buf) {
      host.classList.remove('hidden');
      host.innerHTML = '';
      // @ts-expect-error JS→TS migration
      var p = window.pptxPreview.init(host, { width: 960, height: 540 });
      p.preview(buf);
      return true;
    })
    .catch(function (e) {
      console.error('[Preview] PPTX render gagal:', e);
      return false;
    });
}

function pesanPreviewTidakTersedia(url) {
  var l = SHARE_LANG[currentLang];
  var ext = (String(url).match(/[.]([a-z0-9]+)([?#].*)?$/i) || [])[1] || '';
  // Satu sumber terjemahan: pakai tr() dari i18n.js (sama dengan index/admin);
  // fallback ke SHARE_LANG lokal kalau i18n.js tidak termuat.
  var judul =
    typeof window.tr === 'function' &&
    window.tr('ui.preview_unavailable') !== 'ui.preview_unavailable'
      ? window.tr('ui.preview_unavailable')
      : l.prev_unavail;
  var hint =
    typeof window.tr === 'function' &&
    window.tr('ui.preview_unavailable_hint') !== 'ui.preview_unavailable_hint'
      ? window.tr('ui.preview_unavailable_hint')
      : l.prev_unavail_hint;
  var btn =
    typeof window.tr === 'function' && window.tr('ui.download') !== 'ui.download'
      ? window.tr('ui.download')
      : l.dl;
  return (
    '<div style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;">' +
    '<div style="font-size:40px;">📄</div>' +
    '<div style="font-size:17px;font-weight:700;">' +
    judul +
    (ext ? ' (.' + ext + ')' : '') +
    '</div>' +
    '<div style="font-size:13px;color:#94a3b8;max-width:420px;line-height:1.5;">' +
    hint +
    '</div>' +
    '<a href="' +
    url +
    '" target="_blank" rel="noopener" style="margin-top:6px;padding:10px 22px;background:#0284c7;color:#fff;border-radius:10px;font-weight:700;text-decoration:none;"><i class="fas fa-download"></i> ' +
    btn +
    '</a>' +
    '</div>'
  );
}

export function openPreview(url, title) {
  document.getElementById('preview-title').innerText = title;
  document.getElementById('preview-download').href = url;
  document.getElementById('preview-loading').classList.remove('hidden');

  document.getElementById('preview-iframe').classList.add('hidden');
  document.getElementById('preview-img').classList.add('hidden');

  let isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || title.startsWith('Foto');

  if (isImage) {
    document.getElementById('preview-img').src = url;
    document.getElementById('preview-img').classList.remove('hidden');
    document.getElementById('preview-loading').classList.add('hidden');
  } else if (!isPreviewableFile(url)) {
    // zip/rar/dll tidak bisa dipratinjau — jangan taruh di iframe
    // (itu yang memicu auto-download); tampilkan pesan + tombol Download.
    var frame = document.getElementById('preview-iframe');
    frame.removeAttribute('src');
    frame.srcdoc = pesanPreviewTidakTersedia(url);
    frame.classList.remove('hidden');
    document.getElementById('preview-loading').classList.add('hidden');
  } else {
    var frame2 = document.getElementById('preview-iframe');
    var pptxHost = document.getElementById('preview-pptx-host');
    // Bersihkan srcdoc pesan dari bukaan sebelumnya supaya tidak
    // menimpa preview (browser mengutamakan srcdoc atas src).
    frame2.removeAttribute('srcdoc');
    var render;
    var isPptx = false;
    if (/\.(csv)([?#].*)?$/i.test(url)) {
      render = renderExcelKeFrame; // SheetJS
    }
    if (isPptx) {
      // PPT: render ke div host (pptx-preview butuh elemen DOM,
      // bukan iframe) — iframe disembunyikan, host ditampilkan.
      frame2.classList.add('hidden');
      if (pptxHost) pptxHost.classList.remove('hidden');
      renderPptxKeDiv(pptxHost, url).then(function (ok) {
        if (!ok) {
          // Gagal render lokal -> fallback viewer di iframe.
          if (pptxHost) pptxHost.classList.add('hidden');
          frame2.classList.remove('hidden');
          frame2.src = previewFinalUrl(url);
        }
      });
    } else if (render) {
      // Render LOKAL (anti gagal viewer eksternal).
      if (pptxHost) pptxHost.classList.add('hidden');
      frame2.classList.remove('hidden');
      render(frame2, url).then(function (ok) {
        if (!ok) {
          console.warn('[Preview] Render lokal gagal, fallback viewer eksternal:', url);
          frame2.removeAttribute('srcdoc');
          frame2.src = previewFinalUrl(url);
          var _gvTimer = setTimeout(function () {
            var lo = document.getElementById('preview-loading');
            if (lo && !lo.classList.contains('hidden')) {
              frame2.removeAttribute('src');
              frame2.srcdoc = pesanPreviewTidakTersedia(url);
              lo.classList.add('hidden');
            }
          }, 8000);
          frame2.addEventListener(
            'load',
            function _once() {
              clearTimeout(_gvTimer);
              frame2.removeEventListener('load', _once);
            },
            { once: true },
          );
        }
      });
    } else {
      if (pptxHost) pptxHost.classList.add('hidden');
      frame2.classList.remove('hidden');
      frame2.src = previewFinalUrl(url);
    }
  }

  document.getElementById('modal-preview').classList.remove('hidden');
}

export function closePreview() {
  document.getElementById('modal-preview').classList.add('hidden');
  document.getElementById('preview-iframe').src = '';
  document.getElementById('preview-iframe').removeAttribute('srcdoc');
  document.getElementById('preview-img').src = '';
  document.getElementById('preview-pptx-host').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  // Tandai tombol bahasa sesuai state awal (dari localStorage).
  document.getElementById('lang-ind').className =
    currentLang === 'id' ? 'text-pink-400 font-black' : 'text-slate-500 font-normal';
  document.getElementById('lang-jp').className =
    currentLang === 'jp' ? 'text-pink-400 font-black' : 'text-slate-500 font-normal';
  updateStaticText();
  const urlParams = new URLSearchParams(window.location.search);
  const jobCode = urlParams.get('job');

  if (!jobCode) {
    showError(SHARE_LANG[currentLang].err_msg);
    return;
  }

  try {
    const res = await withRetry(function() {
      return fetch('/api/share-data?job=' + encodeURIComponent(jobCode));
    }, 2, 2000)();
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan saat mengambil data.');

    currentJob = data.job;
    allCandidates = data.candidates || [];

    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('job-info-container').classList.remove('hidden');
    document.getElementById('job-title').innerText = currentJob.name;
    document.getElementById('job-code').innerText = currentJob.code;

    if (allCandidates.length > 0) {
      document.getElementById('filter-bar').classList.remove('hidden');
      document.getElementById('candidates-grid').classList.remove('hidden');
      renderGrid();
      shareToast(allCandidates.length + ' kandidat ditemukan', 'success');
    } else {
      document.getElementById('empty-state').classList.remove('hidden');
    }
  } catch (err) {
    showError(err.message);
    shareToast('Gagal memuat data: ' + err.message, 'error');
  }
});

export function renderGrid() {
  const grid = document.getElementById('candidates-grid');
  grid.innerHTML = '';

  let genF = document.getElementById('filter-gender').value;
  let ageF = document.getElementById('filter-age').value;
  let jftF = document.getElementById('filter-jft').value;

  let filtered = allCandidates.filter((c) => {
    let safeGender = (c.gender || '').toUpperCase();
    let isP = safeGender.includes('PEREMPUAN');
    let g = isP ? 'p' : 'l';
    if (genF !== 'all' && g !== genF) return false;

    let usia = parseInt(c.usia) || 0;
    if (ageF === 'under20' && (usia === 0 || usia >= 20)) return false;
    if (ageF === '20to25' && (usia < 20 || usia > 25)) return false;
    if (ageF === 'over25' && usia <= 25) return false;

    let jftText = (c.nilai_jft_text || '').toUpperCase();
    if (jftF === 'a2' && !jftText.includes('A2') && !jftText.includes('N4')) return false;
    if (jftF === 'b1' && !jftText.includes('B1') && !jftText.includes('N3')) return false;

    return true;
  });

  let l = SHARE_LANG[currentLang];

  filtered.forEach((c) => {
    let namaLengkap = c.nama_lengkap || 'Candidate';
    let photoUrl =
      c.pas_photo && c.pas_photo !== '-'
        ? c.pas_photo
        : 'https://ui-avatars.com/api/?name=' +
          encodeURIComponent(namaLengkap) +
          '&background=0D8ABC&color=fff';
    // Thumbnail storage (kartu 72-84px): gunakan aslinya agar tidak pecah/blur
    // karena Supabase Image Transformation mungkin memotong/compress terlalu agresif.
    let photoThumb = photoUrl;
    // XSS: namaLengkap di-inject ke onclick string — wajib escape
    // kutip tunglu & ganda + backslash supaya aman di atribut HTML.
    let safeName = namaLengkap.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    // Tombol aksi kompak & proporsional: ikon kecil di atas label
    // (grid 1:2:1 di semua ukuran), tidak lagi membentang penuh.
    const btnBase =
      'flex-1 py-2 md:py-2.5 rounded-lg font-bold text-center transition flex flex-col items-center justify-center gap-1 w-full border';
    const btnOn =
      'bg-pink-600/20 hover:bg-pink-600 border-pink-500/50 text-pink-300 hover:text-white';
    const btnOff = 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed';
    let cvBtn =
      c.file_cv && c.file_cv.trim() && c.file_cv !== '-'
        ? `<button onclick="window.openPreview('${c.file_cv}', 'CV - ${safeName}')" class="${btnBase} ${btnOn} text-[10px] md:text-xs"><i class="fas fa-file-pdf text-xs md:text-sm"></i> CV</button>`
        : `<div class="${btnBase} ${btnOff} text-[10px] md:text-xs"><i class="fas fa-file-pdf text-xs md:text-sm opacity-50"></i> CV</div>`;

    let jftBtn =
      c.jft && c.jft.trim() && c.jft !== '-'
        ? `<button onclick="window.openPreview('${c.jft}', 'JFT - ${safeName}')" class="${btnBase} bg-purple-600/20 hover:bg-purple-600 border-purple-500/50 text-purple-400 hover:text-white text-[10px] md:text-xs"><i class="fas fa-certificate text-xs md:text-sm"></i> JFT</button>`
        : `<div class="${btnBase} ${btnOff} text-[10px] md:text-xs"><i class="fas fa-certificate text-xs md:text-sm opacity-50"></i> JFT</div>`;

    let sswBtn =
      c.ssw && c.ssw.trim() && c.ssw !== '-'
        ? `<button onclick="window.openPreview('${c.ssw}', 'SSW - ${safeName}')" class="${btnBase} bg-emerald-600/20 hover:bg-emerald-600 border-emerald-500/50 text-emerald-400 hover:text-white text-[10px] md:text-xs"><i class="fas fa-award text-xs md:text-sm"></i> SSW</button>`
        : `<div class="${btnBase} ${btnOff} text-[10px] md:text-xs"><i class="fas fa-award text-xs md:text-sm opacity-50"></i> SSW</div>`;

    // Dokumen ekstra (SIM, KTP, ijazah, dll) dari folder master —
    // share view tidak baku 3 tombol saja: file apa pun yang ada
    // ikut tampil & bisa dipratinjau. Klasifikasi tipe SAMA dengan
    // backend (handlers.js docTypeOf): nama lawas dikenali
    // (1. X_CV.xlsx → CV, nama_jft.pdf → JFT, X_PAS_PHOTO.jpg →
    // FOTO), alias dinormalisasi, CV/JFT/SSW/foto bukan tombol
    // ekstra, dan 1 tipe = 1 tombol (dedupe defensif di sini juga
    // — jaga-jaga backend lama yang belum di-deploy).
    const EXTRA_TYPE_ALIAS = {
      CVFILE: 'CV',
      FILE_CV: 'CV',
      CV_REVISI: 'CV',
      PHOTOFILE: 'FOTO',
      PAS_PHOTO: 'FOTO',
      PASSPHOTO: 'FOTO',
      FOTO: 'FOTO',
      PHOTO: 'FOTO',
      JFTFILE: 'JFT',
      SSWFILE: 'SSW',
      KARTU_KELUARGA: 'KK',
    };
    const EXTRA_TYPE_TOKENS = [
      'PAS_PHOTO',
      'PHOTOFILE',
      'KARTU_KELUARGA',
      'CVFILE',
      'FILE_CV',
      'CV_REVISI',
      'JFTFILE',
      'SSWFILE',
      'PASSPHOTO',
      'PASSPORT',
      'IJAZAH',
      'KTP',
      'KK',
      'CV',
      'JFT',
      'SSW',
      'FOTO',
      'PHOTO',
    ];
    function docTypeOf(nm) {
      const base = String(nm || '').replace(/\.[a-z0-9]+$/i, '');
      const up = base.toUpperCase();
      // Step 1: Token panjang (>3 char) sebagai substring — FILE_CV, CV_REVISI, dll.
      for (const tk of EXTRA_TYPE_TOKENS) {
        if (tk.length > 3 && up.includes(tk)) {
          return EXTRA_TYPE_ALIAS[tk] || tk;
        }
      }
      // Step 2: Regex prefix uppercase — KK, KTP, IJAZAH, dll.
      const m = base.match(/^[A-Z]+/);
      const prefix = m ? m[0] : null;
      if (prefix && EXTRA_TYPE_ALIAS[prefix]) return EXTRA_TYPE_ALIAS[prefix];
      if (prefix && prefix.length >= 2) return prefix;
      // Step 3: Pola lawas "1. X_CV.xlsx" — cari token di seluruh nama.
      for (const tk of EXTRA_TYPE_TOKENS) {
        if (tk.length >= 2 && up.includes(tk)) {
          return EXTRA_TYPE_ALIAS[tk] || tk;
        }
      }
      return up;
    }
    let extraBtns = '';
    const seenExtraTypes = new Set();
    (c.extraDocs || []).forEach((d) => {
      const type = docTypeOf(d.name);
      if (type === 'CV' || type === 'JFT' || type === 'SSW' || type === 'FOTO') return; // sudah ada tombol utama
      if (seenExtraTypes.has(type)) return; // 1 tipe = 1 tombol
      seenExtraTypes.add(type);
      let raw = String(d.name)
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/_\d{10,}$/g, '')
        .toUpperCase()
        .trim();
      // File standar nama_<loker>cv (CV per loker lain) -> label "CV <loker>"
      const stdCv = raw.match(/^NAMA_?(.+?)CV$/);
      let label = stdCv
        ? 'CV ' + stdCv[1].replace(/_/g, ' ').trim()
        : type === raw
          ? raw.replace(/_/g, ' ').trim()
          : type;
      if (!label) label = 'FILE';
      label = label.slice(0, 16);
      extraBtns += `<button onclick="window.openPreview('${d.url}', '${label} - ${safeName}')" class="${btnBase} bg-amber-600/20 hover:bg-amber-600 border-amber-500/50 text-amber-400 hover:text-white text-[10px] md:text-xs"><i class="fas fa-file-alt text-xs md:text-sm"></i> ${label}</button>`;
    });

    let safeGender = c.gender || '';
    let isPerempuan = safeGender.toUpperCase().includes('PEREMPUAN');
    let genderIcon = isPerempuan ? 'fas fa-venus text-pink-400' : 'fas fa-mars text-sky-400';
    let genderLabel = isPerempuan ? l.gender_f : safeGender ? l.gender_m : '-';

    let isSelected = selectedIds.has(c.id_kandidat);
    let borderClass = isSelected
      ? 'border-pink-400 shadow-[0_0_15px_rgba(244,114,182,0.3)]'
      : 'border-slate-700/50 hover:border-pink-500/50';
    let checkClass = isSelected
      ? 'bg-pink-500 text-white border-pink-500'
      : 'bg-slate-800/50 border-slate-600 text-transparent';

    let cardHtml = `
                    <div class="glass-card rounded-2xl p-4 md:p-5 border ${borderClass} transition-all group relative cursor-pointer flex flex-col">
                        <!-- A11Y 2026-08-12: kartu pakai overlay <button> sungguhan (fokus keyboard,
                             Enter/Space) — bukan div onClick. Tombol dokumen di dalam tetap valid:
                             photo & baris dokumen naik ke z-20, di atas overlay z-10. -->
                        <button type="button" aria-pressed="${isSelected ? 'true' : 'false'}" aria-label="${l.select} ${namaLengkap} — ${c.id_kandidat}" onclick="toggleSelection('${c.id_kandidat}', '${safeName}')" class="absolute inset-0 z-10 w-full h-full cursor-pointer bg-transparent border-0 rounded-2xl"></button>
                        
                        <div class="absolute top-3 right-3 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 ${checkClass} flex items-center justify-center transition-colors z-10 shadow-lg pointer-events-none">
                            <i class="fas fa-check text-[10px] md:text-xs"></i>
                        </div>

                        <div class="flex gap-3 md:gap-4 mb-3 md:mb-4 relative">
                            <div class="w-[72px] h-[96px] md:w-[84px] md:h-[112px] shrink-0 rounded-xl overflow-hidden bg-slate-800 border ${isSelected ? 'border-pink-400' : 'border-slate-600'} shadow-inner relative z-20 transition-colors group/photo" onclick="event.stopPropagation(); window.openPreview('${photoUrl}', 'Foto - ${safeName}')">
                                <img src="${photoThumb}" loading="lazy" decoding="async" alt="${namaLengkap}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=' + encodeURIComponent('${safeName}') + '&background=0D8ABC&color=fff';">
                                ${photoUrl.includes('ui-avatars') ? '' : `<div class="absolute inset-0 bg-black/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"><i class="fas fa-search-plus text-lg drop-shadow-md"></i></div>`}
                            </div>
                            <div class="flex-1 flex flex-col justify-center min-w-0">
                                <h3 class="text-xs md:text-sm font-bold text-white mb-2 line-clamp-2 leading-tight pr-4">${namaLengkap}</h3>
                                
                                <div class="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10px] md:text-[11px] text-slate-300 mb-2 w-full mt-1">
                                    <div class="flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis bg-slate-800/50 rounded-md px-1.5 py-0.5 border border-slate-700/50">
                                        <i class="${genderIcon} w-3 text-center"></i>
                                        <span class="font-medium">${genderLabel}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis bg-slate-800/50 rounded-md px-1.5 py-0.5 border border-slate-700/50">
                                        <i class="fas fa-birthday-cake text-amber-400 opacity-80 w-3 text-center"></i>
                                        <span class="font-medium">${c.usia && c.usia !== '-' ? c.usia + ' ' + l.age_yr : '-'}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis bg-slate-800/50 rounded-md px-1.5 py-0.5 border border-slate-700/50">
                                        <i class="fas fa-ruler-vertical text-emerald-400 opacity-80 w-3 text-center"></i>
                                        <span class="font-medium">${c.tb && c.tb !== '-' ? c.tb + ' cm' : '-'}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis bg-slate-800/50 rounded-md px-1.5 py-0.5 border border-slate-700/50">
                                        <i class="fas fa-weight-hanging text-pink-300 opacity-80 w-3 text-center"></i>
                                        <span class="font-medium">${c.bb && c.bb !== '-' ? c.bb + ' kg' : '-'}</span>
                                    </div>
                                </div>
                                
                                <div class="flex flex-wrap gap-1.5 mt-auto pt-1">
                                    ${c.nilai_jft_text && c.nilai_jft_text !== '-' ? `<span class="px-2 py-0.5 bg-purple-900/40 text-purple-300 text-[9px] font-bold rounded-md border border-purple-700/50 flex items-center gap-1"><i class="fas fa-language"></i>${c.nilai_jft_text}</span>` : ''}
                                    ${c.bidang_ssw_text && c.bidang_ssw_text !== '-' ? `<span class="px-2 py-0.5 bg-emerald-900/40 text-emerald-300 text-[9px] font-bold rounded-md border border-emerald-700/50 flex items-center gap-1"><i class="fas fa-certificate"></i>${c.bidang_ssw_text}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap gap-2 w-full relative z-20 mt-auto" onclick="event.stopPropagation()">
                            ${cvBtn}
                            ${jftBtn}
                            ${sswBtn}
                            ${extraBtns}
                        </div>
                    </div>
                `;
    grid.insertAdjacentHTML('beforeend', cardHtml);
  });
}

export function showError(msg) {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('error-state').classList.remove('hidden');
  let el = document.getElementById('error-message');
  if (el) el.innerText = msg;
}

// BRIDGE ESM → classic/HTML inline: SEMUA alias seam HTML↔JS
// diregistrasikan TERPUSAT lewat registerSeamAliases (js/core/bridge.js)
// — bukan window.X = X per baris. Mencakup handler HTML (onclick
// toggleLang/submitSelection, onchange renderGrid) & onclick string yang
// di-generate renderGrid (toggleSelection dipanggil bare — dieval
// global; openPreview/closePreview dengan prefix window.* eksplisit).
registerSeamAliases({
  toggleLang,
  toggleSelection,
  submitSelection,
  openPreview,
  closePreview,
  renderGrid,
});
