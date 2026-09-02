import { registerSeamAliases } from './core/bridge.ts';
// 10b. PEMBANGUN SECTION CV RIREKISHO (BAGIAN MURNI HTML)
// Dipisah dari renderCVAjaib (10_cv_rirekisho.js) saat god-object refactor.
// Tiap fungsi murni: terima data + helper v(), kembalikan HTML string.
// ==========================================

// ESM (Fase 3 langkah 12): modul ES — pemakai classic/bundel memanggil via
// window.* (10_cv_rirekisho.js renderCVAjaib). isGood/fmtMonthYearJp dari
// helpers_cv.js dipanggil eksplisit window.* (helpers_cv modul ES juga).

// --- BLOK PENDIDIKAN (maks 5 baris: 1-4 SD s/d universitas, baris 5 = LPK
// Bahasa). Baris 4-5 hanya dirender kalau ada isinya, jadi CV kandidat yang
// hanya punya 1-3 pendidikan tetap tampil sama seperti sebelumnya. ---
export function buildEduRows(eduList, v) {
  let eduHtml = '';
  for (let i = 1; i <= 5; i++) {
    let pE = Object.assign({}, eduList[i - 1] || {});
    // Toleransi dua bentuk kunci backend: {masuk,lulus,sekolah,jurusan_id}
    // (bentuk baru) vs {tahun_masuk,tahun_lulus,nama_sekolah,jurusan} (lama).
    if (!window.isGood(pE.masuk) && window.isGood(pE.tahun_masuk)) pE.masuk = pE.tahun_masuk;
    if (!window.isGood(pE.lulus) && window.isGood(pE.tahun_lulus)) pE.lulus = pE.tahun_lulus;
    if (!window.isGood(pE.sekolah) && window.isGood(pE.nama_sekolah)) pE.sekolah = pE.nama_sekolah;
    if (!window.isGood(pE.jurusan_id) && window.isGood(pE.jurusan)) pE.jurusan_id = pE.jurusan;
    let msk = window.isGood(pE.masuk) ? pE.masuk : v('PENDIDIKAN' + i + 'TAHUNMASUK');
    let lls = window.isGood(pE.lulus) ? pE.lulus : v('PENDIDIKAN' + i + 'TAHUNLULUS');
    let sek_id = window.isGood(pE.sekolah)
      ? pE.sekolah
      : v('PENDIDIKAN' + i + 'NAMASEKOLAH', 'PENDIDIKAN' + i + 'SEKOLAHID');
    let sek_jp = window.isGood(pE.sekolah_jp) ? pE.sekolah_jp : v('PENDIDIKAN' + i + 'SEKOLAHJP');
    let jur_id = window.isGood(pE.jurusan_id)
      ? pE.jurusan_id
      : v('PENDIDIKAN' + i + 'JURUSAN', 'PENDIDIKAN' + i + 'JURUSANID');
    let jur_jp = window.isGood(pE.jurusan_jp) ? pE.jurusan_jp : v('PENDIDIKAN' + i + 'JURUSANJP');

    if (msk === '-') msk = '';
    if (lls === '-') lls = '';
    if (sek_id === '-') sek_id = '';
    if (jur_id === '-') jur_id = '';
    if (sek_jp === '-') sek_jp = '';
    if (jur_jp === '-') jur_jp = '';
    // Baris tambahan (4-5) tanpa isi di-skip supaya tabel tidak melebar kosong
    // (cek SETELAH normalisasi '-' -> '' karena '-' masih truthy).
    if (i > 3 && !(sek_id || msk || lls)) continue;

    let finalSek = sek_jp
      ? sek_id + '<br><span style="font-size:8px; font-weight:normal;">' + sek_jp + '</span>'
      : sek_id;
    let finalJur = jur_jp
      ? jur_id + '<br><span style="font-size:8px; font-weight:normal;">' + jur_jp + '</span>'
      : jur_id;

    eduHtml += `<tr>
              <td class="val-center border-r-none">${window.fmtMonthYearJp(msk)}</td>
              <td class="val-center border-lr-none">${msk || lls ? '-' : ''}</td>
              <td class="val-center border-l-none">${window.fmtMonthYearJp(lls)}</td>
              <td colspan="2" class="val-center">${finalSek}</td>
              <td colspan="2" class="val-center">${finalJur}</td>
            </tr>`;
  }
  return eduHtml;
}

