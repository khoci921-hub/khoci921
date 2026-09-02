// js/pages/ai_form.js — sekarang ESM (Fase 3 langkah 13): diload type=module.
// State (chatHistory, latestCandidateData, *Base64/*File, dll) PRIVATE modul;
// fungsi yang dipanggil HTML onclick/onchange/onload + string onclick dinamis
// (renderEditableArray) di-alias ke window di bridge bawah. Bare global dari
// luar dipanggil via window.* eksplisit (tr, callAPI, CURRENT_LANG,
// renderLanguageLight, cekUploadFile).
// ==========================================
// AI FORM (Qween CV) — konteks dari URL + logika chat/autofill/upload
// ==========================================
// ENTRY ESM (Fase 3.5 Langkah 6): halaman meng-import core lewat bridge.js
// (i18n + api-client) dan mendaftarkan alias seam HTML↔JS TERPUSAT via
// registerSeamAliases — bukan window.X = X per baris.
import { registerSeamAliases } from '../core/bridge.ts';
import '../init/util.ts';
import { uploadToCloudinary } from '../cloudinary.ts';

// FASE 3/4: dulu diisi server (GAS scriptlet) saat halaman dibuka dari
// Portal ASJ. Sekarang dibaca dari query string URL (?flow=&job=&bidang=&wa=&nama=)
// - persis parameter yang sama, cuma sumbernya URL bukan server-side render.
(function () {
  function cleanPhoneJS(wa) {
    if (!wa) return '';
    var s = String(wa).replace(/\D/g, '');
    if (s.startsWith('0')) s = '62' + s.substring(1);
    else if (s.startsWith('8')) s = '62' + s;
    return s;
  }
  var p = new URLSearchParams(window.location.search);
  var flow = (p.get('flow') || 'master').toLowerCase() === 'apply' ? 'apply' : 'master';
  window.AI_FORM_CONTEXT = {
    flow: flow,
    job: (p.get('job') || '').trim(),
    bidang: (p.get('bidang') || '').trim(),
    wa: cleanPhoneJS(p.get('wa') || ''),
    nama: (p.get('nama') || '').trim(),
  };
})();
function $(id) {
  return document.getElementById(id);
}
var chatHistory = [];
var latestCandidateData: Record<string, any> = {};
var currentPhotoBase64 = '';
var currentJftBase64 = '';
var currentSswBase64 = '';
var currentJftFile = null;
var currentSswFile = null;
var currentKtpFile = null;
var currentKkFile = null;
var currentIjazahSdFile = null;
var currentIjazahSmpFile = null;
var currentIjazahSmaFile = null;
var currentUnivFile = null;
var urlLogo =
  'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/logo_asj.png';
var urlJeklin =
  'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/jeklin.png';
var formContext: Record<string, any> = window.AI_FORM_CONTEXT || {};
var fieldPaths = {
  // 1. Identitas & Kontak
  f_nama: 'identitas.nama_lengkap',
  f_katakana: 'identitas.katakana',
  f_panggilan: 'identitas.panggilan',
  f_panggilan_katakana: 'identitas.panggilan_katakana',
  f_tmplahir: 'identitas.tempat_lahir',
  f_tgllahir: 'identitas.tgl_lahir',
  f_umur: 'identitas.umur',
  f_gender: 'identitas.gender',
  f_agama: 'identitas.agama',
  f_goldar: 'identitas.golongan_darah',
  f_status: 'identitas.status_nikah',
  f_anak: 'identitas.anak',
  f_email: 'identitas.email',
  f_alamat: 'identitas.alamat',
  f_hp: 'identitas.hp',
  f_hpdarurat: 'identitas.hp_darurat',
  f_ktp: 'identitas.ktp',
  f_paspor: 'identitas.paspor',
  f_sim: 'identitas.sim',

  // 2. Fisik & Ukuran
  f_tb: 'fisik.tb',
  f_bb: 'fisik.bb',
  f_topi: 'fisik.topi',
  f_baju: 'fisik.baju',
  f_sepatu: 'fisik.sepatu',
  f_tangan: 'fisik.tangan_dominan',
  f_tahan_ac: 'fisik.tahan_ac',

  // 3. Medis & Kebiasaan (Sudah Bilingual)
  f_matakanan: 'medis.mata_kanan',
  f_matakiri: 'medis.mata_kiri',
  f_kacamata: 'medis.kacamata',
  f_butawarna: 'medis.buta_warna',
  f_tato: 'medis.tato',
  f_rokok: 'medis.rokok',
  f_alkohol: 'medis.alkohol',
  f_alergi_id: 'medis.alergi_id',
  f_alergi_jp: 'medis.alergi_jp',
  f_medis_id: 'medis.riwayat_medis_id',
  f_medis_jp: 'medis.riwayat_medis_jp',
  f_laka_id: 'medis.riwayat_kecelakaan_id',
  f_laka_jp: 'medis.riwayat_kecelakaan_jp',

  // 4. Jiko PR & Wawancara (Sudah Bilingual)
  f_keinginan_id: 'wawancara.keinginan_id',
  f_keinginan_jp: 'wawancara.keinginan_jp',
  f_tujuan_id: 'wawancara.tujuan_ke_jepang',
  f_tujuan_jp: 'wawancara.tujuan_ke_jepang_jp',
  f_riwayatjepang: 'wawancara.riwayat_jepang',
  f_promo_id: 'wawancara.promosi_id',
  f_promo_jp: 'wawancara.promosi_jp',
  f_lebih_id: 'wawancara.kelebihan_id',
  f_lebih_jp: 'wawancara.kelebihan_jp',
  f_kurang_id: 'wawancara.kekurangan_id',
  f_kurang_jp: 'wawancara.kekurangan_jp',
  f_hobi_id: 'wawancara.hobi_id',
  f_hobi_jp: 'wawancara.hobi_jp',
  f_keahlian_id: 'wawancara.keahlian_id',
  f_keahlian_jp: 'wawancara.keahlian_jp',
  f_moti_id: 'wawancara.motivasi_id',
  f_moti_jp: 'wawancara.motivasi_jp',
  f_alasan_id: 'wawancara.alasan_bidang_id',
  f_alasan_jp: 'wawancara.alasan_bidang_jp',
  f_pulang_id: 'wawancara.rencana_pulang_id',
  f_pulang_jp: 'wawancara.rencana_pulang_jp',
  f_lama: 'wawancara.lama_di_jepang',
  f_gaji_yen: 'wawancara.harapan_gaji',
  f_tabungan: 'wawancara.harapan_tabungan',

  // 5. Sertifikasi
  f_bhs_jepang: 'sertifikasi.bahasa_jepang',
  f_nilai: 'sertifikasi.nilai',
  f_lisensi: 'sertifikasi.lisensi',

  // 6. Kenalan di Jepang (Sudah Bilingual)
  f_kenalan_nama_id: 'kenalan_jepang.nama_id',
  f_kenalan_nama_jp: 'kenalan_jepang.nama_jp',
  f_kenalan_hub_id: 'kenalan_jepang.hubungan_id',
  f_kenalan_hub_jp: 'kenalan_jepang.hubungan_jp',
  f_kenalan_kerja_id: 'kenalan_jepang.pekerjaan_id',
  f_kenalan_kerja_jp: 'kenalan_jepang.pekerjaan_jp',
  f_kenalan_usia: 'kenalan_jepang.usia',
  f_kenalan_alamat_id: 'kenalan_jepang.alamat_id',
  f_kenalan_alamat_jp: 'kenalan_jepang.alamat_jp',
};
// Opsi dropdown isi-manual (dwi bahasa; nilai tersimpan tetap bersih).
var TINGKAT_OPTIONS = ['SD', 'SMP', 'SMA/SMK', 'D3/S1', 'LPK BAHASA'];
var HUBUNGAN_OPTIONS = ['AYAH', 'IBU', 'SUAMI', 'ISTRI', 'ANAK', 'KAKAK', 'ADIK'];
var arrayFields = {
  pendidikan: [
    ['tingkat', 'form.ai_f_tingkat', 'select', TINGKAT_OPTIONS],
    ['sekolah_id', 'form.ai_f_sekolah_id'],
    ['sekolah_jp', 'form.ai_f_sekolah_jp'],
    ['jurusan_id', 'form.ai_f_jurusan_id'],
    ['jurusan_jp', 'form.ai_f_jurusan_jp'],
    ['masuk', 'form.ai_f_masuk'],
    ['lulus', 'form.ai_f_lulus'],
  ],
  pekerjaan: [
    ['perusahaan_id', 'form.ai_f_perusahaan_id'],
    ['perusahaan_jp', 'form.ai_f_perusahaan_jp'],
    ['jabatan_id', 'form.ai_f_jabatan_id', 'datalist'],
    ['jabatan_jp', 'form.ai_f_jabatan_jp'],
    ['masuk', 'form.ai_f_mulai'],
    ['keluar', 'form.ai_f_selesai'],
    ['gaji', 'form.ai_f_gaji'],
  ],
  keluarga: [
    ['hubungan_id', 'form.ai_f_hubungan_id', 'select', HUBUNGAN_OPTIONS],
    ['hubungan_jp', 'form.ai_f_hubungan_jp'],
    ['nama', 'form.ai_f_nama'],
    ['katakana', 'form.ai_f_katakana'],
    ['umur', 'form.ai_f_umur'],
    ['pekerjaan_id', 'form.ai_f_pekerjaan_id', 'datalist'],
    ['pekerjaan_jp', 'form.ai_f_pekerjaan_jp'],
    ['gaji', 'form.ai_f_gaji'],
  ],
};

