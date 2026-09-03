// ==========================================
// TESTS: actions-wa — buildPesanTawaranMassal (varian pesan bergilir anti-ban).
// Fitur Undang Grup Kelas mengirim undangan WA grup ke orang tua/wali via
// action kirimTawaranMassal dengan customMessage berisi BANYAK VARIAN
// (dipisah baris `---`). Varian dikirim BERGILIRAN per penerima
// (index mod jumlah varian) supaya tiap orang dapat pesan berbeda — pesan
// identik massal berisiko kena banned Fonnte/WA.
// ==========================================
import { describe, it, expect } from 'vitest';
import { buildPesanTawaranMassal, splitPesanVariants, waKirim } from './actions-wa';

const V = [
  'Pesan A untuk {nama} ({link_grup})',
  'Pesan B untuk {nama} ({link_grup})',
  'Pesan C untuk {nama} ({link_grup})',
];

describe('buildPesanTawaranMassal — varian pesan bergilir (anti-ban)', () => {
  it('3 varian × 5 penerima → bergilir v0,v1,v2,v0,v1', () => {
    const got = [0, 1, 2, 3, 4].map((i) =>
      buildPesanTawaranMassal(V, null, 'Ortu', 'JOB1', 'https://g', i),
    );
    expect(got[0]).toContain('Pesan A');
    expect(got[1]).toContain('Pesan B');
    expect(got[2]).toContain('Pesan C');
    expect(got[3]).toContain('Pesan A'); // wrap-around
    expect(got[4]).toContain('Pesan B');
  });

  it('jumlah varian = jumlah penerima → tiap orang dapat pesan khususnya (urutan sama)', () => {
    const names = ['Andi', 'Budi', 'Cici'];
    const variants = [
      'Khusus untuk {nama} (1)',
      'Khusus untuk {nama} (2)',
      'Khusus untuk {nama} (3)',
    ];
    const got = names.map((n, i) => buildPesanTawaranMassal(variants, null, n, '', 'https://g', i));
    expect(got[0]).toBe('Khusus untuk Andi (1)');
    expect(got[1]).toBe('Khusus untuk Budi (2)');
    expect(got[2]).toBe('Khusus untuk Cici (3)');
  });

  it('placeholder {nama}/{link_grup} diganti PER penerima, bukan sekali', () => {
    const got = [0, 1].map((i) =>
      buildPesanTawaranMassal(
        V,
        null,
        i === 0 ? 'Budi' : 'Siti',
        '',
        'https://chat.whatsapp.com/ABC',
        i,
      ),
    );
    expect(got[0]).toContain('Pesan A untuk Budi (https://chat.whatsapp.com/ABC)');
    expect(got[1]).toContain('Pesan B untuk Siti (https://chat.whatsapp.com/ABC)');
  });

  it('satu varian → pesan sama untuk semua penerima', () => {
    const satu = ['Halo {nama}, gabung: {link_grup}'];
    const got = [0, 1, 2].map((i) => buildPesanTawaranMassal(satu, null, 'X', '', 'https://g', i));
    expect(got.every((m) => m === 'Halo X, gabung: https://g')).toBe(true);
  });

  it('tanpa varian + template wa_templates → template dipakai', () => {
    const tpl = 'Yth. {nama} — bergabung di grup: {link_grup} (job {job_code})';
    expect(buildPesanTawaranMassal([], tpl, 'Budi', 'TG123', 'https://g', 0)).toBe(
      'Yth. Budi — bergabung di grup: https://g (job TG123)',
    );
  });

  it('tanpa varian + tanpa template → pesan default', () => {
    const m = buildPesanTawaranMassal([], null, 'Budi', 'TG123', 'https://g', 0);
    expect(m).toContain('Halo Budi!');
    expect(m).toContain('TG123');
    expect(m).toContain('https://g');
  });

  it('placeholder gaya lama <<NAMA>>/<<LINK>>/<<JOB>> tetap diganti (kompat WA Pintar)', () => {
    const lama = ['Halo <<NAMA>>, gabung <<LINK>> (job <<JOB>>)'];
    expect(buildPesanTawaranMassal(lama, null, 'Budi', 'TG1', 'https://g', 0)).toBe(
      'Halo Budi, gabung https://g (job TG1)',
    );
  });

  it('varian kosong (hanya pemisah/baris kosong) diperlakukan seperti tidak ada varian', () => {
    // parse di handler memakai .filter(Boolean) — helper menerima array bersih.
    expect(buildPesanTawaranMassal([], null, 'Budi', '', 'https://g', 0)).toContain('Halo Budi!');
  });
});