// --- BLOK PEKERJAAN (maks 3 baris: form master punya 3 kolom pekerjaan).
// Baris ke-3 hanya dirender kalau ada isinya, jadi CV kandidat dengan 1-2
// pekerjaan tetap tampil sama seperti sebelumnya. ---
export function buildJobRows(jobList, v) {
  let jobHtml = '';
  for (let i = 1; i <= 3; i++) {
    let pJ = Object.assign({}, jobList[i - 1] || {});
    // Toleransi dua bentuk kunci backend: {masuk,keluar,perusahaan} vs {tahun_masuk,tahun_keluar,nama_perusahaan}.
    if (!window.isGood(pJ.masuk) && window.isGood(pJ.tahun_masuk)) pJ.masuk = pJ.tahun_masuk;
    if (!window.isGood(pJ.keluar) && window.isGood(pJ.tahun_keluar)) pJ.keluar = pJ.tahun_keluar;
    if (!window.isGood(pJ.perusahaan) && window.isGood(pJ.nama_perusahaan))
      pJ.perusahaan = pJ.nama_perusahaan;
    let msk = window.isGood(pJ.masuk) ? pJ.masuk : v('PEKERJAAN' + i + 'TAHUNMASUK');
    let klr = window.isGood(pJ.keluar) ? pJ.keluar : v('PEKERJAAN' + i + 'TAHUNKELUAR');
    let pt_id = window.isGood(pJ.perusahaan)
      ? pJ.perusahaan
      : v('PEKERJAAN' + i + 'NAMAPERUSAHAAN', 'PEKERJAAN' + i + 'PERUSAHAANID');
    let pt_jp = window.isGood(pJ.perusahaan_jp)
      ? pJ.perusahaan_jp
      : v('PEKERJAAN' + i + 'PERUSAHAANJP');
    let ker_id = window.isGood(pJ.jabatan)
      ? pJ.jabatan
      : v(
          'PEKERJAAN' + i + 'JENISKERJA',
          'PEKERJAAN' + i + 'POSISI',
          'PEKERJAAN' + i + 'JABATANID',
        );
    let ker_jp = window.isGood(pJ.jabatan_jp) ? pJ.jabatan_jp : v('PEKERJAAN' + i + 'JABATANJP');
    let gaji = window.isGood(pJ.gaji) ? pJ.gaji : v('PEKERJAAN' + i + 'GAJI');

    if (msk === '-') msk = '';
    if (klr === '-') klr = '';
    if (pt_id === '-') pt_id = '';
    if (ker_id === '-') ker_id = '';
    if (gaji === '-') gaji = '';
    if (pt_jp === '-') pt_jp = '';
    if (ker_jp === '-') ker_jp = '';
    // Baris tambahan (ke-3) tanpa isi di-skip supaya tabel tidak melebar kosong
    // (cek SETELAH normalisasi '-' -> '' karena '-' masih truthy).
    if (i > 2 && !(pt_id || msk || klr)) continue;

    let klrFmt =
      klr.toUpperCase().includes('SEKARANG') || klr.toUpperCase().includes('IMA')
        ? '現在に至る'
        : window.fmtMonthYearJp(klr);
    let finalPt = pt_jp
      ? pt_id + '<br><span style="font-size:8px; font-weight:normal;">' + pt_jp + '</span>'
      : pt_id;
    let finalKer = ker_jp
      ? ker_id + '<br><span style="font-size:8px; font-weight:normal;">' + ker_jp + '</span>'
      : ker_id;

    jobHtml += `<tr>
              <td class="val-center border-r-none">${window.fmtMonthYearJp(msk)}</td>
              <td class="val-center border-lr-none">${msk || klr ? '-' : ''}</td>
              <td class="val-center border-l-none">${klrFmt}</td>
              <td colspan="2" class="val-center">${finalPt}</td>
              <td class="val-center">${finalKer}</td>
              <td class="val-right pr-1">${gaji ? '¥&nbsp;&nbsp;&nbsp;' + gaji : '¥&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-'}</td>
            </tr>`;
  }
  return jobHtml;
}