function getByPath(source, path) {
  return path.split('.').reduce(function (value, key) {
    return value && value[key] !== undefined ? value[key] : '';
  }, source || {});
}

function setByPath(target, path, value) {
  var keys = path.split('.'),
    cursor = target;
  keys.slice(0, -1).forEach(function (key) {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mergeCandidateData(current, incoming) {
  if (Array.isArray(incoming)) {
    var currentArray = Array.isArray(current) ? current : [];
    if (!incoming.length) return currentArray.slice();
    var mergedArray = incoming.map(function (item, index) {
      return mergeCandidateData(currentArray[index], item);
    });
    return mergedArray.concat(currentArray.slice(incoming.length));
  }
  if (incoming && typeof incoming === 'object') {
    var base = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    var result: Record<string, any> = {};
    Object.keys(base).forEach(function (key) {
      result[key] = base[key];
    });
    Object.keys(incoming).forEach(function (key) {
      result[key] = mergeCandidateData(base[key], incoming[key]);
    });
    return result;
  }
  if (
    incoming === undefined ||
    incoming === null ||
    (typeof incoming === 'string' && !incoming.trim())
  )
    return current === undefined ? '' : current;
  return incoming;
}

function enableManualPreview() {
  document
    .querySelectorAll('#formPanel input[readonly], #formPanel textarea[readonly]')
    .forEach(function (el) {
      el.removeAttribute('readonly');
      el.setAttribute('title', window.tr('form.ai_f_tooltip'));
    });
  Object.keys(fieldPaths).forEach(function (id) {
    var el = $(id);
    if (!el || el.dataset.manualBound) return;
    el.dataset.manualBound = 'true';
    el.addEventListener('input', function () {
      latestCandidateData =
        latestCandidateData && typeof latestCandidateData === 'object' ? latestCandidateData : {};
      setByPath(latestCandidateData, fieldPaths[id], el.value);
      el.classList.add('border-sky-400');
      saveToLocal();
    });
  });
}

export function updateArrayField(type, index, field, value) {
  if (!Array.isArray(latestCandidateData[type])) latestCandidateData[type] = [];
  if (!latestCandidateData[type][index]) latestCandidateData[type][index] = {};
  latestCandidateData[type][index][field] = value;
  saveToLocal();
}

export function addArrayItem(type) {
  latestCandidateData =
    latestCandidateData && typeof latestCandidateData === 'object' ? latestCandidateData : {};
  if (!Array.isArray(latestCandidateData[type])) latestCandidateData[type] = [];
  var item: Record<string, any> = {};
  arrayFields[type].forEach(function (definition) {
    item[definition[0]] = '';
  });
  latestCandidateData[type].push(item);
  updateFormUI();
  saveToLocal();
}

export function removeArrayItem(type, index) {
  if (!Array.isArray(latestCandidateData[type])) return;
  latestCandidateData[type].splice(index, 1);
  updateFormUI();
  saveToLocal();
}

function getStorageKey() {
  var wa = String(formContext.wa || 'baru').replace(/\D/g, '');
  var job = String(formContext.job || formContext.flow || 'master').replace(/[^a-z0-9_-]/gi, '_');
  return 'asj_qween_cv_data_' + wa + '_' + job;
}

function applyPortalContext() {
  latestCandidateData =
    latestCandidateData && typeof latestCandidateData === 'object' ? latestCandidateData : {};
  var identitas = latestCandidateData.identitas || {};
  if (!identitas.nama_lengkap && formContext.nama)
    setByPath(latestCandidateData, 'identitas.nama_lengkap', formContext.nama);
  if (!identitas.hp && formContext.wa)
    setByPath(latestCandidateData, 'identitas.hp', formContext.wa);

  var label =
    formContext.flow === 'apply'
      ? 'Lamaran ' + (formContext.job || 'umum') + ' tersambung ke portal.'
      : 'CV Master tersambung ke profil portal.';
  if ($('formModeLabel')) $('formModeLabel').textContent = label;
}

// SYNC with backend: netlify/functions/_lib/ai/chat.ts isVipCatatan()
// Old regex /\[(?:KELAS\s*[A-Z0-9]+|[A-Z0-9]+)\]/i matched ANY bracketed
// tag ([MCU], [VISA], [NOTE]) — too broad. Tightened to [VIP] + [KELAS ...] only.
function isVipCatatan(catatan) {
  var c = catatan || '';
  return c.includes('[VIP]') || /\[KELAS\s*[A-Z0-9]+\]/i.test(c);
}

// GUARD VIP: AI CV (flow=master) khusus siswa ASJ berbadge VIP. Kandidat luar
// yang membuka URL langsung diarahkan ke Form Master Lengkap.
// FIX (bug "auto reset ke CV Master"): kalau sesi kandidat TIDAK valid di
// window ini (mis. dibuka ADMIN lewat bridge — window baru tanpa login
// kandidat), getAppData('kandidat') balas sessionInvalid tanpa myData; dulu
// itu dibaca sebagai "bukan VIP" lalu di-redirect ke CV Master padahal belum
// tentu.
//
// Dua kasus:
// 1) Window ADMIN (dari panel admin): localStorage dibagi dengan tab admin
//    (asj_admin_login='sukses'), jadi JANGAN panggil getAppData('kandidat')
//    sama sekali — request itu membawa token admin, gagal validasi sesi
//    kandidat, dan sessionInvalid di callAPI GLOBAL menghapus SEMUA sesi +
//    reload (admin ikut logout!). Admin berwenang buka AI CV kandidat apa
//    pun; server memvalidasi sesi admin di processAIChat (isAiCvAllowed OR
//    admin session).
// 2) Window kandidat: verifikasi VIP normal; kalau sesi tidak valid,
//    biarkan masuk — keputusan final di server.
function verifikasiAksesAiCv(targetWa) {
  if (localStorage.getItem('asj_admin_login') === 'sukses') {
    return Promise.resolve(true);
  }
  // FIX (loop reload tak berujung): tanpa sesi kandidat yang VALID, JANGAN
  // panggil getAppData('kandidat'). callAPI GLOBAL akan menghapus semua sesi
  // + reload saat respons sessionInvalid — guard ini dipanggil lagi setelah
  // reload (masih tanpa sesi) → halaman reload terus-menerus. Biarkan masuk;
  // keputusan final tetap di server (processAIChat: isAiCvAllowed ATAU sesi
  // admin). Kasus sesi kandidat basi (login flag ada, token kedaluwarsa)
  // tetap lewat jalur normal: reload sekali, flag dibersihkan, loop berhenti.
  if (localStorage.getItem('asj_kandidat_login') !== 'sukses') {
    return Promise.resolve(true);
  }
  return window
    .callAPI('getAppData', ['kandidat', targetWa])
    .then(function (res) {
      if (res && res.sessionInvalid) return true; // tidak bisa diverifikasi → jangan redirect
      // Respons backend rebuild menaruh data kandidat di res.candidates[0]
      // (dulu myData di backend GAS lama). Ambil catatanInt dari sana agar
      // kandidat VIP tidak salah redirect ke Form Master.
      var cand = res && Array.isArray(res.candidates) ? res.candidates[0] : null;
      var catatan = cand ? String(cand.catatanInt || cand.catatan || '') : '';
      if (!catatan && res && res.myData) catatan = String(res.myData.catatanInt || '');
      return isVipCatatan(catatan);
    })
    .catch(function () {
      // Kalau gagal jaringan, jangan blokir (fallback aman: biarkan masuk)
      return true;
    });
}

// Auto-fill data Master dari database (logika asli, dipindah jadi fungsi)
function jalankanAutoFill(targetWa) {
  if ($('aiTypingStatus')) {
    $('aiTypingStatus').classList.remove('hidden');
    $('aiTypingStatus').innerHTML =
      '<i class="fas fa-sync fa-spin mr-2"></i> ' + window.tr('form.ai_loading_master');
  }

  // FIX: pakai getDrafCvMaster (nested: identitas/fisik/medis/…/uploads +
  // AIDATAJSON) — dulu getExistingCandidateJsonByWa yang bentuknya FLAT
  // (kolom legacy untuk form apply), jadi form CV hanya terisi nama/HP
  // dan SIMPAN DB menimpa ai_data_json master dengan data hampir kosong.
  window
    .callAPI('getDrafCvMaster', [targetWa])
    .then(function (masterData) {
      if ($('aiTypingStatus')) $('aiTypingStatus').classList.add('hidden');
      if (masterData) {
        if (masterData.AIDATAJSON && typeof masterData.AIDATAJSON === 'string') {
          try {
            var aiParsed = JSON.parse(masterData.AIDATAJSON);
            masterData = mergeCandidateData(masterData, aiParsed);
          } catch (e) {
            console.warn('Failed to parse AIDATAJSON', e);
          }
        }
        latestCandidateData = mergeCandidateData(masterData, latestCandidateData);
        updateFormUI();
        saveToLocal();

        // JIKA BUKA CHAT PERTAMA KALI: TAMPILKAN SAPAAN PINTAR DENGAN NAMA & DATA KOSONG
        if (chatHistory.length === 0) {
          $('chatBox').innerHTML = ''; // Bersihkan sapaan lama
          var smartWelcome = generateSmartWelcomeMessage(latestCandidateData);
          appendHTML('ai', smartWelcome);
          chatHistory.push({
            role: 'assistant',
            content: JSON.stringify({ reply: smartWelcome, data: {} }),
          });
          saveToLocal();
        }
      }
    })
    .catch(function (err) {
      if ($('aiTypingStatus')) $('aiTypingStatus').classList.add('hidden');
      console.error('Gagal Auto-Fill Master:', err);
    });
}

// Pembersih draft lama ber-base64 sekarang TERSENTRALISASI di public/pwa.js
// (window.bersihkanDraftLamaBase64) — dimuat di SEMUA halaman, jadi migrasi
// satu kali jalan di halaman pertama yang dibuka user, bukan hanya ai_form.
// Alasan tidak via service worker: SW tidak punya akses localStorage.
// Di sini cukup fallback defensif kalau pwa.js belum termuat.
async function withRetry(fn, maxAttempts, delayMs) {
  maxAttempts = maxAttempts || 2;
  delayMs = delayMs || 2000;
  var lastErr;
  for (var i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) {
        await new Promise(function(resolve) { setTimeout(resolve, delayMs); });
      }
    }
  }
  throw lastErr;
}

export function initApp() {
  $('logoAsj').src = urlLogo;
  // Terjemahkan label statis sesuai bahasa terpilih (asj_lang).
  if (typeof window.renderLanguageLight === 'function') {
    window.renderLanguageLight();
    var lb = document.getElementById('lang-btn-ai');
    if (lb) lb.textContent = window.CURRENT_LANG === 'jp' ? 'ID' : 'JP';
  }
  enableManualPreview();

  // Buang base64 JFT/SSW dari draft versi lama (semua WA/job) supaya quota
  // localStorage langsung lega untuk user yang pernah pakai versi lama.
  // Idempotent — aman dipanggil ulang walau pwa.js sudah menjalankannya.
  if (typeof window.bersihkanDraftLamaBase64 === 'function') {
    window.bersihkanDraftLamaBase64();
  }

  var saved = localStorage.getItem(getStorageKey());
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      chatHistory = parsed.chatHistory || [];
      latestCandidateData = parsed.latestCandidateData || {};
      currentPhotoBase64 = parsed.currentPhotoBase64 || '';
      // FIX: JFT/SSW base64/file TIDAK di-restore dari localStorage. File
      // base64 PDF bisa puluhan MB -> quota localStorage 5MB penuh -> data
      // "nyangkut"/gagal simpan. Selain itu, me-restore file lama dari sesi
      // sebelumnya membuat SIMPAN DB meng-upload ulang file basi dan NIMPA
      // file yang lebih baru di DB. Sesi baru = mulai bersih; kalau user mau
      // nimpa, pilih file baru lagi. Status "sudah pernah upload" tetap
      // tampil dari DB via updateFormUI().
      currentJftBase64 = '';
      currentSswBase64 = '';
      currentJftFile = null;
      currentSswFile = null;
    } catch (e) {
      localStorage.removeItem(getStorageKey());
    }
  }

  applyPortalContext();

  // AUTO-FILL SPREADSHEET & SAPAAN PINTAR JEKLIN
  var targetWa =
    formContext.wa || (latestCandidateData.identitas && latestCandidateData.identitas.hp);
  if (targetWa && formContext.flow === 'master') {
    verifikasiAksesAiCv(targetWa).then(function (izin) {
      if (!izin) {
        window.location.href =
          '/master-full.html?wa=' +
          encodeURIComponent(targetWa) +
          '&nama=' +
          encodeURIComponent(formContext.nama || '');
        return;
      }
      jalankanAutoFill(targetWa);
    });
  } else if (targetWa) {
    jalankanAutoFill(targetWa);
  } else {
    if (chatHistory.length === 0) {
      sendWelcomeMessage();
    }
  }

  updateFormUI();

  if (currentPhotoBase64) {
    $('previewFoto').src = 'data:image/jpeg;base64,' + currentPhotoBase64;
    $('previewFoto').classList.remove('hidden');
    $('compressStatus').innerHTML =
      '<i class="fas fa-check-circle"></i> ' + window.tr('form.ai_status_saved');
    $('compressStatus').classList.remove('hidden');
  }
  if (currentJftBase64) {
    $('status_jft').innerHTML =
      '<i class="fas fa-check-circle"></i> ' + window.tr('form.ai_status_saved_auto');
    $('status_jft').classList.remove('hidden');
  }
  if (currentSswBase64) {
    $('status_ssw').innerHTML =
      '<i class="fas fa-check-circle"></i> ' + window.tr('form.ai_status_saved_auto');
    $('status_ssw').classList.remove('hidden');
  }

  // Auto-save every 30 seconds to prevent data loss
  setInterval(function() { saveToLocal(); }, 30000);
  window.addEventListener('resize', handleResize);
  // Desktop (>=768px): display kedua panel ditangani CSS (override `md:block`/
  // `md:flex` di main.css) — panggilan handleResize saat init tidak diperlukan.
}

