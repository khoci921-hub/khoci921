import { registerSeamAliases } from '../core/bridge.ts';
// ==========================================
// PREVIEW FILE — render Excel client-side (SheetJS lazy vendor), fallback
// MS Office Viewer, pesan loading/error di iframe
// ==========================================

// Render file Excel (xls/xlsx/xlsm/csv) CLIENT-SIDE via SheetJS -> HTML
// table di iframe preview — tidak bergantung layanan eksternal sama sekali
// (SheetJS langsung fetch URL storage & render).
// Vendor renderer di-load LAZY saat preview pertama dibuka — bukan
// <script> eager di HTML. HANYA XLSX yang dipakai (render CSV di jalur
// kandidat; admin memuatnya eager; share.html punya salinan inline sendiri).
// FIX 2026-08-12: renderDocxKeFrame/renderPptxKeDiv DIHAPUS — tidak ada
// pemanggil (docx/pptx dirute ke MS Office viewer via previewFinalUrl;
// lib mammoth/pptx-preview di index/admin tidak pernah dieksekusi).
// ?v= diisi hash konten oleh scripts/bump-cache-versions.cjs (konstanta
// VENDOR_V) — update vendor tetap memicu cache invalidation. Gagal dimuat
// -> return false -> pesan error + tombol unduh.
var VENDOR_V = { xlsx: '7f749f81a4' }; // diisi bump-cache-versions.cjs
var _vendorPromises: Record<string, any> = {};
export function muatVendorLib(nama) {
  var src = '/vendor/' + { xlsx: 'xlsx.full.min.js' }[nama] + '?v=' + (VENDOR_V[nama] || '');
  if (!_vendorPromises[nama]) {
    _vendorPromises[nama] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () {
        delete _vendorPromises[nama];
        reject(new Error('vendor gagal dimuat: ' + nama));
      };
      document.head.appendChild(s);
    });
  }
  return _vendorPromises[nama];
}

export async function renderExcelKeFrame(frame, url) {
  if (typeof window.XLSX === 'undefined') {
    try {
      await muatVendorLib('xlsx');
    } catch (e) {
      return false;
    }
  }
  if (typeof window.XLSX === 'undefined') return false;
  try {
    var res = await fetch(url);
    if (!res || !res.ok) return false;
    var buf = await res.arrayBuffer();
    // @ts-expect-error JS→TS migration
    var wb = window.XLSX.read(buf, { type: 'array' });
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) return false;
    var sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return false;
    // @ts-expect-error JS→TS migration
    var html = window.XLSX.utils.sheet_to_html(sheet);
    var nama = decodeURIComponent(String(url).split('/').pop() || 'spreadsheet');
    var doc =
      '<!doctype html><html><head><meta charset="utf-8"><title>' +
      nama +
      '</title>' +
      '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:16px;font-size:13px}table{border-collapse:collapse;background:#fff;color:#0f172a;min-width:60%}td,th{border:1px solid #cbd5e1;padding:6px 10px;white-space:nowrap}th{background:#e2e8f0;position:sticky;top:0;font-weight:700}tr:nth-child(even) td{background:#f8fafc}td[data-t]{text-align:center}</style>' +
      '</head><body><div style="margin-bottom:10px;color:#94a3b8;font-size:12px">📊 ' +
      nama +
      '</div>' +
      html +
      '</body></html>';
    frame.removeAttribute('src');
    frame.srcdoc = doc;
    return true;
  } catch (e) {
    console.error('[Preview] Excel render gagal:', e);
    return false;
  }
}

// Timer fallback preview: jika iframe gagal load dalam 8 detik, tampilkan
// pesan error + tombol unduh (bukan mengandalkan viewer eksternal).
export function _pasangTimerPreviewFallback(frame, url) {
  if (!frame) return;
  var t = setTimeout(function () {
    var lo =
      document.getElementById('preview-loading') ||
      document.getElementById('preview-dokumen-loading') ||
      document.getElementById('cv-inline-loading') ||
      document.getElementById('pdf-loading');
    if (lo && !lo.classList.contains('hidden')) {
      frame.removeAttribute('src');
      frame.srcdoc = pesanPreviewTidakTersedia(url);
      lo.classList.add('hidden');
    }
  }, 8000);
  frame.addEventListener(
    'load',
    function _once() {
      clearTimeout(t);
      frame.removeEventListener('load', _once);
    },
    { once: true },
  );
}