// --- BLOK KELUARGA (maks 6 baris) ---
export function buildFamRows(famList, v) {
  let famHtml = '';
  for (let i = 1; i <= 6; i++) {
    let kF = Object.assign({}, famList[i - 1] || {});
    // Toleransi dua bentuk kunci backend: {umur} vs {usia}.
    if (!window.isGood(kF.umur) && window.isGood(kF.usia)) kF.umur = kF.usia;
    let hub = window.isGood(kF.hubungan)
      ? kF.hubungan
      : v('KELUARGA' + i + 'HUBUNGANID', 'KELUARGA' + i + 'HUBUNGAN');
    let hub_jp = window.isGood(kF.hubungan_jp) ? kF.hubungan_jp : v('KELUARGA' + i + 'HUBUNGANJP');
    let nm = window.isGood(kF.nama) ? kF.nama : v('KELUARGA' + i + 'NAMA');
    let u = window.isGood(kF.umur) ? kF.umur : v('KELUARGA' + i + 'USIA', 'KELUARGA' + i + 'UMUR');
    let p = window.isGood(kF.pekerjaan)
      ? kF.pekerjaan
      : v('KELUARGA' + i + 'PEKERJAANID', 'KELUARGA' + i + 'PEKERJAAN');
    let p_jp = window.isGood(kF.pekerjaan_jp) ? kF.pekerjaan_jp : v('KELUARGA' + i + 'PEKERJAANJP');
    let g = window.isGood(kF.gaji) ? kF.gaji : v('KELUARGA' + i + 'GAJI');

    if (hub === '-') hub = '';
    if (nm === '-') nm = '';
    if (u === '-') u = '';
    if (p === '-') p = '';
    if (g === '-') g = '';
    if (hub_jp === '-') hub_jp = '';
    if (p_jp === '-') p_jp = '';

    let finalHub = hub_jp ? hub.toUpperCase() + '  ' + hub_jp : hub.toUpperCase();
    let finalPek = p_jp
      ? p + '<br><span style="font-size:8px; font-weight:normal;">' + p_jp + '</span>'
      : p;

    famHtml += `<tr>
              <td colspan="2" class="val-center">${finalHub}</td>
              <td colspan="2" class="val-center">${nm.toUpperCase()}</td>
              <td class="val-center">${u ? u + '歳' : ''}</td>
              <td class="val-center">${finalPek}</td>
              <td class="val-right pr-1">${g ? '¥&nbsp;&nbsp;&nbsp;' + g : '¥&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-'}</td>
            </tr>`;
  }
  return famHtml;
}