function generateSmartWelcomeMessage(data) {
  var id = (data && data.identitas) || {};
  var fs = (data && data.fisik) || {};
  var iv = (data && data.wawancara) || {};
  var nama = id.panggilan || id.nama_lengkap || formContext.nama || '';

  if (nama) {
    // Deteksi daftar bidang yang masih kosong
    var missing = [];
    if (!id.ktp) missing.push(window.tr('form.chat_missing_ktp'));
    if (!id.paspor) missing.push(window.tr('form.chat_missing_paspor'));
    if (!iv.promosi_jp && iv.promosi_id) missing.push(window.tr('form.chat_missing_jiko'));
    if (!fs.topi) missing.push(window.tr('form.chat_missing_topi'));
    if (!fs.tahan_ac) missing.push(window.tr('form.chat_missing_ac'));
    if (!fs.tb) missing.push(window.tr('form.chat_missing_tb'));
    if (!fs.bb) missing.push(window.tr('form.chat_missing_bb'));
    if (!data.pendidikan || !data.pendidikan.length)
      missing.push(window.tr('form.chat_missing_pendidikan'));
    if (!data.pekerjaan || !data.pekerjaan.length)
      missing.push(window.tr('form.chat_missing_pekerjaan'));
    if (!iv.kelebihan_id) missing.push(window.tr('form.chat_missing_kelebihan'));
    if (!iv.kekurangan_id) missing.push(window.tr('form.chat_missing_kekurangan'));
    if (!iv.motivasi_id && !iv.motivasi_ke_jepang) missing.push(window.tr('form.chat_missing_motivasi'));
    if (!iv.alasan_bidang_id && !iv.alasan_memilih_bidang) missing.push(window.tr('form.chat_missing_alasan'));
    if (!iv.rencana_pulang_id && !iv.rencana_setelah_pulang) missing.push(window.tr('form.chat_missing_rencana'));
    if (!iv.tujuan_ke_jepang) missing.push(window.tr('form.chat_missing_tujuan'));
    if (!data.sertifikasi || (!data.sertifikasi.bahasa_jepang && !data.sertifikasi.jft))
      missing.push(window.tr('form.chat_missing_sertifikasi'));

    var welcomeText = window.tr('form.chat_welcome_named_intro').replace('{nama}', nama);

    if (missing.length > 0) {
      welcomeText += window
        .tr('form.chat_welcome_missing')
        .replace('{missing}', missing.slice(0, 2).join(' & '));
    } else {
      welcomeText += window.tr('form.chat_welcome_complete');
    }
    return welcomeText;
  } else {
    return window.tr('form.chat_welcome_nameless');
  }
}

