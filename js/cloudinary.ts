import { registerSeamAliases } from './core/bridge.ts';
// =============================================================================
// cloudinary.js — Upload langsung (direct unsigned upload) ke Cloudinary.
// dengan RETRY & exponential backoff untuk menangani timeout/network error
// =============================================================================

const CLOUDINARY_CLOUD_NAME = 'ybzzbw9i';
const CLOUDINARY_UPLOAD_PRESET = 'asjportal';

export function cloudinaryEndpoint() {
  return 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(CLOUDINARY_CLOUD_NAME) + '/upload';
}

// uploadToCloudinary(file, opts, maxRetries) → Promise<string secure_url>
//   - file: objek File/Blob dari <input type="file">.
//   - opts (opsional): { uploadPreset, endpoint } untuk override konfigurasi.
//   - maxRetries (opsional): jumlah retry (default 3)
//   - Retry otomatis pada timeout atau 5xx error; fatal pada 4xx
//   - Mengembalikan `secure_url` (HTTPS) dari respons Cloudinary.
//   - Melempar Error dengan pesan Cloudinary kalau upload gagal setelah retry.
export async function uploadToCloudinary(file, opts, maxRetries = 3) {
  if (!file) throw new Error('Tidak ada file untuk diupload ke Cloudinary.');
  const preset = (opts && opts.uploadPreset) || CLOUDINARY_UPLOAD_PRESET;
  const endpoint = (opts && opts.endpoint) || cloudinaryEndpoint();

  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 30000) : null;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: fd,
        signal: controller ? controller.signal : undefined,
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Handle response error
      if (!res.ok) {
        let detail = '';
        try {
          const j = await res.json();
          detail = (j && j.error && j.error.message) || '';
        } catch (e) {
          /* body bukan JSON — pakai status saja */
        }

        const errMsg =
          'Upload Cloudinary gagal (HTTP ' + res.status + ')' + (detail ? ': ' + detail : '');

        // 4xx = client error (validation, auth) → fatal, jangan retry
        if (res.status >= 400 && res.status < 500) {
          throw new Error(errMsg);
        }

        // 5xx = server error → retry dengan backoff
        if (res.status >= 500) {
          lastError = new Error(errMsg);
          if (attempt < maxRetries - 1) {
            const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
        }
      }

      const data = await res.json();
      if (!data || !data.secure_url) {
        throw new Error('Cloudinary tidak mengembalikan secure_url.');
      }
      return data.secure_url;
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);

      // AbortError (timeout) atau network error → retry dengan backoff
      if (e.name === 'AbortError' || e.message.includes('Gagal terhubung')) {
        lastError = new Error('Upload Cloudinary timeout/network: ' + e.message);
        if (attempt < maxRetries - 1) {
          const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
      } else {
        // Validation atau error lainnya → fatal
        throw e;
      }
    }
  }

  throw lastError || new Error('Upload Cloudinary gagal setelah ' + maxRetries + ' percobaan');
}

// BRIDGE ESM → classic/bundel
registerSeamAliases({
  uploadToCloudinary,
  cloudinaryEndpoint,
});
