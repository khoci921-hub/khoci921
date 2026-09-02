// ke js/pages/master_full.js. ESM (Fase 3 langkah 13): modul ES dimuat
// <script type="module"> — export + alias window.* utk HTML inline
// (changeStep/gateLogin/handleFile/onSswSelect/submitMaster) & onchange string
// yang di-generate window.onload (toggleImaMade/onPekerjaanSelect/
// onFamPekerjaanSelect). CURRENT_LANG/renderLanguageLight/tr/callAPI/
// cekUploadFile via window.* eksplisit.
// ==========================================
// MASTER FULL — form master 5 langkah + gerbang login kandidat + auto-fill
// ==========================================
// ENTRY ESM (Fase 3.5 Langkah 6): halaman meng-import core lewat bridge.js
// (i18n + api-client) dan mendaftarkan alias seam HTML↔JS TERPUSAT via
// registerSeamAliases — bukan window.X = X per baris.
import { registerSeamAliases } from '../core/bridge.ts';
import { uploadToCloudinary } from '../cloudinary.ts';

// Bahasa terpilih (asj_lang) ikut serta; label statis diterjemahkan onload.
document.addEventListener('DOMContentLoaded', function () {
  var lb = document.getElementById('lang-btn-mf');
  if (lb) lb.textContent = window.CURRENT_LANG === 'jp' ? 'ID' : 'JP';
  if (typeof window.renderLanguageLight === 'function') window.renderLanguageLight();
});
// FASE 3/4: WA/NAMA dulu diisi server (GAS scriptlet) dari e.parameter.
// Sekarang dibaca dari query string URL (?wa=&nama=), sumbernya sama
// persis (link dari generateLegacyMasterBridge()), cuma dibaca browser.
(function () {
  function cleanPhoneJS(wa) {
    if (!wa) return '';
    var s = String(wa).replace(/\D/g, '');
    if (s.startsWith('0')) s = '62' + s.substring(1);
    else if (s.startsWith('8')) s = '62' + s;
    return s;
  }
  var p = new URLSearchParams(window.location.search);
  var wa = cleanPhoneJS(p.get('wa') || '');
  var nama = (p.get('nama') || '').trim();
  var wad = document.getElementById('wa-display');
  if (wad) wad.textContent = wa;
  var wai = document.getElementById('wa');
  if (wai) wai.value = wa;
  var nm = document.getElementById('nama');
  if (nm) nm.value = nama;
})();

let currentStep = 1;
const totalSteps = 5;

const getEl = (id) => document.getElementById(id);
const setVal = (id, val) => {
  if (getEl(id) && val) getEl(id).value = val;
};
const formatDate = (ds) => {
  if (!ds) return '';
  try {
    let d = new Date(ds);
    if (isNaN(d.getTime() as number)) return ds;
    return d.toISOString().split('T')[0];
  } catch (e) {
    return ds;
  }
};

export function toggleImaMade(i) {
  let outEl = getEl(`job_out_${i}`);
  let chk = getEl(`job_now_${i}`).checked;
  if (chk) {
    outEl.value = '';
    outEl.disabled = true;
  } else {
    outEl.disabled = false;
  }
}

// ===== GERBANG LOGIN KANDIDAT (session asli dari server) =====
function getCandidateSession() {
  return localStorage.getItem('asj_kandidat_session') || '';
}
function showLoginGate(msg) {
  let gwa = document.getElementById('gate-wa');
  if (gwa) gwa.textContent = getEl('wa').value || '';
  let gm = document.getElementById('gate-msg');
  if (gm) gm.textContent = msg || '';
  let gate = document.getElementById('login-gate');
  if (gate) gate.classList.remove('hidden');
  let pass = document.getElementById('gate-pass');
  if (pass) {
    pass.value = '';
    pass.focus();
  }
  window.renderLanguageLight();
}
function hideLoginGate() {
  let gate = document.getElementById('login-gate');
  if (gate) gate.classList.add('hidden');
}
export async function gateLogin() {
  let wa = getEl('wa').value;
  let pass = document.getElementById('gate-pass') ? document.getElementById('gate-pass').value : '';
  let btn = document.getElementById('gate-btn');
  let msg = document.getElementById('gate-msg');
  if (!pass) {
    if (msg) msg.textContent = window.tr('form.mf_gate_pw_wajib');
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = window.tr('form.mf_memeriksa');
  }
  try {
    let res = await window.callAPI('loginKandidat', [wa, pass]);
    if (res && res.success) {
      localStorage.setItem('asj_kandidat_login', 'sukses');
      localStorage.setItem('asj_kandidat_name', res.nama || '');
      localStorage.setItem('asj_kandidat_wa', res.wa || wa);
      localStorage.setItem('asj_kandidat_session', res.sessionToken || '');
      hideLoginGate();
      window.location.reload();
    } else {
      if (msg) msg.textContent = (res && res.error) || window.tr('form.mf_gagal_masuk');
    }
  } catch (e) {
    if (msg) msg.textContent = window.tr('alert.network') + (e && e.message ? e.message : e);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = window.tr('form.mf_masuk');
    }
  }
}