function sendWelcomeMessage() {
  var welcome = window.tr('form.chat_welcome_nameless');
  appendHTML('ai', welcome);
  chatHistory.push({ role: 'assistant', content: JSON.stringify({ reply: welcome, data: {} }) });
  saveToLocal();
}

function saveToLocal() {
  try {
    // FIX: base64 JFT/SSW tidak ikut disimpan (bisa puluhan MB, quota
    // localStorage 5MB penuh -> data nyangkut). Foto dikompres 600px jadi
    // kecil dan aman disimpan untuk preview; file JFT/SSW dipilih ulang
    // kalau halaman di-reload (status lama tetap tampil dari DB).
    localStorage.setItem(
      getStorageKey(),
      JSON.stringify({
        chatHistory: chatHistory,
        latestCandidateData: latestCandidateData,
        currentPhotoBase64: currentPhotoBase64,
      }),
    );
  } catch (error) {
    console.warn('Penyimpanan lokal penuh; data teks tetap tersimpan di halaman saat ini.', error);
  }
}

// Tab terakhir yang aktif di layar < 768px + status desktop/mobile.
// Dipakai handleResize supaya rotasi layar kembali ke tab yang dipilih,
// TANPA memaksa pindah tab saat iPhone memicu "resize" tiap scroll
// (URL bar Safari naik/turun) — penyebab kolom chat "puter-puter".
var lastMobileTab = 'chat';
var wasDesktop = window.innerWidth >= 768;
export function switchTab(target) {
  lastMobileTab = target;
  if (window.innerWidth >= 768) return;
  var cPanel = $('chatPanel'),
    fPanel = $('formPanel'),
    tChat = $('btnTabChat'),
    tForm = $('btnTabForm');
  if (target === 'chat') {
    cPanel.classList.remove('hidden');
    fPanel.classList.add('hidden');
    tChat.className =
      'flex-1 py-3 text-xs font-bold bg-amber-600/20 text-amber-400 border-b-2 border-amber-500 transition-colors';
    tForm.className =
      'flex-1 py-3 text-xs font-bold text-slate-400 border-b-2 border-transparent transition-colors';
  } else {
    cPanel.classList.add('hidden');
    fPanel.classList.remove('hidden');
    tForm.className =
      'flex-1 py-3 text-xs font-bold bg-amber-600/20 text-amber-400 border-b-2 border-amber-500 transition-colors';
    tChat.className =
      'flex-1 py-3 text-xs font-bold text-slate-400 border-b-2 border-transparent transition-colors';
  }
}

