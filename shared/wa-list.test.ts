// ==========================================
// TESTS: shared/wa-list — parse daftar penerima WA (modal Undangan Grup
// Kelas). Kontrak: format lama "Nama|628…" TETAP jalan + tempelan daftar
// anggota WhatsApp ("1. NAMA +62 831-…") terbaca; nomor internasional
// DENGAN '+' (+81/+65/…) valid untuk daftar undangan; tanpa '+' tetap
// diasumsikan domestik 628 (gate kandidat di wa-rules TIDAK berubah).
// ==========================================
import { describe, it, expect } from 'vitest';
import { parseDaftarOrtuRows } from './wa-list';

describe('parseDaftarOrtuRows — format lama (Nama|WA / digit di akhir)', () => {
  it('pemisah |', () => {
    const { list, invalid } = parseDaftarOrtuRows('Budi|6281234567890');
    expect(list).toEqual([{ nama: 'Budi', wa: '6281234567890' }]);
    expect(invalid).toBe(0);
  });

  it('pemisah tab dan titik koma', () => {
    const { list } = parseDaftarOrtuRows('Budi\t6281234567890\nSiti;081234567890');
    expect(list).toEqual([
      { nama: 'Budi', wa: '6281234567890' },
      { nama: 'Siti', wa: '6281234567890' },
    ]);
  });

  it('digit kontigu di akhir baris (0xx → 62xx)', () => {
    const { list } = parseDaftarOrtuRows('DITO PUTRA PRIAMBUDI 085713545023');
    expect(list).toEqual([{ nama: 'DITO PUTRA PRIAMBUDI', wa: '6285713545023' }]);
  });

  it('8xx tanpa nol depan', () => {
    const { list } = parseDaftarOrtuRows('Ahmad 81234567890');
    expect(list).toEqual([{ nama: 'Ahmad', wa: '6281234567890' }]);
  });
});

describe('parseDaftarOrtuRows — tempelan daftar anggota dari WhatsApp', () => {
  const PASTE = [
    '1. KHARINA DWI SAPUTRI +62 831-9187-1783',
    '2. NUR AISYAH +62 856-4209-8535',
    '10. ARYA RIZKY PUTRA KUSNADI +62 851-5624-1922',
    '20. ERNA RAMADHANI 0857-1382-4104',
    '21. DITO PUTRA PRIAMBUDI 085713545023',
  ].join('\n');

  it('nomor urut dibuang dari nama, nomor ternormalisasi 628…', () => {
    const { list, invalid } = parseDaftarOrtuRows(PASTE);
    expect(invalid).toBe(0);
    expect(list).toEqual([
      { nama: 'KHARINA DWI SAPUTRI', wa: '6283191871783' },
      { nama: 'NUR AISYAH', wa: '6285642098535' },
      { nama: 'ARYA RIZKY PUTRA KUSNADI', wa: '6285156241922' },
      { nama: 'ERNA RAMADHANI', wa: '6285713824104' },
      { nama: 'DITO PUTRA PRIAMBUDI', wa: '6285713545023' },
    ]);
  });

  it('internasional eksplisit (+81) diterima — digit apa adanya, TANPA di-62-kan', () => {
    const { list, invalid } = parseDaftarOrtuRows('NENDEN MEGA BELA PUTIK  +81 80-4204-5600');
    expect(invalid).toBe(0);
    expect(list).toEqual([{ nama: 'NENDEN MEGA BELA PUTIK', wa: '818042045600' }]);
  });

  it('internasional eksplisit negara lain (+65) diterima', () => {
    const { list } = parseDaftarOrtuRows('SINGAPORE ORANG +65 9123-4567');
    expect(list).toEqual([{ nama: 'SINGAPORE ORANG', wa: '6591234567' }]);
  });

  it('+62 eksplisit tetap masuk format domestik 628…', () => {
    const { list } = parseDaftarOrtuRows('Budi|+62 831-9187-1783');
    expect(list).toEqual([{ nama: 'Budi', wa: '6283191871783' }]);
  });

  it('nomor asing TANPA + → diasumsikan domestik (0818…) oleh aturan 8xx', () => {
    // Tanpa tanda '+', "8180…" tidak bisa dibedakan dari 0818… domestik.
    const { list, invalid } = parseDaftarOrtuRows('15. NAMA 818042045600');
    expect(list).toEqual([{ nama: 'NAMA', wa: '62818042045600' }]);
    expect(invalid).toBe(0);
  });

  it('internasional terlalu pendek / kosong → invalid', () => {
    const { list, invalid } = parseDaftarOrtuRows('A|+81 12345\nB|+1\nC|+62 abc');
    expect(list).toEqual([]);
    expect(invalid).toBe(3);
  });

  it('baris tanpa nomor / nomor terlalu pendek → invalid', () => {
    const { list, invalid } = parseDaftarOrtuRows('Tanpa Nomor\n7. WAJAR 08123');
    expect(list).toEqual([]);
    expect(invalid).toBe(2);
  });

  it('baris kosong diabaikan tanpa invalid', () => {
    const { list, invalid } = parseDaftarOrtuRows('\n\nBudi|6281234567890\n\n');
    expect(list).toHaveLength(1);
    expect(invalid).toBe(0);
  });
});