// ===== DAFTAR DROPDOWN DWI BAHASA (ID/JP) =====
// 16 bidang SSW (Tokutei Ginou) resmi di Indonesia.
var SSW_LIST = [
  ['KAIGO', 'KAIGO (介護)'],
  ['BUILDING CLEANING', 'BUILDING CLEANING (ビルクリーニング)'],
  ['FOUNDRY & PLASTIC', 'FOUNDRY & PLASTIC (素形材産業)'],
  ['INDUSTRIAL MACHINERY', 'INDUSTRIAL MACHINERY (産業機械製造業)'],
  ['ELECTRIC & ELECTRONIC', 'ELECTRIC & ELECTRONIC (電気・電子情報)'],
  ['CONSTRUCTION', 'CONSTRUCTION (建設)'],
  ['SHIPBUILDING', 'SHIPBUILDING (造船・舶用工業)'],
  ['AUTOMOBILE REPAIR', 'AUTOMOBILE REPAIR (自動車整備)'],
  ['AVIATION', 'AVIATION (航空)'],
  ['ACCOMMODATION', 'ACCOMMODATION (宿泊)'],
  ['AGRICULTURE', 'AGRICULTURE (農業)'],
  ['FISHERY', 'FISHERY (漁業)'],
  ['FOOD & BEVERAGE', 'FOOD & BEVERAGE (飲食料品製造業)'],
  ['RESTAURANT', 'RESTAURANT (外食業)'],
  ['FORESTRY', 'FORESTRY (林業)'],
  ['WOOD INDUSTRY', 'WOOD INDUSTRY (木材産業)'],
];
// Pekerjaan umum di Indonesia (Jabatan / Posisi).
var PEKERJAAN_LIST = [
  ['OPERATOR PRODUKSI', 'OPERATOR PRODUKSI (工場作業員)'],
  ['ADMIN / STAFF ADMIN', 'ADMIN / STAFF ADMIN (事務員)'],
  ['SALES / MARKETING', 'SALES / MARKETING (営業)'],
  ['KASIR', 'KASIR (レジ係)'],
  ['KOKI / CHEF', 'KOKI / CHEF (調理師)'],
  ['PELAYAN / WAITER', 'PELAYAN / WAITER (ウェイター)'],
  ['CLEANING SERVICE', 'CLEANING SERVICE (清掃員)'],
  ['SATPAM / SECURITY', 'SATPAM / SECURITY (警備員)'],
  ['SOPIR / DRIVER', 'SOPIR / DRIVER (運転手)'],
  ['BURUH PABRIK', 'BURUH PABRIK (工場労働者)'],
  ['KARYAWAN SWASTA', 'KARYAWAN SWASTA (会社員)'],
  ['PEGAWAI TOKO', 'PEGAWAI TOKO (店員)'],
  ['GURU / PENGAJAR', 'GURU / PENGAJAR (教師)'],
  ['PERAWAT', 'PERAWAT (看護師)'],
  ['MEKANIK', 'MEKANIK (整備士)'],
  ['TEKNISI', 'TEKNISI (技術者)'],
  ['WELDER / LAS', 'WELDER / LAS (溶接工)'],
  ['TUKANG BANGUNAN', 'TUKANG BANGUNAN (建設作業員)'],
  ['PETANI / PERKEBUNAN', 'PETANI / PERKEBUNAN (農業)'],
  ['NELAYAN', 'NELAYAN (漁師)'],
  ['RESEPSIONIS', 'RESEPSIONIS (受付)'],
  ['BARISTA', 'BARISTA (バリスタ)'],
  ['IBU RUMAH TANGGA', 'IBU RUMAH TANGGA (主婦)'],
  ['PELAJAR / MAHASISWA', 'PELAJAR / MAHASISWA (学生)'],
  ['BELUM BEKERJA', 'BELUM BEKERJA (無職)'],
];
function sswOptionsHtml() {
  var h = '<option value="">Pilih / 選択</option>';
  SSW_LIST.forEach(function (pair) {
    h += '<option value="' + pair[0] + '">' + pair[1] + '</option>';
  });
  h += '<option value="__LAINNYA__">✍️ Lainnya / その他 (ketik manual)</option>';
  return h;
}
function pekerjaanOptionsHtml() {
  var h = '<option value="">Pilih / 選択</option>';
  PEKERJAAN_LIST.forEach(function (pair) {
    h += '<option value="' + pair[0] + '">' + pair[1] + '</option>';
  });
  h += '<option value="__LAINNYA__">✍️ Lainnya / その他 (ketik manual)</option>';
  return h;
}
function buildSswSelect(id) {
  var el = getEl(id);
  if (el) el.innerHTML = sswOptionsHtml();
}
export function onSswSelect(id) {
  var sel = getEl(id),
    manual = getEl(id + '_manual');
  if (!sel) return;
  if (sel.value === '__LAINNYA__') {
    if (manual) {
      manual.classList.remove('hidden');
      manual.focus();
    }
  } else if (manual) {
    manual.classList.add('hidden');
    manual.value = '';
  }
}
export function onPekerjaanSelect(i) {
  var sel = getEl('job_pos_' + i),
    manual = getEl('job_pos_manual_' + i);
  if (!sel) return;
  if (sel.value === '__LAINNYA__') {
    if (manual) {
      manual.classList.remove('hidden');
      manual.focus();
    }
  } else if (manual) {
    manual.classList.add('hidden');
    manual.value = '';
  }
}
export function onFamPekerjaanSelect(i) {
  var sel = getEl('fam_job_' + i),
    manual = getEl('fam_job_manual_' + i);
  if (!sel) return;
  if (sel.value === '__LAINNYA__') {
    if (manual) {
      manual.classList.remove('hidden');
      manual.focus();
    }
  } else if (manual) {
    manual.classList.add('hidden');
    manual.value = '';
  }
}
// Isi dropdown dari data lama: kalau nilai tidak ada di daftar, tampilkan
// di kotak manual (nilai lama TIDAK hilang saat disimpan ulang).
function fillManualSelect(sel, manual, value) {
  if (!sel) return;
  var match = false;
  for (var k = 0; k < sel.options.length; k++) {
    if (sel.options[k].value === value) match = true;
  }
  if (value && !match) {
    sel.value = '__LAINNYA__';
    if (manual) {
      manual.value = value;
      manual.classList.remove('hidden');
    }
  } else {
    sel.value = value || '';
    if (manual) {
      manual.classList.add('hidden');
      manual.value = '';
    }
  }
}
function readManualSelect(sel, manual) {
  if (!sel) return '';
  if (sel.value === '__LAINNYA__') return manual ? manual.value.trim() : '';
  return sel.value;
}