function handleResize() {
  // iPhone Safari memicu "resize" tiap scroll (URL bar naik/turun) —
  // hanya bereaksi saat MENYEBRANG breakpoint md (mis. rotasi layar),
  // dan kembali ke tab terakhir yang aktif, bukan paksa "chat".
  var isDesktop = window.innerWidth >= 768;
  if (isDesktop === wasDesktop) return;
  wasDesktop = isDesktop;
  if (!isDesktop) switchTab(lastMobileTab);
}
export function handleEnter(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
}

function appendHTML(sender, text) {
  var isUser = sender === 'user';
  var cleanText = escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  // --- LOGIKA BARU: CEK FOTO KANDIDAT ---
  var userIcon = '<i class="fas fa-user"></i>'; // Icon default (jika belum ada foto)

  // Jika kandidat baru saja upload foto di sesi ini
  if (typeof currentPhotoBase64 !== 'undefined' && currentPhotoBase64) {
    userIcon =
      '<img src="data:image/jpeg;base64,' +
      currentPhotoBase64 +
      '" alt="" class="w-full h-full object-cover" onerror="this.outerHTML=\'<i class=&quot;fas fa-user&quot;></i>\'">';
  }
  // Jika kandidat sudah punya foto lama dari database
  else {
    var imgPreview = document.getElementById('previewFoto');
    if (
      imgPreview &&
      imgPreview.src &&
      imgPreview.src.length > 20 &&
      !imgPreview.classList.contains('hidden')
    ) {
      userIcon =
        '<img src="' +
        imgPreview.src +
        '" alt="" class="w-full h-full object-cover" onerror="this.outerHTML=\'<i class=&quot;fas fa-user&quot;></i>\'">';
    }
  }
  // --------------------------------------

  var aiIcon =
    '<img src="' + urlJeklin + '" alt="" class="w-full h-full object-cover rounded-full">';

  // Perhatikan tambahan class 'overflow-hidden' agar fotonya menjadi bulat sempurna
  var htmlStr =
    '<div class="flex gap-2 ' +
    (isUser ? 'flex-row-reverse' : '') +
    ' fade-in">' +
    '<div class="w-8 h-8 rounded-full overflow-hidden ' +
    (isUser ? 'bg-sky-500' : 'bg-amber-500 p-0.5') +
    ' flex-shrink-0 flex items-center justify-center text-xs text-white shadow">' +
    (isUser ? userIcon : aiIcon) +
    '</div>' +
    '<div class="bg-slate-800 p-2.5 rounded-xl ' +
    (isUser
      ? 'rounded-tr-none text-sky-100 bg-sky-900/40 border border-sky-800'
      : 'rounded-tl-none text-slate-200 border border-slate-700') +
    ' text-[11px] md:text-xs max-w-[85%] shadow leading-relaxed whitespace-pre-wrap">' +
    cleanText +
    '</div>' +
    '</div>';

  $('chatBox').innerHTML += htmlStr;
  setTimeout(function () {
    $('chatBox').scrollTop = $('chatBox').scrollHeight;
  }, 100);
}

export function sendMessage() {
  var inputEl = $('userInput'),
    btnEl = $('sendBtn');
  var text = inputEl.value.trim();
  if (!text) return;

  appendHTML('user', text);
  inputEl.value = '';
  chatHistory.push({ role: 'user', content: text });
  saveToLocal();

  inputEl.disabled = true;
  btnEl.disabled = true;

  // PERBAIKAN: Ubah teks loading saat chat dikirim agar tidak "tersangkut" teks lama
  $('aiTypingStatus').innerHTML =
    '<i class="fas fa-magic fa-spin mr-2"></i> ' + window.tr('form.ai_chat_typing');
  $('aiTypingStatus').classList.remove('hidden');

  // FIX: Trim history to last 20 messages to avoid Gemini token limit
  var trimmedHistory = chatHistory.slice(-20);
  var payloadToAI = {
    flow: formContext.flow,
    history: trimmedHistory,
    currentData: latestCandidateData,
    lang: typeof window.CURRENT_LANG !== 'undefined' ? window.CURRENT_LANG : 'id',
  };

  withRetry(function() {
      return window.callAPI('processAIChat', payloadToAI);
    }, 2, 2000)
    .then(function (res) {
      inputEl.disabled = false;
      btnEl.disabled = false;
      inputEl.focus();
      $('aiTypingStatus').classList.add('hidden');

      // Lock VIP di-enforce SERVER (AGENTS.md §6) — kalau action dipanggil
      // langsung tanpa sesi admin & kandidat non-VIP, tampilkan pesan lock.
      if (res.success === false) {
        appendHTML('ai', res.error || window.tr('ui.toast_ai_cv_locked'));
        return;
      }

      if (res.reply) {
        var finalReply = res.reply;
        if (typeof res.reply === 'string' && res.reply.startsWith('{')) {
          try {
            var p = JSON.parse(res.reply.replace(/\n/g, '\\n'));
            if (p.reply) {
              finalReply = p.reply;
            }
            if (p.data) {
              res.data = Object.assign({}, res.data, p.data);
            }
          } catch (e) {
            var match = res.reply.match(/"reply"\s*:\s*"([^]*?)"\s*,/);
            if (match && match[1]) {
              finalReply = match[1];
            }
          }
        }
        appendHTML('ai', finalReply);
        chatHistory.push({
          role: 'assistant',
          content: typeof res === 'string' ? res : JSON.stringify(res),
        });
      }
      if (res.data) {
        latestCandidateData = mergeCandidateData(latestCandidateData, res.data);
        updateFormUI();
      }
      saveToLocal();
    })
    .catch(function (err) {
      inputEl.disabled = false;
      btnEl.disabled = false;
      $('aiTypingStatus').classList.add('hidden');
      appendHTML('ai', window.tr('form.ai_chat_error'));
    });
}

