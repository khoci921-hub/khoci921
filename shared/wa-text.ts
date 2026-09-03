// =============================================================================
// shared/wa-text.ts — SATU-SATUNYA sumber kebenaran parsing teks pesan WA.
// -----------------------------------------------------------------------------
// Dipakai DUA runtime:
//   - Backend : netlify/functions/_lib/actions-wa.ts (splitPesanVariants —
//               handleKirimTawaranMassal & handleKirimSatuTawaran).
//   - Frontend: js/admin_ops/candidates.ts (preview varian pesan — nama lama
//               parseVarianPesan di-alias ke sini, seam window.* dipertahankan).
// JANGAN definisikan ulang parsing varian `---` di jalur lain — drift
// frontend↔backend berarti preview ≠ pesan yang benar-benar terkirim.
// (Modul kembaran: shared/wa-rules.ts untuk aturan nomor WA.)
// =============================================================================

// Pisahkan BANYAK VARIAN pesan (dipisah baris `---`), buang baris kosong.
// Varian dikirim BERGILIRAN per penerima (index % variants.length) — tiap
// penerima dapat pesan berbeda (anti-ban pesan identik massal).
export function splitPesanVariants(text) {
  return String(text || '')
    .split(/^---\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ===========================================================================
// AUTO-VARIAN ANTI-BAN: satu template → 2-4 variasi pembuka/penutup.
// Isi (kalimat utama, {link_grup}, {nama}, job) TIDAK diubah — hanya kata
// sambutan baris pertama & kalimat penutup ("Terima kasih…") yang bervariasi,
// supaya pesan massal tidak identik 100%. Murni — di-unit-test di sini.
// ===========================================================================
const AUTO_PEMBUKA = [
  'Halo Kak {nama},',
  "Assalamu'alaikum Kak {nama},",
  'Kak {nama} yang baik,',
  'Salam sejahtera Kak {nama},',
];
const AUTO_PENUTUP = [
  'Terima kasih.',
  'Terima kasih atas perhatian dan kerja samanya.',
  'Terima kasih banyak, sampai jumpa di grup.',
  'Mohon konfirmasi setelah bergabung, ya. Terima kasih.',
];
const RE_GREETING = /^(halo|assalamu?|salam|hai|hi|kepada|yth\.?|selamat|good\s)/i;
const RE_THANKS = /(terima\s*kasih|thank|terimakasih|hormat|wassalam|wasalam)/i;

// Satu variasi dari `src` dengan pembuka/penutup tertentu. Baris sambutan
// pertama diganti (kalau polanya greeting), "Terima kasih…" di area penutup
// diganti, tanda tangan organisasi di bawahnya (mis. "AMANAH SAKURA JAPAN.")
// dipertahankan.
function variasiPesan(src, buka, tutup) {
  const ls = String(src || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ''));
  while (ls.length && !ls[0].trim()) ls.shift();
  while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
  if (!ls.length) return '';

  let start = 0;
  if (ls.length > 1 && RE_GREETING.test(ls[0].trim())) start = 1;
  const linkIdx = ls.findIndex((l) => l.includes('{link_grup}'));
  let tailFrom = -1;
  if (linkIdx >= 0) {
    let j = linkIdx + 1;
    while (j < ls.length && !ls[j].trim()) j++;
    if (j < ls.length) tailFrom = j; // ada isi setelah link → zona penutup
  }
  const body = ls.slice(start, tailFrom >= 0 ? tailFrom : ls.length);
  while (body.length && !body[body.length - 1].trim()) body.pop();

  // Tanpa zona penutup: ganti baris terakhir kalau itu "Terima kasih…".
  let lastThanks = -1;
  if (tailFrom < 0 && body.length && RE_THANKS.test(body[body.length - 1].trim())) {
    lastThanks = body.length - 1;
  }

  const out = [buka];
  if (body.length && body[0].trim()) out.push('');
  body.forEach((l, i) => {
    if (i === lastThanks) out.push(tutup);
    else out.push(l);
  });
  out.push('');
  if (tailFrom >= 0) {
    const tail = ls.slice(tailFrom).map((l) => l.trim()).filter(Boolean);
    const ti = tail.findIndex((l) => RE_THANKS.test(l));
    if (ti >= 0) {
      out.push(tutup);
      const rest = tail.slice(ti + 1);
      if (rest.length) {
        out.push(''); // blank antara 'Terima kasih' & tanda tangan
        rest.forEach((l) => out.push(l));
      }
    } else {
      out.push(tutup);
      tail.forEach((l) => {
        out.push('');
        out.push(l);
      });
    }
  } else if (lastThanks < 0) {
    out.push(tutup);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// `tpl` (boleh berisi 1 varian; dipakai yang pertama) → array pesan:
// index 0 = teks ASLI (dijamin tak berubah), sisanya variasi pembuka/penutup.
// `max` = jumlah maksimum total (default 4). Kosong kalau input kosong.
export function buatVarianPesanOtomatis(tpl, max = 4) {
  const src = splitPesanVariants(tpl)[0] || String(tpl || '').trim();
  if (!src) return [];
  const out = [src];
  const limit = Math.max(2, Math.min(Number(max) || 4, 4));
  // Baris pertama teks asli — variasi dengan pembuka SAMA (kloning kosmetik
  // karena cuma spasi yang beda) tidak perlu dihasilkan.
  const srcFirst = ((src.split(/\r?\n/).find((l) => l.trim()) || '').trim()) || null;
  for (let i = 0; i < AUTO_PEMBUKA.length && out.length < limit; i += 1) {
    const v = variasiPesan(src, AUTO_PEMBUKA[i], AUTO_PENUTUP[i]);
    if (!v || v === src || out.includes(v)) continue;
    const vFirst = ((v.split(/\r?\n/).find((l) => l.trim()) || '').trim()) || null;
    if (vFirst === srcFirst) continue; // pembuka tidak berubah → bukan variasi baru
    out.push(v);
  }
  return out;
}