window.onload = function () {
  try {
    // RENDER EDU (MONTH)
    let eduHtml = '';
    for (let i = 1; i <= 5; i++) {
      let boxTitle =
        i === 5 ? 'LPK Bahasa Jepang (日本語学校)' : window.tr('form.mf_pendidikan_n') + ' ' + i;
      let lpkSel = i === 5 ? ' selected' : '';
      eduHtml += `<div class="dynamic-box"><div class="box-title">${boxTitle}</div>
                    <div class="row mb-3"><div><label class="label">${window.tr('form.mf_tingkat')}</label><select id="edu_tk_${i}" class="input py-2"><option value="">Pilih / 選択</option><option value="SD">SD</option><option value="SMP">SMP</option><option value="SMA/SMK">SMA/SMK</option><option value="D3/S1">D3/S1</option><option value="LPK BAHASA"${lpkSel}>LPK BAHASA (日本語学校)</option></select></div>
                    <div><label class="label">${window.tr('form.mf_nama_sekolah')}</label><input id="edu_nm_${i}" class="input py-2"></div></div>
                    <div class="form-group mb-3"><label class="label">${window.tr('form.mf_jurusan')}</label><input id="edu_jur_${i}" class="input py-2" placeholder="${window.tr('form.mf_ph_jurusan')}"></div>
                    <div class="row"><div><label class="label">${window.tr('form.mf_masuk_bulan')}</label><input id="edu_in_${i}" type="month" class="input py-2"></div>
                    <div><label class="label">${window.tr('form.mf_lulus')}</label><input id="edu_out_${i}" type="month" class="input py-2"></div></div></div>`;
    }
    if (getEl('edu-container')) getEl('edu-container').innerHTML = eduHtml;

    // RENDER JOB (MONTH + IMA MADE)
    let jobHtml = '';
    for (let i = 1; i <= 3; i++) {
      jobHtml += `<div class="dynamic-box"><div class="box-title">${window.tr('form.mf_pekerjaan_n')} ${i}</div>
                    <div class="form-group mb-3"><label class="label">${window.tr('form.mf_perusahaan')}</label><input id="job_nm_${i}" class="input py-2"></div>
                    <div class="row mb-3"><div><label class="label">${window.tr('form.mf_masuk_bulan')}</label><input id="job_in_${i}" type="month" class="input py-2"></div>
                    <div><label class="label">${window.tr('form.mf_keluar')}</label><input id="job_out_${i}" type="month" class="input py-2">
                    <div class="mt-2"><label class="text-[11px] text-sky-400 font-bold flex items-center gap-1 cursor-pointer"><input type="checkbox" id="job_now_${i}" onchange="toggleImaMade(${i})" class="w-4 h-4 accent-sky-500"> ${window.tr('form.mf_ima_made')}</label></div></div></div>
                    <div class="row">
                        <div class="form-group"><label class="label">${window.tr('form.mf_jabatan')}</label><select id="job_pos_${i}" class="input py-2" onchange="onPekerjaanSelect(${i})"></select><input id="job_pos_manual_${i}" class="input py-2 hidden mt-2" placeholder="${window.tr('form.mf_ph_jabatan_lain')}"></div>
                        <div class="form-group"><label class="label">${window.tr('form.mf_gaji_terakhir')}</label><input id="job_sal_${i}" type="number" class="input py-2" placeholder="${window.tr('form.mf_ph_sal')}"></div>
                    </div></div>`;
    }
    if (getEl('job-container')) getEl('job-container').innerHTML = jobHtml;
    for (let i = 1; i <= 3; i++) {
      if (getEl(`job_pos_${i}`)) getEl(`job_pos_${i}`).innerHTML = pekerjaanOptionsHtml();
    }

    // RENDER FAM
    let famHtml = '';
    for (let i = 1; i <= 5; i++) {
      famHtml += `<div class="dynamic-box"><div class="box-title">${window.tr('form.mf_keluarga_n')} ${i}</div>
                    <div class="row mb-3"><div><label class="label">${window.tr('form.mf_hubungan')}</label><select id="fam_hub_${i}" class="input py-2"><option value="">Pilih</option><option value="AYAH">AYAH</option><option value="IBU">IBU</option><option value="SUAMI">SUAMI</option><option value="ISTRI">ISTRI</option><option value="ANAK">ANAK</option><option value="KAKAK">KAKAK</option><option value="ADIK">ADIK</option></select></div>
                    <div><label class="label">${window.tr('form.mf_nama_keluarga')}</label><input id="fam_nm_${i}" class="input py-2" placeholder="Otomatis ke katakana saat disimpan"></div></div>
                    <div class="row mb-3">
                        <div><label class="label">${window.tr('form.mf_kenalan_usia')}</label><input id="fam_age_${i}" type="number" class="input py-2"></div>
                        <div><label class="label">${window.tr('form.mf_pekerjaan')}</label><select id="fam_job_${i}" class="input py-2" onchange="onFamPekerjaanSelect(${i})"></select><input id="fam_job_manual_${i}" class="input py-2 hidden mt-2" placeholder="${window.tr('form.mf_ph_pekerjaan_lain')}"></div>
                    </div>
                    <div class="form-group"><label class="label">${window.tr('form.mf_gaji')}</label><input id="fam_sal_${i}" type="number" class="input py-2"></div></div>`;
    }
    if (getEl('fam-container')) getEl('fam-container').innerHTML = famHtml;
    for (let i = 1; i <= 5; i++) {
      if (getEl(`fam_job_${i}`)) getEl(`fam_job_${i}`).innerHTML = pekerjaanOptionsHtml();
    }
    // Dropdown SSW (lisensi) diisi lewat JS supaya daftar dwi bahasa konsisten.
    buildSswSelect('lisensi');
    buildSswSelect('lisensi2');

    // AUTO FILL
    let waVal = getEl('wa').value;
    if (!waVal) {
      console.warn('Mode Preview: Nomor WA tidak ditemukan di URL, auto-fill dilewati.');
      return;
    }
    // Keamanan: wajib session kandidat asli (login dulu) - nomor WA dari
    // URL/QR saja tidak cukup untuk membaca data pribadi kandidat.
    if (!getCandidateSession()) {
      showLoginGate(window.tr('form.mf_gate_desc'));
      return;
    }
    let loadingBox = getEl('loading');
    if (loadingBox) loadingBox.classList.remove('hidden');

    window
      .callAPI('getMasterDataByWa', [waVal])
      .then((data) => {
        if (loadingBox) loadingBox.classList.add('hidden');
        if (data && data.sessionInvalid) {
          showLoginGate(window.tr('form.mf_sesi_berakhir'));
          return;
        }
        if (data) {
          setVal('nama', data['NAMA_LENGKAP']);
          setVal('furigana', data['FURIGANA']);
          setVal('panggilan', data['NAMAPANGGILAN']);
          setVal('panggilanKatakana', data['PANGGILAN_KATAKANA']);
          setVal('tempatLahir', data['TEMPAT_LAHIR']);
          if (data['TGL_LAHIR']) setVal('tglLahir', formatDate(data['TGL_LAHIR']));
          setVal('gender', data['GENDER']);
          setVal('usia', data['USIA']);
          setVal('agama', data['AGAMA']);
          setVal('statusNikah', data['STATUS_PERNIKAHAN']);
          setVal('anak', data['JUMLAH_ANAK']);
          setVal('ktp', data['NIK']);
          setVal('sim', data['DRIVER_LICENSE']);
          setVal('alamat', data['ALAMAT_LENGKAP']);
          setVal('email', data['EMAIL']);
          setVal('tb', data['TT']);
          setVal('bb', data['BB']);
          setVal('goldar', data['GOLONGAN_DARAH']);
          setVal('tangan', data['TANGANDOMINAN']);
          setVal('baju', data['UKURANBAJU']);
          setVal('sepatu', data['UKURANSEPATU']);
          setVal('topi', data['UKURAN_TOPI']);
          setVal('tahanAc', data['TAHAN_AC']);

          setVal('mataKiri', data['MATA_KIRI']);
          setVal('mataKanan', data['MATA_KANAN']);
          setVal('kacamata', data['KACAMATA']);
          setVal('butaWarna', data['BUTA_WARNA']);
          setVal('tato', data['TATO']);
          setVal('tindik', data['TINDIK']);
          setVal('merokok', data['MEROKOK']);
          setVal('alkohol', data['MINUM_ALKOHOL']);

          setVal('penyakit', data['RIWAYAT_PENYAKIT']);
          setVal('alergi', data['ALERGI']);
          setVal('laka', data['RIWAYAT_KECELAKAAN']);
          setVal('lamaJepang', data['LAMA_DI_JEPANG']);
          setVal('gajiYen', data['HARAPAN_GAJI_YEN']);
          setVal('tabungan', data['HARAPAN_TABUNGAN']);
          setVal('bhsJepang', data['BAHASA']);
          setVal('nilai', data['JFT']);
          var lisensiVal = String(data['BIDANGSSW'] || data['SSW'] || '');
          var lisensiParts = lisensiVal
            .split(',')
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          fillManualSelect(getEl('lisensi'), getEl('lisensi_manual'), lisensiParts[0] || '');
          fillManualSelect(getEl('lisensi2'), getEl('lisensi2_manual'), lisensiParts[1] || '');
          setVal('promosi', data['PROMOSI_DIRI']);
          setVal('kelebihan', data['KELEBIHAN']);
          setVal('kekurangan', data['KEKURANGAN']);
          setVal('keahlianKhusus', data['KEAHLIAN_KHUSUS']);
          setVal('hobi', data['HOBI_&_KETERAMPILAN']);
          setVal('alasanBidang', data['ALASAN_MEMILIH_BIDANG']);
          setVal('motivasiJepang', data['MOTIVASI_KE_JEPANG']);
          setVal('keinginan', data['KEINGINAN_PRIBADI']);
          setVal('rencanaPulang', data['RENCANA_SETELAH_PULANG']);
          setVal('tujuanJepang', data['TUJUAN_KE_JEPANG']);

          setVal('eksJepang', data['STATUS_EKS_JEPANG'] || 'BELUM PERNAH');
          setVal('daruratNama', data['KONTAK_DARURAT_NAMA']);
          setVal('daruratHubungan', data['KONTAK_DARURAT_HUBUNGAN']);
          if (data['KONTAK_DARURAT_WA'])
            setVal('daruratWa', String(data['KONTAK_DARURAT_WA']).replace(/\D/g, ''));
          setVal('kenalanNama', data['KENALAN_DI_JEPANG_NAMA']);
          setVal('kenalanHubungan', data['KENALAN_DI_JEPANG_HUBUNGAN']);
          setVal('kenalanPekerjaan', data['KENALAN_DI_JEPANG_PEKERJAAN']);
          setVal('kenalanUsia', data['KENALAN_DI_JEPANG_USIA']);
          setVal('kenalanAlamat', data['KENALAN_DI_JEPANG_ALAMAT']);

          for (let i = 1; i <= 5; i++) {
            setVal(`edu_tk_${i}`, data[`PENDIDIKAN_${i}_TINGKAT`]);
            setVal(`edu_nm_${i}`, data[`PENDIDIKAN_${i}_NAMA_SEKOLAH`]);
            setVal(
              `edu_jur_${i}`,
              data[`PENDIDIKAN_${i}_JURUSAN`] || data[`PENDIDIKAN_${i}_JURUSAN_ID`],
            );
            setVal(`edu_in_${i}`, data[`PENDIDIKAN_${i}_TAHUN_MASUK`]);
            setVal(`edu_out_${i}`, data[`PENDIDIKAN_${i}_TAHUN_LULUS`]);
          }
          for (let i = 1; i <= 3; i++) {
            setVal(`job_nm_${i}`, data[`PEKERJAAN_${i}_NAMA_PERUSAHAAN`]);
            setVal(`job_in_${i}`, data[`PEKERJAAN_${i}_TAHUN_MASUK`]);
            let tOut = data[`PEKERJAAN_${i}_TAHUN_KELUAR`];
            if (tOut === 'SEKARANG') {
              if (getEl(`job_now_${i}`)) {
                getEl(`job_now_${i}`).checked = true;
                toggleImaMade(i);
              }
            } else {
              setVal(`job_out_${i}`, tOut);
            }
            fillManualSelect(
              getEl(`job_pos_${i}`),
              getEl(`job_pos_manual_${i}`),
              data[`PEKERJAAN_${i}_JABATAN`] || '',
            );
            setVal(`job_sal_${i}`, data[`PEKERJAAN_${i}_GAJI`]);
          }
          for (let i = 1; i <= 5; i++) {
            setVal(`fam_hub_${i}`, data[`KELUARGA_${i}_HUBUNGAN`]);
            setVal(`fam_nm_${i}`, data[`KELUARGA_${i}_NAMA`]);
            setVal(`fam_age_${i}`, data[`KELUARGA_${i}_USIA`]);
            fillManualSelect(
              getEl(`fam_job_${i}`),
              getEl(`fam_job_manual_${i}`),
              data[`KELUARGA_${i}_PEKERJAAN`] || '',
            );
            setVal(`fam_sal_${i}`, data[`KELUARGA_${i}_PENDAPATAN`]);
          }

          setVal('noPaspor', data['NO_PASPORT']);
          setVal('kotaPaspor', data['KOTA_TERBIT_PASPORT']);
          setVal('noCoe', data['NO_COE']);
          if (data['TGL_TERBIT_PASPORT'])
            setVal('tglTerbitPaspor', formatDate(data['TGL_TERBIT_PASPORT']));
          if (data['EXP_PASPORT']) setVal('expPaspor', formatDate(data['EXP_PASPORT']));

          var fileSavedMsg =
            "<span style='color:#10b981; font-weight:700;'><i class='fas fa-check-circle'></i> " +
            window.tr('form.mf_file_saved') +
            '</span>';
          if (data['PAS_PHOTO'] && String(data['PAS_PHOTO']).length > 10) {
            let pInfo = getEl('photoInfo');
            if (pInfo) pInfo.innerHTML = fileSavedMsg;
          }
          if (data['JFT_URL'] && String(data['JFT_URL']).length > 10) {
            let jInfo = getEl('jftInfo');
            if (jInfo) jInfo.innerHTML = fileSavedMsg;
          }
          if (data['SSW_URL'] && String(data['SSW_URL']).length > 10) {
            let sInfo = getEl('sswInfo');
            if (sInfo) sInfo.innerHTML = fileSavedMsg;
          }
        }
      })
      .catch((err) => {
        if (loadingBox) loadingBox.classList.add('hidden');
        console.error('AutoFill Error:', err);
      });
  } catch (e) {
    console.error('Onload Error:', e);
  }
};