function setValue(id, val) {
  var el = $(id);
  if (!el) return;
  var nextValue = val === undefined || val === null ? '' : String(val);
  if (el.value === nextValue) return;
  el.value = nextValue;
  el.classList.add('border-amber-500', 'bg-amber-900/30');
  setTimeout(function () {
    el.classList.remove('border-amber-500', 'bg-amber-900/30');
  }, 1500);
}

function renderOptionsHtml(currentVal, opts) {
  var html = '<option value="">' + window.tr('form.ai_f_pilih') + '</option>';
  var found = false;
  opts.forEach(function (o) {
    var v = Array.isArray(o) ? o[0] : o;
    var l = Array.isArray(o) ? o[1] : o;
    if (String(currentVal) === String(v)) {
      found = true;
      html += '<option value="' + escapeHtml(v) + '" selected>' + escapeHtml(l) + '</option>';
    } else html += '<option value="' + escapeHtml(v) + '">' + escapeHtml(l) + '</option>';
  });
  // Nilai lama yang tidak ada di daftar tetap ditampilkan (tidak hilang).
  if (currentVal && !found)
    html =
      '<option value="' +
      escapeHtml(currentVal) +
      '">' +
      escapeHtml(currentVal) +
      '</option>' +
      html;
  return html;
}

function renderEditableArray(type, containerId) {
  var container = $(containerId),
    items = Array.isArray(latestCandidateData[type]) ? latestCandidateData[type] : [];
  var fields = arrayFields[type];
  var cards = items
    .map(function (item, index) {
      var inputs = fields
        .map(function (definition) {
          var field = definition[0],
            label = window.tr(definition[1]),
            ctrl = definition[2],
            opts = definition[3];
          if (ctrl === 'select') {
            return (
              '<div><label class="label-micro">' +
              label +
              '</label><select class="input-micro" onchange="updateArrayField(\'' +
              type +
              "'," +
              index +
              ",'" +
              field +
              '\',this.value)">' +
              renderOptionsHtml(item[field], opts) +
              '</select></div>'
            );
          }
          if (ctrl === 'datalist') {
            return (
              '<div><label class="label-micro">' +
              label +
              '</label><input type="text" class="input-micro" list="pekerjaan-options" value="' +
              escapeHtml(item[field]) +
              '" oninput="updateArrayField(\'' +
              type +
              "'," +
              index +
              ",'" +
              field +
              '\',this.value)"></div>'
            );
          }
          return (
            '<div><label class="label-micro">' +
            label +
            '</label><input type="text" class="input-micro" value="' +
            escapeHtml(item[field]) +
            '" oninput="updateArrayField(\'' +
            type +
            "'," +
            index +
            ",'" +
            field +
            '\',this.value)"></div>'
          );
        })
        .join('');
      return (
        '<div class="bg-slate-800 p-2 rounded border border-slate-700 text-[9px] mb-1.5"><div class="flex justify-between items-center mb-1"><span class="font-bold text-slate-300">' +
        window.tr('form.ai_f_data') +
        ' ' +
        (index + 1) +
        '</span><button type="button" class="text-rose-300 hover:text-rose-200" onclick="removeArrayItem(\'' +
        type +
        "'," +
        index +
        ')"><i class="fas fa-trash"></i> ' +
        window.tr('form.ai_f_hapus') +
        '</button></div><div class="grid grid-cols-2 gap-1.5">' +
        inputs +
        '</div></div>'
      );
    })
    .join('');
  if (!cards)
    cards =
      '<div class="text-[9px] text-slate-500 italic py-1">' +
      window.tr('form.txt_belum_data') +
      '</div>';
  container.innerHTML =
    cards +
    '<button type="button" class="w-full mt-1 py-1 text-[9px] font-bold rounded border border-dashed border-slate-600 text-slate-300 hover:bg-slate-800" onclick="addArrayItem(\'' +
    type +
    '\')"><i class="fas fa-plus mr-1"></i>' +
    window.tr('form.ai_f_tambah') +
    '</button>';
}

export function updateFormUI() {
  latestCandidateData =
    latestCandidateData && typeof latestCandidateData === 'object' ? latestCandidateData : {};
  Object.keys(fieldPaths).forEach(function (id) {
    setValue(id, getByPath(latestCandidateData, fieldPaths[id]));
  });
  renderEditableArray('pendidikan', 'c_pendidikan');
  renderEditableArray('pekerjaan', 'c_pekerjaan');
  renderEditableArray('keluarga', 'c_keluarga');

  // --- MUNCULKAN FOTO LAMA DARI DATABASE ---
  var photoUrl = latestCandidateData.pas_photo || getByPath(latestCandidateData, 'uploads.photo');
  var imgPreview = $('previewFoto');

  // Jika ada URL foto di database, BUKAN tanda strip, dan pelamar belum upload foto baru
  if (photoUrl && photoUrl !== '-' && !currentPhotoBase64 && imgPreview) {
    // Foto di Supabase Storage - langsung dirender.
    imgPreview.src = photoUrl;
    imgPreview.classList.remove('hidden');
  }
  // ------------------------------------------------------

  // --- TAMPILKAN BERKAS YANG SUDAH PERNAH UPLOAD DARI DATABASE ---
  // (kecuali user sudah pilih file baru di sesi ini — kalau mau nimpa file
  //  lama, tinggal pilih file baru; kalau tidak, status lama tetap tampil)
  [
    ['jft', 'status_jft', !!currentJftBase64],
    ['ssw', 'status_ssw', !!currentSswBase64],
    ['ktp', 'status_ktp', !!currentKtpFile],
    ['kk', 'status_kk', !!currentKkFile],
    ['ijazahSd', 'status_ijazahSd', !!currentIjazahSdFile],
    ['ijazahSmp', 'status_ijazahSmp', !!currentIjazahSmpFile],
    ['ijazahSma', 'status_ijazahSma', !!currentIjazahSmaFile],
    ['univ', 'status_univ', !!currentUnivFile],
  ].forEach(function (pair) {
    var key = pair[0] as string,
      statusId = pair[1] as string,
      sudahPilihBaru = pair[2] as boolean;
    var url = getByPath(latestCandidateData, 'uploads.' + key);
    var statusEl = $(statusId);
    if (!statusEl || sudahPilihBaru) return;
    if (url && url !== '-') {
      var namaFile = escapeHtml((url.split('/').pop() || key.toUpperCase()).replace(/_+/g, ' '));
      statusEl.innerHTML =
        '<i class="fas fa-check-circle"></i> ' +
        window.tr('form.ai_status_existing') +
        ': ' +
        '<a href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener" class="underline hover:text-amber-300">' +
        namaFile +
        '</a>';
      statusEl.classList.remove('hidden');
    }
  });
  // ------------------------------------------------------
}

