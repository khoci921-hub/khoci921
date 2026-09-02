// demo.js — data DEMO untuk preview, dipakai getAppData selama key Supabase
// asli belum dikonfigurasi. Isinya contoh lowongan realistis supaya halaman
// publik tetap bisa dilihat sebelum backend asli tersambung.

const DEMO_PREVIEW_NOTE =
  '⚠ MODE PREVIEW — Data loker di bawah adalah CONTOH DEMO. Backend asli (Supabase) belum dikonfigurasi: isi SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di Keys/API keys.';

// ASSETS ASLI — seluruhnya di-host di Supabase Storage (bucket asj-files,
// folder assets). Dipakai sebagai default saat sys_config tidak
// menyediakan konfigurasi assets.
// Semua aset brand kini di Supabase Storage (bucket asj-files, folder assets)
// — tidak ada lagi aset yang di-host di Google (lh3/drive).
const STORAGE_BASE = 'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files';

const DEMO_ASSETS = {
  LOGO: STORAGE_BASE + '/assets/logo_asj.png',
  BANNER: {
    TOKYO: STORAGE_BASE + '/assets/tokyo_banner.jpg',
    SAKURA: STORAGE_BASE + '/assets/sakra_banner.webp',
  },
  FOOTER: {
    TOKYO: STORAGE_BASE + '/assets/tokyo_footer.jpg',
    SAKURA: STORAGE_BASE + '/assets/sakura_footer.webp',
  },
  SOCIAL: {
    whatsapp: '6287889502004',
    instagram: 'https://www.instagram.com/amanah_sakura_japan',
    tiktok: 'https://www.tiktok.com/@lpkamanahjepangponorogo',
    maps: 'https://maps.app.goo.gl/wDUmAonpPWAcJzFEA',
  },
};

function demoRincian(includeList, excludeList, benefitList, persyaratanList, tahapanList, total) {
  const lines = [];
  lines.push('INCLUDE');
  includeList.forEach((i) => lines.push('- ' + i));
  lines.push('EXCLUDE');
  excludeList.forEach((i) => lines.push('- ' + i));
  lines.push('BENEFIT');
  benefitList.forEach((i) => lines.push('- ' + i));
  lines.push('PERSYARATAN');
  persyaratanList.forEach((i) => lines.push('- ' + i));
  lines.push('TAHAPAN PEMBAYARAN');
  tahapanList.forEach((t) => lines.push(t.nomor + '. ' + t.nama + ' : ' + t.nominal));
  lines.push('TOTAL BIAYA: ' + total);
  return lines.join('\n');
}