// --- NILAI IDENTITAS (gender/nikah/jpn/paspor/tangan/goldar/no) ---
export function buildCvIdentitas(v) {
  let gen = String(v('GENDER', 'JENISKELAMIN', 'identitas.gender')).toUpperCase();
  // Perempuan: PEREMPUAN/WANITA/CEWEK/W/女; jangan tangkap 'PRIA' (punya huruf P)
  let genderStr =
    gen.includes('PEREMPUAN') ||
    gen.includes('WANITA') ||
    gen.includes('CEWEK') ||
    gen.includes('女') ||
    gen === 'W'
      ? 'PEREMPUAN (女)'
      : gen === '-'
        ? ''
        : 'LAKI LAKI (男)';

  let nikah = String(
    v(
      'STATUSPERNIKAHAN',
      'STATUSNIKAH',
      'PASANGAN',
      'identitas.status_nikah',
      'identitas.status_nikah_id',
    ),
  ).toUpperCase();
  let nikahStr =
    nikah.includes('MENIKAH') && !nikah.includes('BELUM')
      ? 'MENIKAH （既婚）'
      : nikah === '-'
        ? ''
        : 'BELUM MENIKAH （未婚）';

  // "BELUM PERNAH" / "TIDAK" / kosong -> TIDAK (無); yang lain (EKS MAGANG,
  // EKS TOKUTEI GINO, YA, ADA) -> ADA (有). Cek BELUM/TIDAK dulu karena
  // 'BELUM PERNAH' mengandung 'PERNAH' (cek naif lama salah tampil ADA).
  let jpn = String(
    v('PERNAHKEJEPANG', 'PENGALAMANJEPANG', 'STATUSEKSJEPANG', 'wawancara.riwayat_jepang'),
  ).toUpperCase();
  let jpnStr =
    !jpn || jpn === '-' || jpn.includes('BELUM') || jpn.includes('TIDAK') || jpn === 'NO'
      ? jpn === '-'
        ? ''
        : 'TIDAK （無）'
      : 'ADA （有）';

  let pspr = String(v('PASPOR', 'PASPORT', 'identitas.paspor')).toUpperCase();
  let psprStr =
    pspr.includes('YA') || pspr.includes('ADA') || pspr.length > 5 ? 'ADA （有）' : 'TIDAK （無）';

  let tgn = String(v('TANGANDOMINAN', 'TANGAN', 'fisik.tangan_dominan')).toUpperCase();
  let tgnStr = tgn.includes('KIRI') ? 'KIRI (左)' : tgn === '-' ? '' : 'KANAN  (右)';

  let goldar = v('GOLONGANDARAH', 'GOLDAR', 'identitas.golongan_darah');
  if (goldar === '-') goldar = '';

  // Nomor 実習生 dari id_kandidat (mis. ASJ-20260801-6160 -> P-6160)
  let noRirekisho = v('id_kandidat', 'IDKANDIDAT', 'NOMOR', 'ID');
  if (noRirekisho !== '-') {
    let m = String(noRirekisho).match(/(\d{3,})$/);
    noRirekisho = m ? 'P - ' + m[1] : noRirekisho;
  } else {
    noRirekisho = '';
  }
  return { genderStr, nikahStr, jpnStr, psprStr, tgnStr, goldar, noRirekisho };
}

