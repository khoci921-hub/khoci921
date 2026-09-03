// ==========================================
// withRetry — helper retry (SATU sumber kebenaran)
// ==========================================
// Satu-satunya definisi `withRetry` untuk modul bundel admin/index.
// Sebelumnya helper ini diduplikasi top-level di 4 modul ai_copilot (admin,
// interview, parse, results) — nama sama di 2+ modul bundel membuat
// check-globals gagal (kolisi global, exit 1) dan berisiko di-rename
// esbuild saat bundling. Modul ini dipakai via import ESM sehingga tidak
// ada deklarasi ganda. js/pages/ai_form.ts (halaman standalone, bundel
// terpisah) masih memakai salinan lokalnya sendiri.
export async function withRetry(fn?, maxAttempts?, delayMs?) {
  maxAttempts = maxAttempts || 2;
  delayMs = delayMs || 2000;
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