const DEMO_JOBS = [
  {
    code: 'DEMO-0001',
    pekerjaan: 'Perawat Lansia (Kaigo)',
    kategori: 'KAIGO',
    status: 'OPEN',
    lokasi: 'Tokushimaken',
    gender: 'WANITA',
    kuota: '10',
    syarat:
      'SMA/SMK,Sertifikat JFT A2,Sehat Jasmani & Rohani,Usia 18-30 Tahun,Tidak Takut Jarum Suntik',
    keterangan:
      'Ditempatkan di fasilitas perawatan lansia Jepang. Bisa langsung magang sambil kursus bahasa Jepang.',
    dokumenShare: 'CV,JFT,SSW',
    templateCv: null,
    pamflet: null,
    rincianBiaya: demoRincian(
      [
        'Tiket pesawat PP',
        'Visa kerja (COE)',
        'Asuransi kesehatan',
        'Training bahasa Jepang 3 bulan',
      ],
      ['Paspor', 'MCU (medical check up)', 'Uang saku pribadi'],
      [
        'Gaji pokok 180.000 yen ke atas',
        'Asrama subsidi perusahaan',
        'Lembur dibayar sesuai kaidah Jepang',
      ],
      ['CV sesuai format ASJ', 'Sertifikat JFT/SSW (1 file PDF)', 'Foto full body'],
      [
        { nomor: 1, nama: 'TTD KONTRAK', nominal: 'Rp 5.000.000' },
        { nomor: 2, nama: 'COE TERBIT', nominal: 'Rp 12.500.000' },
        { nomor: 3, nama: 'VISA JADI', nominal: 'Rp 10.000.000' },
      ],
      'Rp 27.500.000',
    ),
    totalBiaya: 'Rp 27.500.000',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    code: 'DEMO-0002',
    pekerjaan: 'Operator Produksi Pabrik',
    kategori: 'PABRIK',
    status: 'URGENT',
    lokasi: 'Shizuoka',
    gender: 'L/P',
    kuota: '25',
    syarat: 'SMA/SMK,Bisa Kerja Shift,JFT A3 atau A2,Usia 18-28 Tahun',
    keterangan: 'Butuh segera untuk pabrik komponen otomotif. Jadwal keberangkatan Oktober 2026.',
    dokumenShare: 'CV,JFT,SSW,KTP',
    templateCv: null,
    pamflet: null,
    rincianBiaya: demoRincian(
      [
        'Tiket pesawat PP',
        'Visa kerja (COE)',
        'Asuransi kesehatan',
        'Training bahasa Jepang 3 bulan',
      ],
      ['Paspor', 'MCU (medical check up)'],
      ['Gaji pokok 170.000 yen ke atas', 'Lembur & bonus musiman', 'Asrama disediakan'],
      ['CV sesuai format ASJ', 'Sertifikat JFT/SSW (1 file PDF)', 'Scan KTP & KK'],
      [
        { nomor: 1, nama: 'TTD KONTRAK', nominal: 'Rp 4.500.000' },
        { nomor: 2, nama: 'COE TERBIT', nominal: 'Rp 11.000.000' },
        { nomor: 3, nama: 'VISA JADI', nominal: 'Rp 10.000.000' },
      ],
      'Rp 25.500.000',
    ),
    totalBiaya: 'Rp 25.500.000',
    createdAt: '2026-08-05T09:00:00.000Z',
  },
  {
    code: 'DEMO-0003',
    pekerjaan: 'Welder (Pengelasan)',
    kategori: 'KONSTRUKSI',
    status: 'OPEN',
    lokasi: 'Chiba',
    gender: 'PRIA',
    kuota: '8',
    syarat: 'SMA/SMK,Pengalaman Las 2 Tahun,Sertifikat JFT A2,Usia 20-32 Tahun',
    keterangan: 'Posisi las SMAW/FCAW untuk pabrik baja. Pengalaman lebih diutamakan.',
    dokumenShare: 'CV,JFT,SSW',
    templateCv: null,
    pamflet: null,
    rincianBiaya: demoRincian(
      [
        'Tiket pesawat PP',
        'Visa kerja (COE)',
        'Asuransi kesehatan',
        'Training bahasa Jepang 3 bulan',
      ],
      ['Paspor', 'MCU (medical check up)'],
      ['Gaji pokok 190.000 yen ke atas', 'Tunjangan skill las', 'Perusahaan sediakan alat kerja'],
      ['CV sesuai format ASJ', 'Sertifikat JFT/SSW (1 file PDF)', 'Surat pengalaman kerja'],
      [
        { nomor: 1, nama: 'TTD KONTRAK', nominal: 'Rp 5.000.000' },
        { nomor: 2, nama: 'COE TERBIT', nominal: 'Rp 13.000.000' },
        { nomor: 3, nama: 'VISA JADI', nominal: 'Rp 10.000.000' },
      ],
      'Rp 28.000.000',
    ),
    totalBiaya: 'Rp 28.000.000',
    createdAt: '2026-07-28T09:00:00.000Z',
  },
  {
    code: 'DEMO-0004',
    pekerjaan: 'Pertanian & Perkebunan (Nougyou)',
    kategori: 'PERTANIAN',
    status: 'OPEN',
    lokasi: 'Hokkaido',
    gender: 'L/P',
    kuota: '20',
    syarat: 'SMA/SMK,Tahan Panas & Dingin,JFT A2,Usia 18-30 Tahun',
    keterangan: 'Musim panen sayuran dan buah. Kerja musiman dengan bonus panen.',
    dokumenShare: 'CV,JFT,SSW',
    templateCv: null,
    pamflet: null,
    rincianBiaya: demoRincian(
      [
        'Tiket pesawat PP',
        'Visa kerja (COE)',
        'Asuransi kesehatan',
        'Training bahasa Jepang 3 bulan',
      ],
      ['Paspor', 'MCU (medical check up)', 'Makan sehari-hari'],
      ['Gaji pokok 160.000 yen ke atas', 'Bonus hasil panen', 'Asrama murah dekat lahan'],
      ['CV sesuai format ASJ', 'Sertifikat JFT/SSW (1 file PDF)', 'Foto full body'],
      [
        { nomor: 1, nama: 'TTD KONTRAK', nominal: 'Rp 4.000.000' },
        { nomor: 2, nama: 'COE TERBIT', nominal: 'Rp 10.000.000' },
        { nomor: 3, nama: 'VISA JADI', nominal: 'Rp 9.000.000' },
      ],
      'Rp 23.000.000',
    ),
    totalBiaya: 'Rp 23.000.000',
    createdAt: '2026-08-02T09:00:00.000Z',
  },
  {
    code: 'DEMO-0005',
    pekerjaan: 'Makanan & Minuman (Food Factory)',
    kategori: 'PABRIK',
    status: 'CLOSE',
    lokasi: 'Gifu',
    gender: 'WANITA',
    kuota: '15',
    syarat: 'SMA/SMK,JFT A2,Usia 18-28 Tahun,Rajin & Teliti',
    keterangan: 'Kelas sudah penuh untuk angkatan ini — buka lagi di angkatan berikutnya.',
    dokumenShare: 'CV,JFT,SSW',
    templateCv: null,
    pamflet: null,
    rincianBiaya: demoRincian(
      [
        'Tiket pesawat PP',
        'Visa kerja (COE)',
        'Asuransi kesehatan',
        'Training bahasa Jepang 3 bulan',
      ],
      ['Paspor', 'MCU (medical check up)'],
      ['Gaji pokok 170.000 yen ke atas', 'Lembur tersedia', 'Asrama disediakan'],
      ['CV sesuai format ASJ', 'Sertifikat JFT/SSW (1 file PDF)'],
      [
        { nomor: 1, nama: 'TTD KONTRAK', nominal: 'Rp 4.500.000' },
        { nomor: 2, nama: 'COE TERBIT', nominal: 'Rp 11.000.000' },
        { nomor: 3, nama: 'VISA JADI', nominal: 'Rp 10.000.000' },
      ],
      'Rp 25.500.000',
    ),
    totalBiaya: 'Rp 25.500.000',
    createdAt: '2026-07-15T09:00:00.000Z',
  },
  {
    code: 'DEMO-0006',
    pekerjaan: 'Konstruksi Umum (Kensetsu)',
    kategori: 'KONSTRUKSI',
    status: 'URGENT',
    lokasi: 'Kanagawa',
    gender: 'PRIA',
    kuota: '12',
    syarat: 'SMA/SMK,Sehat & Kuat Fisik,JFT A2 atau A3,Usia 20-30 Tahun',
    keterangan: 'Pekerjaan konstruksi gedung dan renovasi. Wajib mau kerja di ketinggian.',
    dokumenShare: 'CV,JFT,SSW,SIM A',
    templateCv: null,
    pamflet: null,
    rincianBiaya: demoRincian(
      [
        'Tiket pesawat PP',
        'Visa kerja (COE)',
        'Asuransi kesehatan',
        'Training bahasa Jepang 3 bulan',
      ],
      ['Paspor', 'MCU (medical check up)'],
      ['Gaji pokok 185.000 yen ke atas', 'Tunjangan proyek', 'Alat kerja disediakan'],
      ['CV sesuai format ASJ', 'Sertifikat JFT/SSW (1 file PDF)', 'Scan SIM A'],
      [
        { nomor: 1, nama: 'TTD KONTRAK', nominal: 'Rp 5.000.000' },
        { nomor: 2, nama: 'COE TERBIT', nominal: 'Rp 12.000.000' },
        { nomor: 3, nama: 'VISA JADI', nominal: 'Rp 10.000.000' },
      ],
      'Rp 27.000.000',
    ),
    totalBiaya: 'Rp 27.000.000',
    createdAt: '2026-08-06T09:00:00.000Z',
  },
];

function demoGetAppData(mode) {
  const isAdmin = mode === 'admin';
  const jobs = isAdmin ? DEMO_JOBS : DEMO_JOBS.filter((j) => j.status !== 'CLOSE');
  return {
    success: true,
    jobs,
    dbJobs: DEMO_JOBS,
    candidates: [],
    candidatesTotal: 0,
    schedules: [],
    tugas: [],
    formInbox: [],
    waTemplates: [],
    kandidatRiwayat: [],
    dropdowns: {},
    assets: DEMO_ASSETS,
    pengumuman: DEMO_PREVIEW_NOTE,
  };
}

export { DEMO_JOBS, DEMO_ASSETS, DEMO_PREVIEW_NOTE, demoGetAppData };
