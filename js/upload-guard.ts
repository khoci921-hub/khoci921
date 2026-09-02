import { registerSeamAliases } from './core/bridge.ts';
// =============================================================================
// upload-guard.js — Validasi SERAGAM untuk SEMUA input type="file" di portal.
// -----------------------------------------------------------------------------
// Dipakai oleh:
//   - admin.html & index.html   (via bundel assets/app-*.js, build-js.mjs)
//   - ai_form.html, master-full.html, apply-full.html, siswa-baru.html
//     (via <script type="module" src="/js/upload-guard.js"> langsung)
//
// ESM (Fase 3 langkah 13): modul ES — `cekUploadFile` di-export + alias
// window.* utk pemakai classic/bundel & HTML onclick. Helper internal
// (extDariAccept/formatBoleh/pesan) PRIVATE modul.
//
// Aturan (konsisten di semua form):
//   - FORMAT: dibaca dari atribut `accept` input. `image/*` diperluas ke
//     jpg/jpeg/png/gif/webp/bmp. Kalau accept kosong → format tidak dicek.
//   - UKURAN: dari argumen {maxMb} atau atribut `data-max-mb` pada input,
//     default 5 MB. (Base64 +30% tetap muat di limit server.)
//   - GAGAL → alert pesan jelas (format yang diizinkan + batas MB), input
//     di-reset, return false. SUKSES → return true.
//   - Pesan memakai i18n (tr) kalau tersedia, fallback Bahasa Indonesia.
// =============================================================================

// Ekstensi yang diizinkan dari string accept (mis. ".pdf,image/*").
function extDariAccept(accept) {
  var acc = String(accept || '').toLowerCase();
  var out = [];
  if (acc.indexOf('image/*') !== -1) {
    out = out.concat(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
  }
  acc.split(',').forEach(function (a) {
    a = a.trim().replace(/^\./, '');
    if (a && out.indexOf(a) === -1) out.push(a);
  });
  return out;
}

// "pdf, jpg atau png" dari daftar ekstensi.
function formatBoleh(exts) {
  if (!exts.length) return '';
  var s = exts
    .map(function (e) {
      return '.' + e;
    })
    .join(', ');
  return s.replace(/, ([^,]*)$/, ' atau $1');
}

// Pesan gagal: i18n kalau ada, fallback teks Indonesia yang menyebut format.
function pesan(key, fallback) {
  if (typeof window.tr === 'function') {
    var t = window.tr(key);
    if (t && t !== key) return t;
  }
  return fallback;
}

export function cekUploadFile(input, opts) {
  if (!input || !input.files || !input.files[0]) return true;
  var file = input.files[0];
  opts = opts || {};

  // 1) FORMAT — cocokkan ekstensi dengan accept input.
  var allowed = extDariAccept(input.getAttribute && input.getAttribute('accept'));
  var ext = String(file.name || '')
    .split('.')
    .pop()
    .toLowerCase();
  if (allowed.length && allowed.indexOf(ext) === -1) {
    var msgF = pesan(
      'ui.toast_file_ext_bad',
      'Format ' +
        file.name +
        ' tidak diizinkan untuk form ini. Gunakan: ' +
        formatBoleh(allowed) +
        '.',
    ).replace('{nama}', file.name);
    alert(msgF);
    input.value = '';
    return false;
  }

  // 2) UKURAN — data-max-mb pada input atau argumen maxMb, default 5 MB.
  var attrMb = input.getAttribute && Number(input.getAttribute('data-max-mb'));
  var maxMb = typeof opts.maxMb === 'number' ? opts.maxMb : attrMb || 5;
  if (file.size > maxMb * 1024 * 1024) {
    var msgS = pesan(
      'ui.toast_file_too_big',
      'File ' + file.name + ' terlalu besar (maksimal ' + maxMb + ' MB).',
    )
      .replace('{nama}', file.name)
      .replace('{mb}', maxMb);
    alert(msgS);
    input.value = '';
    return false;
  }

  return true;
}

// BRIDGE ESM → classic/bundel & HTML inline: alias window.* (pemakai lama
// memanggil `cekUploadFile(...)` bare dari onclick — string dieval global).
registerSeamAliases({
  cekUploadFile,
});
