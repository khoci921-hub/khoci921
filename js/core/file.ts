// =============================================================================
// js/core/file.ts — util berkas/gambar SATU sumber kebenaran utk halaman
// standalone (js/pages/ai_form.ts & js/pages/siswa_baru.ts — dulu salinan
// lokal kembar hasil fork halaman; byte-identik, diverifikasi 2026-09-03).
// Murni (hanya param + API browser: FileReader/Image/canvas/Blob) — tidak
// membaca state modul halaman, jadi aman dipakai lintas halaman.
// =============================================================================

// base64 → Blob (mis. hasil canvas.toDataURL sebelum upload).
export function base64ToBlob(base64, mime) {
  var byteCharacters = atob(base64);
  var byteArrays = [];
  for (var offset = 0; offset < byteCharacters.length; offset += 512) {
    var slice = byteCharacters.slice(offset, offset + 512);
    var byteNumbers = new Array(slice.length);
    for (var i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mime });
}

// Downscale scan/foto ke JPEG ≤ maxWidth (default 800) kualitas quality
// (default 0.8). Kalau file bukan gambar / SVG/GIF / gagal decode / hasil
// lebih besar dari asli → kirim data asli apa adanya via callback.
// callback({ data: base64, name, mime }).
export function downscaleScanImage(file, maxWidth, quality, callback) {
  var reader = new FileReader();
  reader.onerror = function () {
    callback({ data: '', name: file.name, mime: file.type || 'application/octet-stream' });
  };
  reader.onload = function (e) {
    // @ts-expect-error JS→TS migration
    var asli = e.target.result.split(',')[1];
    if (
      !file.type ||
      !file.type.startsWith('image/') ||
      file.type === 'image/svg+xml' ||
      file.type === 'image/gif'
    ) {
      return callback({
        data: asli,
        name: file.name,
        mime: file.type || 'application/octet-stream',
      });
    }
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');
      var w = img.width,
        h = img.height,
        MAX = maxWidth || 800;
      if (w > MAX) {
        h = Math.round((h * MAX) / w);
        w = MAX;
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/jpeg', quality || 0.8);
      var b64 = dataUrl.split(',')[1];
      var approxBytes = Math.floor((b64.length / 4) * 3);
      if (!b64 || approxBytes >= file.size)
        return callback({
          data: asli,
          name: file.name,
          mime: file.type || 'application/octet-stream',
        });
      callback({
        data: b64,
        name: String(file.name || 'scan').replace(/\.[^/.]+$/, '') + '.jpg',
        mime: 'image/jpeg',
      });
    };
    // FIX: gambar image/ tapi gagal decode (HEIC/korup) → pakai asli,
    // jangan menggantung status "Membaca…"
    img.onerror = function () {
      callback({ data: asli, name: file.name, mime: file.type || 'application/octet-stream' });
    };
    // @ts-expect-error JS→TS migration
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