// --- TEMPLATE KERTAS A4 (100% IDENTIK GAMBAR) ---
export function buildCvKertasA4(p) {
  const {
    v,
    fotoHtml,
    btnPrintHtml,
    tglFormat,
    waTarget,
    genderStr,
    nikahStr,
    jpnStr,
    psprStr,
    tgnStr,
    goldar,
    noRirekisho,
    eduHtml,
    jobHtml,
    famHtml,
  } = p;
  let html = `
            ${btnPrintHtml}
            <style>
                @media print {
                    @page { size: A4 portrait; margin: 6mm; }
                    body * { visibility: hidden !important; }
                    #modal-preview-cv, #modal-preview-cv * { visibility: visible !important; color: black !important; }
                    #modal-preview-cv {
                        position: absolute !important; left: 0 !important; top: 0 !important;
                        width: 100% !important; height: auto !important; background: white !important;
                        padding: 0 !important; margin: 0 !important;
                        overflow: visible !important; display: block !important;
                    }
                    #modal-preview-cv > div {
                        max-width: 100% !important; box-shadow: none !important;
                        margin: 0 !important; padding: 0 !important;
                    }
                    #cv-kertas-a4 { padding: 0 !important; }
                    .print\\:hidden { display: none !important; }
                    * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
                    .cv-excel tr { page-break-inside: avoid; }
                }
                
                .cv-excel { 
                    width: 100%; border-collapse: collapse; border: 1.5px solid black; 
                    font-family: 'Arial', sans-serif; font-size: 10px; font-weight: bold; color: black; line-height: 1.2; 
                }
                .cv-excel th, .cv-excel td { 
                    border: 1px solid black; padding: 3.5px 4px; vertical-align: middle; 
                }
                .bg-amber { background-color: #faeec8 !important; } /* Warna kuning pucat khas Rirekisho */
                .val-center { text-align: center !important; }
                .val-left { text-align: left !important; padding-left: 8px !important; }
                .val-right { text-align: right !important; }
                .border-r-none { border-right: none !important; }
                .border-l-none { border-left: none !important; }
                .border-lr-none { border-left: none !important; border-right: none !important; }
                
                /* Pengaturan Kolom (Total 7 Kolom Utama untuk kemudahan mapping colspans) */
                .col-1 { width: 13%; }  /* Tanggal Mulai / Foto */
                .col-2 { width: 2%; }   /* Strip (-) / Foto */
                .col-3 { width: 11%; }  /* Tanggal Selesai / Foto */
                .col-4 { width: 19%; }  /* Label 1 */
                .col-5 { width: 21%; }  /* Value 1 */
                .col-6 { width: 18%; }  /* Label 2 */
                .col-7 { width: 16%; }  /* Value 2 */
            </style>
            
            <div style="text-align: center; font-weight: bold; font-size: 22px; letter-spacing: 2px;">実習生経歴書</div>
            <div style="text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 2px;">DAFTAR RIWAYAT HIDUP</div>
            <div style="text-align: right; font-size: 10px; font-style: italic; margin-bottom: 2px;">Ver.2025</div>
            
            <table class="cv-excel">
                <colgroup>
                    <col class="col-1"><col class="col-2"><col class="col-3">
                    <col class="col-4"><col class="col-5"><col class="col-6"><col class="col-7">
                </colgroup>
                
                <!-- BLOK FOTO + IDENTITAS -->
                <tr>
                    <td colspan="3" rowspan="11" style="padding: 0; vertical-align: top;">
                        ${fotoHtml}
                    </td>
                    <td class="bg-amber val-center">実習生 NOMOR<br>番号</td>
                    <td class="val-center">${noRirekisho}</td>
                    <td class="bg-amber val-center">性別&nbsp;&nbsp;&nbsp;JENIS KELAMIN</td>
                    <td class="val-center">${genderStr}</td>
                </tr>
                <tr>
                    <td colspan="2" class="bg-amber val-center">名前&nbsp;&nbsp;&nbsp;NAMA</td>
                    <td class="bg-amber val-center">年齢&nbsp;&nbsp;&nbsp;USIA</td>
                    <td class="val-center">${v('USIA', 'UMUR', 'identitas.umur').replace(/\D/g, '')} 歳</td>
                </tr>
                <tr>
                    <td colspan="2" class="val-center uppercase" style="font-size:12px;"><i>${v('NAMALENGKAP', 'NAMA', 'identitas.nama_lengkap')}</i></td>
                    <td class="bg-amber val-center">身長&nbsp;&nbsp;&nbsp;TINGGI BADAN</td>
                    <td class="val-center">${v('TB', 'TINGGI', 'fisik.tb').replace(/\D/g, '')} CM</td>
                </tr>
                <tr>
                    <td colspan="2" class="val-center" style="font-size:11px;"><i>${v('FURIGANA', 'KATAKANA', 'NAMAKATAKANA', 'identitas.katakana')}</i></td>
                    <td class="bg-amber val-center">体重&nbsp;&nbsp;&nbsp;BERAT BADAN</td>
                    <td class="val-center">${v('BB', 'BERAT', 'fisik.bb').replace(/\D/g, '')} KG</td>
                </tr>
                <tr>
                    <td class="bg-amber val-center leading-tight">NAMA PANGGILAN<br>ニックネーム</td>
                    <td class="val-center leading-tight"><i>${v('NAMAPANGGILAN', 'PANGGILAN', 'PANGGILANID', 'identitas.panggilan')} <br> ${v('PANGGILANKATAKANA', 'KATAKANAPANGGILAN', 'PANGGILANJP', 'identitas.panggilan_katakana')}</i></td>
                    <td class="bg-amber val-center">血液型&nbsp;&nbsp;&nbsp;GOLONGAN DARAH</td>
                    <td class="val-center">${goldar} 型</td>
                </tr>
                <tr>
                    <td colspan="2" class="bg-amber val-center">生年月日&nbsp;&nbsp;&nbsp;TANGGAL LAHIR</td>
                    <td class="bg-amber val-center">配偶者&nbsp;&nbsp;&nbsp;STATUS PERNIKAHAN</td>
                    <td class="val-center">${nikahStr}</td>
                </tr>
                <tr>
                    <td colspan="2" class="val-center"><i>${tglFormat}</i></td>
                    <td class="bg-amber val-center">宗教&nbsp;&nbsp;&nbsp;AGAMA</td>
                    <td class="val-center">${v('AGAMA', 'AGAMAID', 'AGAMAJP', 'identitas.agama')}</td>
                </tr>
                <tr>
                    <td colspan="2" class="bg-amber val-center">出身地&nbsp;&nbsp;&nbsp;TEMPAT LAHIR</td>
                    <td class="bg-amber val-center">来日経験&nbsp;&nbsp;&nbsp;PERNAH KE JEPANG</td>
                    <td class="val-center">${jpnStr}</td>
                </tr>
                <tr>
                    <td colspan="2" class="val-center uppercase"><i>${v('TEMPATLAHIR', 'TEMPATLAHIRID', 'identitas.tempat_lahir_id', 'identitas.tempat_lahir')}</i></td>
                    <td class="bg-amber val-center leading-tight">パスポート番号<br>PERNAH MEMILIKI PASPOR</td>
                    <td class="val-center">${psprStr}</td>
                </tr>
                <tr>
                    <td colspan="2" class="val-center"><i>${v('TEMPATLAHIRJP', 'identitas.tempat_lahir_jp') === '-' ? '' : v('TEMPATLAHIRJP', 'identitas.tempat_lahir_jp')}</i></td>
                    <td class="bg-amber val-center">利き手&nbsp;&nbsp;&nbsp;TANGAN AHLI</td>
                    <td class="val-center">${tgnStr}</td>
                </tr>
                <tr>
                    <td class="bg-amber val-center">携帯電話番号&nbsp;&nbsp;&nbsp;NO HP</td>
                    <td class="val-center">+${waTarget.replace(/\D/g, '')}</td>
                    <td class="bg-amber val-center leading-tight">病歴の有無&nbsp;RIWAYAT PENYAKIT<br>(KERAS, LUKA DLL)</td>
                    <td class="val-center">${v('RIWAYATPENYAKIT', 'RIWAYATPENYAKITID', 'RIWAYATMEDISID', 'medis.riwayat_medis_id') === '-' ? 'TIDAK (無)' : v('RIWAYATPENYAKIT', 'RIWAYATPENYAKITID', 'RIWAYATMEDISID', 'medis.riwayat_medis_id')}</td>
                </tr>
                
                <!-- BLOK ALAMAT -->
                <tr><td colspan="7" class="bg-amber val-center">通信欄 ALAMAT RUMAH</td></tr>
                <tr><td colspan="7" class="val-center uppercase font-normal">${v('ALAMATLENGKAP', 'ALAMAT', 'ALAMATID', 'identitas.alamat_id', 'identitas.alamat')}</td></tr>
                <tr><td colspan="7" class="val-center font-normal"><i>${v('ALAMATJP', 'identitas.alamatjp', 'identitas.alamat_jp') === '-' ? '' : v('ALAMATJP', 'identitas.alamatjp', 'identitas.alamat_jp')}</i></td></tr>
                
                <!-- BLOK PENDIDIKAN -->
                <tr><td colspan="7" class="bg-amber val-center">学歴 PENDIDIKAN</td></tr>
                <tr>
                    <td colspan="3" class="bg-amber val-center">期間 TAHUN</td>
                    <td colspan="2" class="bg-amber val-center">学校名 NAMA SEKOLAH</td>
                    <td colspan="2" class="bg-amber val-center">専攻 JURUSAN</td>
                </tr>
                ${eduHtml}
                
                <!-- BLOK PENGALAMAN -->
                <tr><td colspan="7" class="bg-amber val-center">職歴 PENGALAMAN KERJA </td></tr>
                <tr>
                    <td colspan="3" class="bg-amber val-center">期間 TAHUN</td>
                    <td colspan="2" class="bg-amber val-center">会社名 NAMA PERUSAHAAN</td>
                    <td class="bg-amber val-center">職種 JENIS KERJA</td>
                    <td class="bg-amber val-center">月収/円 GAJI</td>
                </tr>
                ${jobHtml}
                
                <!-- BLOK KELUARGA -->
                <tr><td colspan="7" class="bg-amber val-center">家族構成 SUSUNAN KELUARGA KANDUNG </td></tr>
                <tr>
                    <td colspan="2" class="bg-amber val-center">続柄 URUTAN KELUARGA</td>
                    <td colspan="2" class="bg-amber val-center">名前 NAMA ANGGOTA KELUARGA</td>
                    <td class="bg-amber val-center">年齢 USIA</td>
                    <td class="bg-amber val-center">職業 PEKERJAAN</td>
                    <td class="bg-amber val-center">月収/円 GAJI</td>
                </tr>
                ${famHtml}
                
                <!-- BLOK INFORMASI PERSONAL -->
                <tr><td colspan="7" class="bg-amber val-center">個人情報 INFORMASI PERSONAL </td></tr>
                <tr>
                    <td colspan="3" class="bg-amber val-left">日本へ行く目的&nbsp;&nbsp;&nbsp;TUJUAN KE<br>JEPANG</td>
                    <td colspan="4" class="val-center font-normal">
                        ${v('wawancara.tujuan_ke_jepang_jp', 'TUJUANKEJEPANGJP', 'MOTIVASIKEJEPANGJP', 'MOTIVASIJP', 'wawancara.motivasi_jp')} <br>
                        ${v('wawancara.tujuan_ke_jepang', 'TUJUANKEJEPANG', 'MOTIVASIKEJEPANG', 'MOTIVASIID', 'wawancara.motivasi_id')}
                    </td>
                </tr>
                <tr>
                    <td colspan="3" class="bg-amber val-left">帰国後の目標<br>SETELAH PULANG DARI JEPANG</td>
                    <td colspan="4" class="val-center font-normal">
                        ${v('wawancara.rencana_pulang_jp', 'RENCANAPULANGJP')} <br>
                        ${v('wawancara.rencana_pulang_id', 'RENCANAPULANGID', 'RENCANASETELAHPULANG')}
                    </td>
                </tr>
                <tr>
                    <td colspan="3" class="bg-amber val-left">長所&nbsp;&nbsp;&nbsp;KELEBIHAN</td>
                    <td colspan="4" class="val-center font-normal">
                        ${v('KELEBIHANJP', 'wawancara.kelebihan_jp')} <br>
                        ${v('KELEBIHAN', 'KELEBIHANID', 'wawancara.kelebihan_id')}
                    </td>
                </tr>
                <tr>
                    <td colspan="3" class="bg-amber val-left">短所&nbsp;&nbsp;&nbsp;KEKURANGAN</td>
                    <td colspan="4" class="val-center font-normal">
                        ${v('KEKURANGANJP', 'wawancara.kekurangan_jp')} <br>
                        ${v('KEKURANGAN', 'KEKURANGANID', 'wawancara.kekurangan_id')}
                    </td>
                </tr>
                <tr>
                    <td colspan="3" class="bg-amber val-left">趣味&nbsp;&nbsp;&nbsp;HOBI</td>
                    <td colspan="4" class="val-center font-normal">
                        ${v('HOBIJP', 'wawancara.hobi_jp')} <br>
                        ${v('HOBI', 'HOBIID', 'wawancara.hobi_id')}
                    </td>
                </tr>
                
                <!-- BLOK SERTIFIKAT -->
                <tr><td colspan="7" class="bg-amber val-center">資格・免許 SERTIFIKAT YANG DIMILIKI</td></tr>
                <tr>
                    <td colspan="2" class="bg-amber val-center leading-tight">日本語能力試験<br>JLPT/ SETARA</td>
                    <td class="val-center">${v('sertifikasi.bahasa_jepang', 'sertifikasi.nilai', 'JLPT', 'JFT', 'JFTTEXT', 'BAHASAJEPANG') === '-' ? 'TIDAK (無)' : v('sertifikasi.bahasa_jepang', 'sertifikasi.nilai', 'JLPT', 'JFT', 'JFTTEXT', 'BAHASAJEPANG')}</td>
                    <td class="bg-amber val-center leading-tight">運転免許&nbsp;&nbsp;&nbsp;SURAT IZIN<br>MENGEMUDI (SIM A)</td>
                    <td class="val-center">${v('identitas.sim', 'SIM') === '-' ? 'TIDAK (無)' : v('identitas.sim', 'SIM')}</td>
                    <td class="bg-amber val-center leading-tight">他&nbsp;&nbsp;&nbsp;LAIN - LAIN</td>
                    <td class="val-center">${v('sertifikasi.lisensi', 'SSW', 'SSWTEXT', 'LISENSI') === '-' ? '-' : v('sertifikasi.lisensi', 'SSW', 'SSWTEXT', 'LISENSI')}</td>
                </tr>
                
                <!-- BLOK KONTAK DI JEPANG -->
                <tr><td colspan="7" class="bg-amber val-center">在日親戚・知人 KERABAT / KENALAN DI JEPANG</td></tr>
                <tr>
                    <td colspan="2" class="bg-amber val-center">名前 NAMA</td>
                    <td class="bg-amber val-center">関係 HUBUNGAN</td>
                    <td class="bg-amber val-center">職業 PEKERJAAN</td>
                    <td class="bg-amber val-center">年齢 USIA</td>
                    <td colspan="2" class="bg-amber val-center">日本の住所 ALAMAT DI JEPANG</td>
                </tr>
                <tr>
                    <td colspan="2" class="val-center font-normal">
                        ${v('kenalan_jepang.nama_jp', 'KENALANNAMAJP') === '-' ? '無し' : v('kenalan_jepang.nama_id', 'KENALANNAMAID', 'KENALANDIJEPANGNAMA') + '<br>' + v('kenalan_jepang.nama_jp', 'KENALANNAMAJP')}
                    </td>
                    <td class="val-center font-normal">${v('kenalan_jepang.hubungan_jp', 'KENALANHUBJP') === '-' ? v('kenalan_jepang.hubungan_id', 'KENALANHUBID', 'KENALANDIJEPANGHUBUNGAN') : v('kenalan_jepang.hubungan_id', 'KENALANHUBID', 'KENALANDIJEPANGHUBUNGAN') + '<br>' + v('kenalan_jepang.hubungan_jp', 'KENALANHUBJP')}</td>
                    <td class="val-center font-normal">${v('kenalan_jepang.pekerjaan_jp', 'KENALANKERJAJP') === '-' ? v('kenalan_jepang.pekerjaan_id', 'KENALANKERJAID', 'KENALANDIJEPANGPEKERJAAN') : v('kenalan_jepang.pekerjaan_id', 'KENALANKERJAID', 'KENALANDIJEPANGPEKERJAAN') + '<br>' + v('kenalan_jepang.pekerjaan_jp', 'KENALANKERJAJP')}</td>
                    <td class="val-center font-normal">${v('kenalan_jepang.usia', 'KENALANUSIA', 'KENALANDIJEPANGUSIA') === '-' ? '' : v('kenalan_jepang.usia', 'KENALANUSIA', 'KENALANDIJEPANGUSIA')}</td>
                    <td colspan="2" class="val-center font-normal">${v('kenalan_jepang.alamat_jp', 'KENALANALAMATJP') === '-' ? v('kenalan_jepang.alamat_id', 'KENALANALAMATID', 'KENALANDIJEPANGALAMAT') : v('kenalan_jepang.alamat_id', 'KENALANALAMATID', 'KENALANDIJEPANGALAMAT') + '<br>' + v('kenalan_jepang.alamat_jp', 'KENALANALAMATJP')}</td>
                </tr>
                
                <!-- CATATAN TAMBAHAN -->
                <tr>
                    <td colspan="3" class="bg-amber val-center">付記&nbsp;&nbsp;&nbsp;CATATAN TAMBAHAN</td>
                    <td colspan="4" class="val-left font-normal" style="height: 25px;">${v('CATATANTAMBAHAN', 'CATATAN') === '-' ? '' : v('CATATANTAMBAHAN', 'CATATAN')}</td>
                </tr>
            </table>
        `;
  return html;
}

// BRIDGE ESM → classic (bundel): dipanggil 10_cv_rirekisho.js (renderCVAjaib)
// via window.* — alias data property (builder murni, tidak pernah di-reassign).
registerSeamAliases({
  buildEduRows,
  buildJobRows,
  buildFamRows,
  buildCvIdentitas,
  buildCvKertasA4,
});
