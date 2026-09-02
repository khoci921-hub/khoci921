// ==========================================
// TESTS: actions-wa — buildPesanTawaranMassal (varian pesan bergilir anti-ban).
// Fitur Undang Grup Kelas mengirim undangan WA grup ke orang tua/wali via
// action kirimTawaranMassal dengan customMessage berisi BANYAK VARIAN
// (dipisah baris `---`). Varian dikirim BERGILIRAN per penerima
// (index mod jumlah varian) supaya tiap orang dapat pesan berbeda — pesan
// identik massal berisiko kena banned Fonnte/WA.
// ==========================================
import { describe, it, expect } from 'vitest';
import { buildPesanTawaranMassal } from './actions-wa';

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