// SATU pintu preview untuk semua pemanggil (admin modal, kandidat):
//  - gambar / PDF         -> native (frame.src = url)
//  - CSV                  -> render lokal SheetJS (srcdoc)
//  - Office (doc/docx/xls/xlsx/ppt/pptx) -> MS Office Viewer (previewFinalUrl)
//  - zip/rar/dll          -> pesan + tombol Unduh (anti auto-download)
//
// FIX 2026-08-12: param pptxHost & tampilkanPptxHost DIHAPUS — render
// lokal docx/pptx sudah dibuang (dead code); semua Office via viewer.
export async function previewFileInFrame(frame, url) {
  if (!frame || !url || url === '-') return;
  if (!window.isPreviewableFile(url)) {
    frame.srcdoc = pesanPreviewTidakTersedia(url);
    return;
  }
  var u = String(url || '');
  var lower = u.toLowerCase();
  var isImage =
    /[.](jpe?g|png|gif|webp|bmp|svg)([?#].*)?$/i.test(lower) || lower.includes('pas_photo') || /image\/upload\//i.test(u) || u.includes('res.cloudinary.com');
  var isPdf = /[.]pdf([?#].*)?$/i.test(lower);
  if (isImage) {
    frame.classList.remove('hidden');
    frame.removeAttribute('srcdoc');
    frame.src = u;
    return;
  }
  if (isPdf) {
    frame.classList.remove('hidden');
    frame.removeAttribute('srcdoc');
    // FIX 2026-08-19: PDF di iframe tidak render di mobile browser.
    // Pakai Google Docs Viewer sebagai wrapper — jalan di desktop & HP.
    var viewerUrl = 'https://docs.google.com/gview?url=' + encodeURIComponent(u) + '&embedded=true';
    frame.src = viewerUrl;
    return;
  }
  frame.classList.remove('hidden');

  var isOffice = /[.](doc|docx|xls|xlsx|ppt|pptx)([?#].*)?$/i.test(lower);
  if (isOffice) {
    frame.removeAttribute('srcdoc');
    frame.src = window.previewFinalUrl(u);
    _pasangTimerPreviewFallback(frame, u);
    return;
  }

  if (/[.](csv)([?#].*)?$/i.test(lower)) {
    // Indikator loading di iframe: vendor xlsx di-load lazy (pertama
    // kali) di sisi kandidat — user harus lihat ada proses berjalan,
    // bukan layar diam yang membuat ragu data sudah termuat atau belum.
    frame.srcdoc = pesanLoadingPreview();
    var ok = await renderExcelKeFrame(frame, u);
    if (!ok) {
      console.warn('[Preview] Render lokal gagal, fallback viewer:', u);
      frame.removeAttribute('srcdoc');
      frame.src = window.previewFinalUrl(u);
      _pasangTimerPreviewFallback(frame, u);
    }
    return;
  }

  frame.removeAttribute('srcdoc');
  frame.src = window.previewFinalUrl(u);
}

// HTML pesan loading untuk iframe saat vendor renderer (lazy) sedang dimuat
// pertama kali — user harus tahu ada proses berjalan (bukan layar diam).
export function pesanLoadingPreview() {
  var judul = window.tr('ui.preview_loading');
  return (
    '<div style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:28px;box-sizing:border-box">' +
    '<div style="font-size:22px">⏳</div>' +
    '<div style="font-size:14px;font-weight:700">' +
    judul +
    '</div>' +
    '</div>'
  );
}

// HTML pesan untuk iframe saat file tidak bisa dipratinjau (anti auto-download).
export function pesanPreviewTidakTersedia(url) {
  var ext = (String(url).match(/[.]([a-z0-9]+)([?#].*)?$/i) || [])[1] || '';
  var judul = window.tr('ui.preview_unavailable');
  var hint = window.tr('ui.preview_unavailable_hint');
  var unduh = window.tr('ui.download');
  return (
    '<div style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:28px;box-sizing:border-box">' +
    '<div style="font-size:22px">📄</div>' +
    '<div style="font-size:16px;font-weight:700">' +
    judul +
    (ext ? ' <span style="opacity:.6">(.' + ext + ')</span>' : '') +
    '</div>' +
    '<div style="font-size:13px;opacity:.75;max-width:320px">' +
    hint +
    '</div>' +
    '<a href="' +
    String(url).replace(/"/g, '&quot;') +
    '" target="_blank" rel="noopener" style="padding:10px 26px;background:#0284c7;color:#fff;border-radius:999px;text-decoration:none;font-weight:700"><i class="fas fa-download"></i> ' +
    unduh +
    '</a>' +
    '</div>'
  );
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// (03_candidate.js & admin_modal/cv.js window.previewFileInFrame,
// 03_candidate.js & pages/share.js pesanPreviewTidakTersedia; VENDOR_V /
// _vendorPromises tetap PRIVATE modul — tidak ada pemakai eksternal).
registerSeamAliases({
  previewFileInFrame,
  pesanPreviewTidakTersedia,
});