export function compressImage(event) {
  var file = event.target.files[0];
  if (!file) return;
  // Guard seragam: format (image/*) + ukuran maks 10 MB — pesan jelas + reset.
  if (!window.cekUploadFile(event.target, { maxMb: 10 })) return;
  var status = $('compressStatus'),
    preview = $('previewFoto');
  status.classList.remove('hidden');
  status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + window.tr('form.ai_f_proses');
  var reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function (e) {
    var img = new Image();
    // @ts-expect-error JS→TS migration
    img.src = e.target.result;
    img.onload = function () {
      var canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');
      var w = img.width,
        h = img.height,
        MAX = 600;
      if (w > h && w > MAX) {
        h *= MAX / w;
        w = MAX;
      } else if (h > MAX) {
        w *= MAX / h;
        h = MAX;
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      preview.src = dataUrl;
      preview.classList.remove('hidden');
      status.innerHTML = '<i class="fas fa-check-circle"></i> ' + window.tr('form.ai_f_berhasil');
      currentPhotoBase64 = dataUrl.split(',')[1];
      saveToLocal();
    };
  };
}

// Downscale scan gambar (foto sertifikat JFT/SSW) saat upload — canvas
// max 800px, jpeg q0.8, supaya byte Storage kecil selamanya. Non-gambar
// (pdf) / gagal-decode (HEIC/korup) / tak lebih kecil → base64 asli.
function downscaleScanImage(file, maxWidth, quality, callback) {
  var reader = new FileReader();
  reader.onerror = function () {
    callback({ data: '', name: file.name, mime: file.type || 'application/octet-stream' });
  };
  reader.onload = function (e) {
    // @ts-expect-error JS→TS migration
    var asli = e.target.result.split(',')[1];
    if (
      !file.type ||
      !file.type.startsWith('image/') ||
      file.type === 'image/svg+xml' ||
      file.type === 'image/gif'
    ) {
      return callback({
        data: asli,
        name: file.name,
        mime: file.type || 'application/octet-stream',
      });
    }
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');
      var w = img.width,
        h = img.height,
        MAX = maxWidth || 800;
      if (w > MAX) {
        h = Math.round((h * MAX) / w);
        w = MAX;
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/jpeg', quality || 0.8);
      var b64 = dataUrl.split(',')[1];
      var approxBytes = Math.floor((b64.length / 4) * 3);
      if (!b64 || approxBytes >= file.size)
        return callback({
          data: asli,
          name: file.name,
          mime: file.type || 'application/octet-stream',
        });
      callback({
        data: b64,
        name: String(file.name || 'scan').replace(/\.[^/.]+$/, '') + '.jpg',
        mime: 'image/jpeg',
      });
    };
    // FIX: gambar image/ tapi gagal decode (HEIC/korup) → pakai asli,
    // jangan menggantung status "Membaca…"
    img.onerror = function () {
      callback({ data: asli, name: file.name, mime: file.type || 'application/octet-stream' });
    };
    // @ts-expect-error JS→TS migration
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function handleDocUpload(event, type) {
  var file = event.target.files[0];
  if (!file) return;
  // Guard seragam: format sesuai accept + ukuran maks 3 MB — pesan jelas + reset.
  if (!window.cekUploadFile(event.target, { maxMb: 3 })) return;
  var statusEl = $('status_' + type);
  statusEl.classList.remove('hidden');
  statusEl.innerHTML =
    '<i class="fas fa-spinner fa-spin text-amber-400"></i> ' + window.tr('form.ai_f_membaca');
  // Downscale scan gambar dulu; pdf & gagal-decode dibiarkan utuh oleh helper.
  downscaleScanImage(file, 800, 0.8, function (hasil) {
    if (type === 'jft') {
      currentJftBase64 = hasil.data;
      currentJftFile = hasil;
    }
    if (type === 'ssw') {
      currentSswBase64 = hasil.data;
      currentSswFile = hasil;
    }
    if (type === 'ktp') {
      currentKtpFile = hasil;
    }
    if (type === 'kk') {
      currentKkFile = hasil;
    }
    if (type === 'ijazahSd') {
      currentIjazahSdFile = hasil;
    }
    if (type === 'ijazahSmp') {
      currentIjazahSmpFile = hasil;
    }
    if (type === 'ijazahSma') {
      currentIjazahSmaFile = hasil;
    }
    if (type === 'univ') {
      currentUnivFile = hasil;
    }
    statusEl.innerHTML = '<i class="fas fa-check-circle"></i> File: ' + hasil.name;
    saveToLocal();
  });
}

function base64ToBlob(base64, mime) {
  var byteCharacters = atob(base64);
  var byteArrays = [];
  for (var offset = 0; offset < byteCharacters.length; offset += 512) {
    var slice = byteCharacters.slice(offset, offset + 512);
    var byteNumbers = new Array(slice.length);
    for (var i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mime });
}

async function uploadFilesDirectlyBase64(filesObj, folder) {
  var toUpload = Object.keys(filesObj).filter(function (k) {
    return filesObj[k] && filesObj[k].data;
  });
  if (toUpload.length === 0) return {};

  // Upload LANGSUNG ke Cloudinary: base64 hasil downscaleScanImage diubah
  // kembali jadi File, lalu dikirim ke Cloudinary. Backend hanya menerima
  // string URL hasil upload (tidak ada lagi getUploadUrls / Supabase).
  var uploadPromises = toUpload.map(function(key) {
    var file = filesObj[key];
    var blob = base64ToBlob(file.data, file.mime);
    var f = new File([blob], file.name || key + '.jpg', {
      type: file.mime || 'application/octet-stream',
    });
    return uploadToCloudinary(f, {}).then(function(url) { return { key: key, url: url }; });
  });
  var results = await Promise.all(uploadPromises);
  var uploadedUrls: Record<string, any> = {};
  results.forEach(function(r) { uploadedUrls[r.key] = r.url; });
  return uploadedUrls;
}

export async function saveToDatabase() {
  var btn = $('btnSaveDB');
  latestCandidateData =
    latestCandidateData && typeof latestCandidateData === 'object' ? latestCandidateData : {};
  // Jaring penyaman: kalau state nama kosong padahal siswa sudah mengetiknya
  // di field form (mis. autofill dari database menimpa state setelah input),
  // pakai nilai yang terlihat di layar — jangan batalkan penyimpanan.
  var namaDom = $('f_nama');
  if (!latestCandidateData.identitas || !latestCandidateData.identitas.nama_lengkap) {
    if (namaDom && String(namaDom.value || '').trim()) {
      setByPath(latestCandidateData, 'identitas.nama_lengkap', String(namaDom.value).trim());
    }
  }
  // FIX (2026-09-02, laporan "pencet SIMPAN DB tidak ada tulisan sama sekali"):
  // halaman standalone tidak punya #toast-container, jadi showToast() diam saja
  // dan semua pesan hilang (sudah diperbaiki di js/init/util.ts — showToast
  // sekarang membuat wadahnya sendiri). Di sini ditambah jejak console supaya
  // kalau pesan tetap tidak terbaca, penyebabnya bisa dilihat dari DevTools.
  if (!latestCandidateData.identitas || !latestCandidateData.identitas.nama_lengkap) {
    console.warn('[saveToDatabase] dibatalkan: identitas.nama_lengkap masih kosong');
    window.showToast(window.tr('form.ai_empty_chat_hint'), 'error');
    // Tandai field nama supaya jelas apa yang kurang (bukan hanya toast).
    var namaEl = $('f_nama');
    if (namaEl) {
      namaEl.classList.remove('border-sky-400');
      namaEl.classList.add('border-rose-500');
      try {
        namaEl.focus();
      } catch (e) {
        /* fokus gagal (mis. keyboard belum muncul) — tidak fatal */
      }
    }
    if (window.innerWidth < 768) switchTab('chat');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + window.tr('form.ai_saving_db') + '…';

  // Guard ekstensi: cek SEMUA file dokumen SEBELUM kirim — format baku
  // (2026-08-12, rev): JFT/SSW/ijazah/UNIV wajib PDF; KTP/KK boleh foto HP
  // (JPG/PNG — otomatis di-downscale handleDocUpload) ATAU PDF. Pas foto
  // sudah dijamin JPG/PNG oleh compressImage (canvas). Sinkron dengan
  // aturan per-prefix di storage-helper.ts.
  var extCheck = [
    { f: currentJftFile, t: 'doc' },
    { f: currentSswFile, t: 'doc' },
    { f: currentKtpFile, t: 'foto' },
    { f: currentKkFile, t: 'foto' },
    { f: currentIjazahSdFile, t: 'doc' },
    { f: currentIjazahSmpFile, t: 'doc' },
    { f: currentIjazahSmaFile, t: 'doc' },
    { f: currentUnivFile, t: 'doc' },
  ].filter(function (x) {
    return !!x.f;
  });
  for (var ei = 0; ei < extCheck.length; ei++) {
    var nm = String(extCheck[ei].f.name || '')
      .split('.')
      .pop()
      .toLowerCase();
    var ok = extCheck[ei].t === 'foto' ? ['pdf', 'jpg', 'jpeg', 'png'] : ['pdf'];
    if (ok.indexOf(nm) === -1) {
      btn.disabled = false;
      btn.innerHTML = window.tr('form.ai_save_db');
      window.showToast(
        window.tr('form.ai_ext_check_bad').replace('{file}', extCheck[ei].f.name || 'file'),
        'error',
      );
      return;
    }
  }

  try {
    var folderName =
      'master/' +
      latestCandidateData.identitas.nama_lengkap.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    var filesToUpload = {
      fotoFile: currentPhotoBase64
        ? { data: currentPhotoBase64, name: 'PAS_PHOTO.jpg', mime: 'image/jpeg' }
        : null,
      jftFile: currentJftFile,
      sswFile: currentSswFile,
      ktpFile: currentKtpFile,
      kkFile: currentKkFile,
      ijazahSdFile: currentIjazahSdFile,
      ijazahSmpFile: currentIjazahSmpFile,
      ijazahSmaFile: currentIjazahSmaFile,
      univFile: currentUnivFile,
    };
    btn.innerHTML = '<i class="fas fa-cloud-upload-alt fa-spin"></i> Mengunggah dokumen...';
    var uploadedUrls = await uploadFilesDirectlyBase64(filesToUpload, folderName);

    var payload = {
      identitas: latestCandidateData.identitas,
      fisik: latestCandidateData.fisik,
      medis: latestCandidateData.medis,
      pendidikan: latestCandidateData.pendidikan,
      pekerjaan: latestCandidateData.pekerjaan,
      sertifikasi: latestCandidateData.sertifikasi,
      keluarga: latestCandidateData.keluarga,
      wawancara: latestCandidateData.wawancara,
      context: formContext,
      fotoFile: uploadedUrls.fotoFile || null,
      jftFile: uploadedUrls.jftFile || null,
      sswFile: uploadedUrls.sswFile || null,
      ktpFile: uploadedUrls.ktpFile || null,
      kkFile: uploadedUrls.kkFile || null,
      ijazahSdFile: uploadedUrls.ijazahSdFile || null,
      ijazahSmpFile: uploadedUrls.ijazahSmpFile || null,
      ijazahSmaFile: uploadedUrls.ijazahSmaFile || null,
      univFile: uploadedUrls.univFile || null,
    };

    btn.innerHTML = '<i class="fas fa-paper-plane fa-spin"></i> Menyimpan data...';
    try {
      var res = await withRetry(function() { return window.callAPI('submitDataAsj', payload); }, 2, 2000);
      btn.disabled = false;
      if (res.success) {
        btn.innerHTML = '<i class="fas fa-check"></i> ' + window.tr('form.ai_save_success_btn');
        btn.classList.replace('bg-emerald-600', 'bg-sky-600');
        window.showToast(window.tr('form.ai_save_success'), 'success');
      } else {
        window.showToast(window.tr('form.ai_save_failed') + ' ' + (res.message || ''), 'error');
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> ' + window.tr('form.ai_save_db');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-cloud-upload-alt"></i> ' + window.tr('form.ai_save_db');
      console.error('[saveToDatabase] submitDataAsj gagal:', err);
      window.showToast(window.tr('form.ai_save_failed') + ' ' + (err.message || ''), 'error');
    }
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> ' + window.tr('form.ai_save_db');
    console.error('[saveToDatabase] upload dokumen gagal:', e);
    window.showToast(window.tr('form.ai_upload_failed') + ' ' + (e.message || ''), 'error');
  }
}

// Bridge ESM→legacy (Fase 3 langkah 13): HTML onclick/onchange/onload +
// string onclick dinamis dari renderEditableArray tetap butuh global —
// kini SEMUA alias seam HTML diregistrasikan TERPUSAT via
// registerSeamAliases (js/core/bridge.js).
registerSeamAliases({
  initApp,
  switchTab,
  handleEnter,
  sendMessage,
  updateFormUI,
  compressImage,
  handleDocUpload,
  saveToDatabase,
  updateArrayField,
  removeArrayItem,
  addArrayItem,
});