describe('splitPesanVariants — parsing varian `---` (shared massal & kirimSatuTawaran)', () => {
  it('pisah multi varian + buang baris kosong & trim spasi', () => {
    expect(splitPesanVariants('Varian A\n---\n\n   Varian B  \n')).toEqual(['Varian A', 'Varian B']);
  });

  it('tanpa pemisah → satu varian utuh (baris baru dalam pesan dipertahankan)', () => {
    expect(splitPesanVariants('Satu pesan\nmulti baris')).toEqual(['Satu pesan\nmulti baris']);
  });

  it('kosong / hanya pemisah → array kosong (fallback template/default)', () => {
    expect(splitPesanVariants('')).toEqual([]);
    expect(splitPesanVariants('---')).toEqual([]);
  });
});

describe('kirimSatuTawaran — komposisi pesan per nomor (murni, tanpa network)', () => {
  // handleKirimSatuTawaran = splitPesanVariants(customMessage) +
  // buildPesanTawaranMassal(...) + 1 kirim Fonnte. Bagian murni ini memastikan
  // pesan penerima ke-i (index) identik dengan semantik kirimTawaranMassal —
  // varian bergilir per penerima + placeholder per penerima.
  const MSG = 'V1 utk {nama} ({link_grup})\n---\nV2 utk {nama} ({link_grup})';

  it('penerima ke-0 dapat varian 1, penerima ke-1 dapat varian 2 (placeholder per nama)', () => {
    const variants = splitPesanVariants(MSG);
    expect(variants).toHaveLength(2);
    expect(buildPesanTawaranMassal(variants, null, 'Budi', '', 'https://g', 0)).toBe(
      'V1 utk Budi (https://g)',
    );
    expect(buildPesanTawaranMassal(variants, null, 'Siti', '', 'https://g', 1)).toBe(
      'V2 utk Siti (https://g)',
    );
  });

  it('customMessage kosong + templateIsi dikirim frontend → pakai template (bukan default)', () => {
    const variants = splitPesanVariants('');
    const tpl = 'Yth. {nama} — undangan grup: {link_grup} (job {job_code})';
    expect(buildPesanTawaranMassal(variants, tpl, 'Andi', 'TG9', 'https://g', 2)).toBe(
      'Yth. Andi — undangan grup: https://g (job TG9)',
    );
  });
});

describe('waKirim — normalisasi NOMOR KIRIM (intl dari undangan grup ≠ gate kandidat)', () => {
  it('0xx → 62xx', () => {
    expect(waKirim('081234567890')).toBe('6281234567890');
    expect(waKirim('085713545023')).toBe('6285713545023');
  });

  it('8xx domestik pendek (≤11 digit) → 628xx', () => {
    expect(waKirim('81234567890')).toBe('6281234567890');
  });

  it('62… / 628… sudah baku → tetap', () => {
    expect(waKirim('6281234567890')).toBe('6281234567890');
  });

  it('internasional 8-led panjang (Japan +81 80-4204-5600) → TIDAK di-62-kan', () => {
    expect(waKirim('818042045600')).toBe('818042045600');
  });

  it('internasional negara lain (+65) → apa adanya', () => {
    expect(waKirim('6591234567')).toBe('6591234567');
    expect(waKirim('12025550100')).toBe('12025550100');
  });

  it('kosong / non-digit → kosong', () => {
    expect(waKirim('')).toBe('');
    expect(waKirim(null)).toBe('');
    expect(waKirim('abc')).toBe('');
  });
});
