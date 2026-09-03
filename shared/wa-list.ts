// =============================================================================
// shared/wa-list.ts — parse daftar penerima WA (baris "Nama|WA" / tempelan
// dari WhatsApp) — SATU-SATUNYA sumber kebenaran parsing daftar kirim.
// -----------------------------------------------------------------------------
// Dipakai frontend js/admin_ops/candidates.ts (modal Undangan Grup Kelas —
// parseDaftarOrtu) dan di-unit-test di sini. Aturan nomor domestik
// (normalizeWa + isValidWaFormat) diimpor dari shared/wa-rules.ts.
//
// PENTING — dua "dunia" nomor yang sengaja dipisah:
//   1. Gate 628… (shared/wa-rules.ts) TETAP untuk identitas kandidat
//      (login/daftar/SATRIA dedupe) — TIDAK disentuh.
//   2. Daftar UNDANGAN GRUP KELAS (di sini) boleh memuat nomor internasional
//      DENGAN kode negara eksplisit: "+81 80-4204-5600", "+65 9123-4567".
//      Tanpa tanda '+' tetap diasumsikan domestik (0xx/8xx → 62xx) — kalau
//      nomornya asing TANPA '+', sistem tidak bisa membedakannya.
//
// Format baris yang DITERIMA:
//   - "Nama|628xxxxxxxxxx" / pemisah tab / titik koma  (format lama)
//   - "Nama 085713545023"                              (digit di akhir baris)
//   - Tempelan daftar anggota dari WhatsApp:
//     "1. NAMA +62 831-9187-1783" / "20. NAMA 0857-1382-4104"
//     (nomor urut di depan dibuang dari nama; separator +/spasi/-/()/.
//      di nomor diabaikan; 0xx/8xx otomatis jadi 62xx)
//     "15. NAMA +81 80-4204-5600"                      (internasional → +81…)
//   Baris tanpa nomor valid dihitung invalid & dikeluarkan.
// =============================================================================
import { normalizeWa, isValidWaFormat } from './wa-rules.ts';

// Nomor urut tempelan WA: "1. ", "12) ", "3- " — buang dari NAMA.
const LEADING_NO = /^\d+\s*[.)-]\s*/;
// Bullet kopian lain: "- ", "* ", "• " — buang dari NAMA.
const LEADING_BULLET = /^[-*•]\s+/;

function cleanNama(n) {
  return String(n || '')
    .replace(LEADING_NO, '')
    .replace(LEADING_BULLET, '')
    .trim();
}

// Nomor di akhir baris — format WA: [+]62 831-9187-1783, 0857-1382-4104,
// 085713545023, +81 80-4204-5600. Kelas karakter mengizinkan pemisah umum;
// {7,25} mencegah angka pendek acak (tahun, nomor urut) dikira nomor WA.
const TRAILING_PHONE = /^(.*?)([+]?\d[\d\s().-]{7,25})$/;

// Nomor dengan kode negara EKSPLISIT ('+…'): digit dipertahankan apa adanya
// (TANPA konversi 0xx/8xx → 62xx). Panjang 8-15 digit (batas E.164); kalau
// dimulai '62' tetap wajib lolos gate Indonesia (628… 12-13/14 digit).
function parseIntl(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(d)) return '';
  if (d.startsWith('62')) return isValidWaFormat(d) ? d : '';
  return d;
}

// text → { list: [{nama, wa}], invalid: jumlah baris dibuang }.
export function parseDaftarOrtuRows(text) {
  const list = [];
  let invalid = 0;
  String(text || '')
    .split(/\r?\n/)
    .forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      let nama = '';
      let waRaw = '';
      const sep = line.search(/[|\t;]/);
      if (sep !== -1) {
        nama = cleanNama(line.slice(0, sep));
        waRaw = line.slice(sep + 1).trim();
      } else {
        const m = line.match(TRAILING_PHONE);
        if (!m) {
          invalid += 1;
          return;
        }
        nama = cleanNama(m[1]);
        waRaw = m[2].trim();
      }
      let wa = '';
      if (/^\+/.test(String(waRaw || '').trim())) {
        // Kode negara eksplisit: +62 → 628…; +81/+65/… → digit apa adanya
        // (8-led internasional TIDAK boleh dikira 8xx domestik).
        wa = parseIntl(waRaw);
        if (!wa) {
          invalid += 1;
          return;
        }
      } else {
        // Tanpa '+': asumsi nomor domestik Indonesia.
        wa = normalizeWa(waRaw);
        if (!wa || !isValidWaFormat(wa)) {
          invalid += 1;
          return;
        }
      }
      list.push({ nama: nama || 'Orang Tua/Wali', wa });
    });
  return { list, invalid };
}
