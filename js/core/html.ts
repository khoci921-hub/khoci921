// =============================================================================
// js/core/html.ts — escape HTML satu sumber kebenaran utk halaman standalone.
// -----------------------------------------------------------------------------
// Dulu dideklarasikan KEMBAR di js/pages/ai_form.ts & js/pages/siswa_baru.ts
// (salinan hasil fork halaman). Siswa_baru memakai truthiness (`value || ''`)
// sehingga 0/false ikut dikosongkan; versi kanonikal di sini hanya mengosongkan
// null/undefined — perilaku escape identik untuk teks normal.
// Catatan: bundel utama memakai `esc` (api-client.ts, entity `&#39;`) — dua
// runtime/bundel terpisah, jangan digabung paksa (lihat audit 2026-09-03).
// =============================================================================

export function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
