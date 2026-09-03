// ==========================================
// TESTS: shared/wa-text — parsing varian pesan `---`.
// Satu sumber kebenaran untuk backend (actions-wa) DAN frontend
// (candidates.ts alias parseVarianPesan). Test di sini adalah kontrak:
// preview varian di UI harus identik dengan pesan yang dikirim server.
// ==========================================
import { describe, it, expect } from 'vitest';
import { splitPesanVariants, buatVarianPesanOtomatis } from './wa-text';

describe('splitPesanVariants — parsing varian `---` (shared massal & kirimSatuTawaran & preview UI)', () => {
  it('memisah varian per baris `---` dan trim tiap varian', () => {
    expect(splitPesanVariants('Varian A\n---\n\n   Varian B  \n')).toEqual([
      'Varian A',
      'Varian B',
    ]);
  });

  it('mempertahankan baris kosong DI DALAM varian (multi baris)', () => {
    expect(splitPesanVariants('Satu pesan\nmulti baris')).toEqual(['Satu pesan\nmulti baris']);
  });

  it('tiga varian dengan spasi TRAILING di separator', () => {
    expect(splitPesanVariants('A\n---\nB\n---   \nC')).toEqual(['A', 'B', 'C']);
  });

  it('kosong / hanya separator → tanpa varian', () => {
    expect(splitPesanVariants('')).toEqual([]);
    expect(splitPesanVariants('---')).toEqual([]);
    expect(splitPesanVariants('   ')).toEqual([]);
  });

  it('non-string aman', () => {
    expect(splitPesanVariants(undefined)).toEqual([]);
    expect(splitPesanVariants(null)).toEqual([]);
  });
});

describe('buatVarianPesanOtomatis — variasi pembuka/penutup (anti-ban)', () => {
  const TEMPLATE_KELAS = [
    'Halo Kak {nama},',
    '',
    'Anda terpilih untuk mengikuti tahapan selanjutnya pada Job TG668ASJ - BC CO & CE TOKYO',
    'Silakan gabung ke Grup :',
    '',
    '🔗 {link_grup}',
    '',
    'Terima kasih.',
    '',
    'AMANAH SAKURA JAPAN.',
  ].join('\n');

  it('index 0 = teks asli; total maks 4; isi & link tidak berubah', () => {
    const v = buatVarianPesanOtomatis(TEMPLATE_KELAS);
    expect(v.length).toBe(4);
    expect(v[0]).toBe(TEMPLATE_KELAS.trim());
    v.forEach((msg, i) => {
      expect(msg).toContain('{link_grup}');
      expect(msg).toContain('Anda terpilih untuk mengikuti tahapan selanjutnya pada Job TG668ASJ');
      if (i > 0) expect(msg).not.toBe(v[0]);
    });
  });

  it('varian memakai pembuka baru dan tanda tangan tetap dipertahankan', () => {
    const v = buatVarianPesanOtomatis(TEMPLATE_KELAS, 2);
    expect(v.length).toBe(2);
    const v1 = v[1];
    expect(v1.startsWith("Assalamu'alaikum Kak {nama},")).toBe(true);
    expect(v1).toContain('AMANAH SAKURA JAPAN.'); // tanda tangan di bawah 'Terima kasih' dipertahankan
    expect(v1.split('Terima kasih').length - 1).toBe(1); // tidak dobel
  });

  it('template default kelas (thanks setelah link, tanpa tanda tangan) → tanpa dobel thanks', () => {
    const def = [
      'Assalamu\'alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari {nama}.',
      'Kami mengundang Bapak/Ibu untuk bergabung ke grup WhatsApp resmi kelas.',
      '',
      'Silakan klik tautan berikut untuk bergabung:',
      '{link_grup}',
      '',
      'Terima kasih atas perhatian dan kerja samanya.',
    ].join('\n');
    const v = buatVarianPesanOtomatis(def, 3);
    expect(v.length).toBe(3);
    v.slice(1).forEach((m) => {
      expect(m.split('Terima kasih').length - 1).toBe(1);
      expect(m).toContain('{link_grup}');
    });
  });

  it('template tanpa {link_grup} & tanpa penutup → tetap menghasilkan variasi', () => {
    const plain = 'Halo {nama},\nAnda terpilih untuk tahapan berikutnya.\nHubungi kami untuk info lebih lanjut.';
    const v = buatVarianPesanOtomatis(plain, 4);
    expect(v.length).toBeGreaterThanOrEqual(2);
    v.forEach((m) => expect(m).toContain('Anda terpilih untuk tahapan berikutnya.'));
  });

  it('kosong → []', () => {
    expect(buatVarianPesanOtomatis('')).toEqual([]);
    expect(buatVarianPesanOtomatis(undefined)).toEqual([]);
  });
});