// Format baku per jenis (2026-08-12): foto JPG/PNG, CV PDF/Word/Excel,
// dokumen lain PDF — diterjemahkan dari atribut accept input (sumber
// kebenaran di HTML), sinkron dengan aturan per-prefix di storage-helper.ts.
function ekstensiDariAccept(acceptAttr) {
  const acc = String(acceptAttr || '').toLowerCase();
  if (acc.indexOf('image/*') !== -1) return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  const out = [];
  acc.split(',').forEach((a) => {
    a = a.trim().replace(/^\./, '');
    if (a) out.push(a);
  });
  return out.length ? out : null;
}

export function handleFile(input, infoId) {
  const file = input.files[0];
  let infoEl = getEl(infoId);
  if (file && infoEl) {
    // Guard seragam: format (accept) + ukuran maks 2 MB — alert jelas + reset input.
    if (!window.cekUploadFile(input, { maxMb: 2 })) {
      infoEl.innerHTML = '';
      return;
    }
    infoEl.innerHTML = `<span style='color:#38bdf8'>✅ ${file.name}</span>`;
  }
}

export function changeStep(dir) {
  try {
    let curStepEl = getEl(`step-${currentStep}`);
    if (curStepEl) curStepEl.classList.remove('active');
    let curIndEl = getEl(`ind-${currentStep}`);
    if (curIndEl) {
      curIndEl.classList.remove('active');
      curIndEl.classList.add('completed');
    }

    currentStep += dir;

    for (let i = 1; i <= totalSteps; i++) {
      let ind = getEl(`ind-${i}`);
      if (ind) {
        if (i < currentStep) {
          ind.classList.add('completed');
          ind.classList.remove('active');
        } else if (i === currentStep) {
          ind.classList.add('active');
          ind.classList.remove('completed');
        } else {
          ind.classList.remove('active', 'completed');
        }
      }
    }

    let nextStepEl = getEl(`step-${currentStep}`);
    if (nextStepEl) nextStepEl.classList.add('active');

    let btnPrev = getEl('btnPrev');
    let btnNext = getEl('btnNext');
    let btnSubmit = getEl('btnSubmit');

    if (btnPrev) btnPrev.style.display = currentStep === 1 ? 'none' : 'block';
    if (currentStep === totalSteps) {
      if (btnNext) btnNext.classList.add('hidden');
      if (btnSubmit) btnSubmit.classList.remove('hidden');
    } else {
      if (btnNext) btnNext.classList.remove('hidden');
      if (btnSubmit) btnSubmit.classList.add('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    window.showToast('Navigasi Error: ' + error.message, 'error');
  }
}

export async function submitMaster(isDraft) {
  try {
    if (!getCandidateSession()) {
      showLoginGate(window.tr('form.mf_alert_login_dulu'));
      return;
    }
    let namaVal = getEl('nama') ? getEl('nama').value : '';
    if (!isDraft && !namaVal.trim()) {
      window.showToast(window.tr('form.mf_alert_nama_wajib'), 'error');
      changeStep(1 - currentStep);
      return;
    }

    let loadingBox = getEl('loading');
    if (loadingBox) {
      getEl('loadingText').innerText = isDraft
        ? window.tr('form.mf_save_draft')
        : window.tr('form.mf_save_final');
      loadingBox.classList.remove('hidden');
    }

    // POSISI BARIS DIJAGA: selalu kirim 5 elemen (baris kosong = {}), supaya
    // LPK di baris 5 tidak bergeser ke baris 4/lebih awal saat disimpan ulang
    // (dulu hanya baris terisi yang dikirim -> posisi ikut memampat).
    let arrEdu = [];
    for (let i = 1; i <= 5; i++) {
      if (getEl(`edu_tk_${i}`) && getEl(`edu_tk_${i}`).value) {
        arrEdu.push({
          tingkat: getEl(`edu_tk_${i}`).value,
          namaSekolah: getEl(`edu_nm_${i}`).value,
          jurusan: getEl(`edu_jur_${i}`) ? getEl(`edu_jur_${i}`).value : '',
          tahunMasuk: getEl(`edu_in_${i}`).value,
          tahunLulus: getEl(`edu_out_${i}`).value,
        });
      } else {
        arrEdu.push({});
      }
    }
    let arrJob = [];
    for (let i = 1; i <= 3; i++) {
      if (getEl(`job_nm_${i}`) && getEl(`job_nm_${i}`).value) {
        let outVal = getEl(`job_now_${i}`).checked ? 'SEKARANG' : getEl(`job_out_${i}`).value;
        arrJob.push({
          namaPt: getEl(`job_nm_${i}`).value,
          tahunMasuk: getEl(`job_in_${i}`).value,
          tahunKeluar: outVal,
          jabatan: readManualSelect(getEl(`job_pos_${i}`), getEl(`job_pos_manual_${i}`)),
          gaji: getEl(`job_sal_${i}`) ? getEl(`job_sal_${i}`).value : '',
        });
      }
    }
    let arrFam = [];
    for (let i = 1; i <= 5; i++) {
      if (getEl(`fam_hub_${i}`) && getEl(`fam_hub_${i}`).value && getEl(`fam_nm_${i}`).value) {
        arrFam.push({
          hubungan: getEl(`fam_hub_${i}`).value,
          nama: getEl(`fam_nm_${i}`).value,
          usia: getEl(`fam_age_${i}`).value,
          pekerjaan: readManualSelect(getEl(`fam_job_${i}`), getEl(`fam_job_manual_${i}`)),
          pendapatan: getEl(`fam_sal_${i}`) ? getEl(`fam_sal_${i}`).value : '',
        });
      }
    }

    const valSafe = (id) => (getEl(id) ? getEl(id).value : '');

    // File dikirim LANGSUNG ke Cloudinary (uploadToCloudinary) — backend
    // hanya menerima string URL hasil upload (resolveFileUrl).
    // Progress + parallel upload (9 files sekaligus)
    if (loadingBox) getEl('loadingText').innerText = 'Mengunggah dokumen...';
    const fileEntries = [
      ['photo', 'photo'], ['jft', 'jft'], ['ssw', 'ssw'],
      ['ijazahSd', 'ijazahSd'], ['ijazahSmp', 'ijazahSmp'], ['ijazahSma', 'ijazahSma'],
      ['univ', 'univ'], ['ktpFile', 'ktpFile'], ['kk', 'kk']
    ];
    const uploadPromises = fileEntries.map(([key, elId]) => {
      const el = getEl(elId);
      if (el && el.files && el.files.length > 0) {
        // @ts-expect-error JS→TS migration
        return uploadToCloudinary(el.files[0]).then((url) => ({ key, url }));
      }
      return Promise.resolve({ key, url: null });
    });
    const uploadResults = await Promise.all(uploadPromises);
    const um = {};
    uploadResults.forEach((r) => { um[r.key] = r.url; });
    const filePhoto = um.photo || null;
    const fileJft = um.jft || null;
    const fileSsw = um.ssw || null;
    const fileIjazahSd = um.ijazahSd || null;
    const fileIjazahSmp = um.ijazahSmp || null;
    const fileIjazahSma = um.ijazahSma || null;
    const fileUniv = um.univ || null;
    const fileKtp = um.ktpFile || null;
    const fileKk = um.kk || null;

    const payload = {
      wa: valSafe('wa'),
      nama: valSafe('nama').toUpperCase(),
      furigana: valSafe('furigana'),
      panggilan: valSafe('panggilan').toUpperCase(),
      panggilanKatakana: valSafe('panggilanKatakana'),
      gender: valSafe('gender'),
      tempatLahir: valSafe('tempatLahir').toUpperCase(),
      tglLahir: valSafe('tglLahir'),
      usia: valSafe('usia'),
      agama: valSafe('agama'),
      statusNikah: valSafe('statusNikah'),
      anak: valSafe('anak'),
      ktp: valSafe('ktp'),
      sim: valSafe('sim'),
      alamat: valSafe('alamat'),
      email: valSafe('email'),
      tb: valSafe('tb'),
      bb: valSafe('bb'),
      goldar: valSafe('goldar'),
      tangan: valSafe('tangan'),
      baju: valSafe('baju').toUpperCase(),
      sepatu: valSafe('sepatu'),
      topi: valSafe('topi'),
      tahanAc: valSafe('tahanAc'),
      mataKiri: valSafe('mataKiri'),
      mataKanan: valSafe('mataKanan'),
      kacamata: valSafe('kacamata'),
      butaWarna: valSafe('butaWarna'),
      tato: valSafe('tato'),
      tindik: valSafe('tindik'),
      merokok: valSafe('merokok'),
      alkohol: valSafe('alkohol'),
      penyakit: valSafe('penyakit'),
      alergi: valSafe('alergi'),
      laka: valSafe('laka'),
      promosi: valSafe('promosi'),
      kelebihan: valSafe('kelebihan'),
      kekurangan: valSafe('kekurangan'),
      keahlianKhusus: valSafe('keahlianKhusus'),
      hobi: valSafe('hobi'),
      alasanBidang: valSafe('alasanBidang'),
      motivasiJepang: valSafe('motivasiJepang'),
      keinginan: valSafe('keinginan'),
      rencanaPulang: valSafe('rencanaPulang'),
      tujuanJepang: valSafe('tujuanJepang'),
      lamaJepang: valSafe('lamaJepang'),
      gajiYen: valSafe('gajiYen'),
      tabungan: valSafe('tabungan'),
      bhsJepang: valSafe('bhsJepang'),
      nilai: valSafe('nilai'),
      lisensi: [
        readManualSelect(getEl('lisensi'), getEl('lisensi_manual')),
        readManualSelect(getEl('lisensi2'), getEl('lisensi2_manual')),
      ]
        .filter(Boolean)
        .join(', '),
      eksJepang: valSafe('eksJepang'),
      daruratNama: valSafe('daruratNama'),
      daruratHubungan: valSafe('daruratHubungan'),
      daruratWa: valSafe('daruratWa'),
      kenalanNama: valSafe('kenalanNama'),
      kenalanHubungan: valSafe('kenalanHubungan'),
      kenalanPekerjaan: valSafe('kenalanPekerjaan'),
      kenalanUsia: valSafe('kenalanUsia'),
      kenalanAlamat: valSafe('kenalanAlamat'),

      pendidikan: arrEdu,
      pekerjaan: arrJob,
      keluarga: arrFam,
      noPaspor: valSafe('noPaspor'),
      tglTerbitPaspor: valSafe('tglTerbitPaspor'),
      expPaspor: valSafe('expPaspor'),
      kotaPaspor: valSafe('kotaPaspor').toUpperCase(),
      noCoe: valSafe('noCoe'),
      photoFile: filePhoto,
      jftFile: fileJft,
      sswFile: fileSsw,
      ijazahSdFile: fileIjazahSd,
      ijazahSmpFile: fileIjazahSmp,
      ijazahSmaFile: fileIjazahSma,
      univFile: fileUniv,
      ktpFile: fileKtp,
      kkFile: fileKk,
    };

    // Retry: max 2 attempts
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (loadingBox) getEl('loadingText').innerText = 'Menyimpan data...';
        const res = await window.callAPI('submitMasterForm', [payload]);
        if (loadingBox) loadingBox.classList.add('hidden');
        if (res && res.sessionInvalid) { showLoginGate(window.tr('form.mf_sesi_simpan')); return; }
        if (res.success) {
          var msg = isDraft ? window.tr('form.mf_alert_draft') : window.tr('form.mf_alert_final');
          if (res.translationSkipped) msg += window.tr('form.mf_alert_translate');
          window.showToast(msg, 'success');
          return;
        }
        if (res.message && !String(res.message).match(/network|timeout|fetch/i)) {
          window.showToast(window.tr('form.mf_alert_gagal') + res.message, 'error');
          return;
        }
        lastErr = new Error(res.message || 'Submit gagal');
        if (attempt < 1) { window.showToast('Mencoba ulang...', 'info'); await new Promise((r) => setTimeout(r, 2000)); continue; }
        window.showToast(window.tr('form.mf_alert_gagal') + (lastErr.message || ''), 'error');
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < 1) { window.showToast('Jaringan gangguan, mencoba ulang...', 'info'); await new Promise((r) => setTimeout(r, 2000)); continue; }
        break;
      }
    }
    if (loadingBox) loadingBox.classList.add('hidden');
    window.showToast(window.tr('form.mf_alert_koneksi') + (lastErr?.message || ''), 'error');
  } catch (e) {
    let loadingBox = getEl('loading');
    if (loadingBox) loadingBox.classList.add('hidden');
    window.showToast(window.tr('form.mf_alert_sistem') + e.message, 'error');
  }
}

// Bridge ESM→legacy (Fase 3 langkah 15): HTML onclick/onchange/onkeydown
// master-full.html + string onchange dinamis (toggleImaMade/onPekerjaanSelect/
// onFamPekerjaanSelect) butuh global — bridge ini SEMPAT HILANG saat
// konversi langkah 13, ketahuan lewat aktivasi no-undef + smoke (klik
// Langkah/Batal/Simpan bakal ReferenceError). Kini SEMUA alias seam HTML
// diregistrasikan TERPUSAT via registerSeamAliases (js/core/bridge.js).
registerSeamAliases({
  toggleImaMade,
  gateLogin,
  onSswSelect,
  onPekerjaanSelect,
  onFamPekerjaanSelect,
  handleFile,
  changeStep,
  submitMaster,
});
