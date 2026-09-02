import {
  ALL_CANDIDATES,
  ALL_CANDIDATES_TOTAL,
  ALL_JOBS,
  currentAdminName,
  currentKandidatWa,
} from '../init/state.ts';
import { renderLanguage } from '../01_public.ts';
import { renderAdminFull } from '../render/admin.ts';
import { normalizeGenderValue } from '../03_candidate.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// 9. INTERAKSI BACKEND — DOMAIN KANDIDAT (candidates)
// ==========================================
// js/api/{forms,jobs,candidates,wa}.js (global scope TETAP di fase ini).
// File ini: modal Input Kandidat Manual (cari/pilih otomatis), upload
// kandidat (simpanKandidatDanUpload + baris dokumen lain dinamis), Super
// Edit Kandidat, upload revisi CV, QR loker lokal, filter checkbox, &
export function bukaModalTambahKandidat() {
  document.getElementById('modal-tambah-kandidat').classList.remove('hidden');
  var searchEl = document.getElementById('search-kandidat-manual');
  var ddEl = document.getElementById('dropdown-kandidat-manual');
  if (searchEl) searchEl.value = '';
  if (ddEl) {
    ddEl.classList.add('hidden');
    ddEl.innerHTML = '';
  }
  // Reset state auto-gelap JFT/SSW (form baru, kandidat belum dipilih).
  if (typeof cekDokumenSebelumnya === 'function') cekDokumenSebelumnya('');
  // Baris dokumen lain mulai dari 1 baris kosong.
  initLainRows('k');
}

// FIX: field pencarian "CARI KANDIDAT TERDAFTAR" di modal Input Kandidat Manual
// memanggil cariKandidatManual() lewat onkeyup, tapi fungsi ini belum pernah
// dibuat - jadi setiap ketik langsung error di console dan dropdown tidak
// pernah muncul. Pola di bawah ini mengikuti auto-fill kandidat lama yang
// sudah ada, tapi sebagai dropdown live-search (bukan <datalist>).
export function cariKandidatManual(query) {
  var ddEl = document.getElementById('dropdown-kandidat-manual');
  if (!ddEl) return;
  query = (query || '').trim().toLowerCase();
  if (query.length < 2) {
    ddEl.classList.add('hidden');
    ddEl.innerHTML = '';
    return;
  }

  var seenWa: Record<string, any> = {};
  var hasil = (ALL_CANDIDATES || [])
    .filter(function (c) {
      if (!c.wa || seenWa[c.wa]) return false;
      var match =
        (c.nama || '').toLowerCase().indexOf(query) >= 0 || (c.wa || '').indexOf(query) >= 0;
      if (match) {
        seenWa[c.wa] = true;
        return true;
      }
      return false;
    })
    .slice(0, 8);

  if (hasil.length === 0) {
    ddEl.innerHTML =
      '<div class="p-2.5 text-sm text-slate-400">' + window.tr('ui.not_found') + '</div>';
  } else {
    ddEl.innerHTML = hasil
      .map(function (c) {
        return (
          '<div class="p-2.5 text-sm text-white hover:bg-sky-600/30 cursor-pointer border-b border-slate-700 last:border-0" onclick="pilihKandidatManual(\'' +
          window.escJs(c.wa) +
          '\') ">' +
          '<div class="font-semibold">' +
          window.esc(c.nama || '-') +
          '</div>' +
          '<div class="text-xs text-slate-400">' +
          window.esc(c.wa || '-') +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }
  ddEl.classList.remove('hidden');
}

export function pilihKandidatManual(wa) {
  var found = (ALL_CANDIDATES || []).find(function (c) {
    return c.wa === wa;
  });
  if (!found) return;
  var namaEl = document.getElementById('k-nama');
  var waEl = document.getElementById('k-wa');
  if (namaEl) namaEl.value = found.nama || '';
  if (waEl) waEl.value = found.wa || '';
  // Auto-fill data fisik kalau kandidat sudah punya profil (mapCandidate
  // sekarang mengisi dari master) - admin tidak perlu mengetik ulang.
  var g = found.gender;
  if (g === 'L') g = 'LAKI-LAKI';
  else if (g === 'P') g = 'PEREMPUAN';
  var map = {
    'k-gender': g,
    'k-usia': found.usia,
    'k-tb': found.tb,
    'k-bb': found.bb,
    'k-pendidikan': found.pendidikan,
  };
  Object.keys(map).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var v = map[id];
    el.value = v && v !== '-' ? v : '';
  });
  var searchEl = document.getElementById('search-kandidat-manual');
  var ddEl = document.getElementById('dropdown-kandidat-manual');
  if (searchEl) searchEl.value = (found.nama || '') + ' - ' + (found.wa || '');
  if (ddEl) {
    ddEl.classList.add('hidden');
    ddEl.innerHTML = '';
  }
  // Auto-gelapkan JFT/SSW kalau kandidat sudah pernah upload (cukup CV).
  cekDokumenSebelumnya(wa);
}

// ===== AUTO-DETECT DOKUMEN SEBELUMNYA (modal Input Kandidat + Edit Super) =====
// Kalau kandidat sudah pernah upload dokumen, field upload-nya di-gelapkan
// (disabled) + tampilkan "Sudah pernah upload: [nama file]" sebagai helper.
// Cek SEMUA tipe dokumen: photo, CV, JFT, SSW, KTP, KK, ijazah, dll.
export function cekDokumenSebelumnya(wa) {
  var c = (ALL_CANDIDATES || []).find(function (x) {
    return window.normalizePhone(String(x.wa || '')) === window.normalizePhone(String(wa || ''));
  });
  var setDok = function (inputId, statusId, label, punya, fileUrl) {
    var input = document.getElementById(inputId);
    var st = document.getElementById(statusId);
    if (punya && input) {
      input.disabled = true;
      input.classList.add('opacity-40', 'cursor-not-allowed');
      if (st) {
        var namaFile = '';
        if (fileUrl && fileUrl !== '-') {
          try {
            namaFile = fileUrl.split('/').pop() || '';
          } catch (e) {}
          namaFile = namaFile.replace(/_+/g, ' ').replace(/\.[^.]+$/, '');
        }
        st.innerHTML =
          '<span class="text-emerald-400"><i class="fas fa-check-circle mr-0.5"></i>' +
          label +
          ' ' +
          window.tr('ui.doc_already_uploaded') +
          (namaFile ? ': ' + namaFile : '') +
          '</span>';
      }
    } else {
      if (input) {
        input.disabled = false;
        input.classList.remove('opacity-40', 'cursor-not-allowed');
      }
      if (st) st.innerHTML = '';
    }
  };
  // Photo & CV — dari database_candidate
  setDok(
    'k-photo',
    'st-photo',
    'PAS PHOTO',
    !!(c && c.pasPhoto && c.pasPhoto !== '-'),
    c ? c.pasPhoto : '',
  );
  setDok('k-cv', 'st-cv', 'CV', !!(c && c.fileCv && c.fileCv !== '-'), c ? c.fileCv : '');
  // JFT & SSW
  setDok(
    'k-jft',
    'st-jft',
    'JFT',
    !!(c && (c.jftUrl || c.jft) && (c.jftUrl || c.jft) !== '-'),
    c ? c.jftUrl || c.jft : '',
  );
  setDok(
    'k-ssw',
    'st-ssw',
    'SSW',
    !!(c && (c.sswUrl || c.ssw) && (c.sswUrl || c.ssw) !== '-'),
    c ? c.sswUrl || c.ssw : '',
  );
  // Edit Super modal upload IDs
  setDok(
    'edit-k-photo',
    'edit-k-st-photo',
    'PAS PHOTO',
    !!(c && c.pasPhoto && c.pasPhoto !== '-'),
    c ? c.pasPhoto : '',
  );
  setDok(
    'edit-k-cv',
    'edit-k-st-cv',
    'CV',
    !!(c && c.fileCv && c.fileCv !== '-'),
    c ? c.fileCv : '',
  );
  setDok(
    'edit-k-file-jft',
    'edit-k-st-jft',
    'JFT',
    !!(c && (c.jftUrl || c.jft) && (c.jftUrl || c.jft) !== '-'),
    c ? c.jftUrl || c.jft : '',
  );
  setDok(
    'edit-k-file-ssw',
    'edit-k-st-ssw',
    'SSW',
    !!(c && (c.sswUrl || c.ssw) && (c.sswUrl || c.ssw) !== '-'),
    c ? c.sswUrl || c.ssw : '',
  );
}

// Dipanggil saat WA di-blur di modal Input Kandidat: kalau nama/WA cocok
// dengan kandidat terdaftar, auto-fill data + auto-gelapkan JFT/SSW.
export function cekKandidatOtomatis() {
  var waEl = document.getElementById('k-wa');
  var wa = waEl ? String(waEl.value || '').replace(/\D/g, '') : '';
  if (!wa) return;
  var c = (ALL_CANDIDATES || []).find(function (x) {
    return window.normalizePhone(String(x.wa || '')) === window.normalizePhone(wa);
  });
  if (!c) {
    cekDokumenSebelumnya('');
    return;
  }
  var namaEl = document.getElementById('k-nama');
  if (namaEl && !namaEl.value) {
    namaEl.value = c.nama || '';
    var g = c.gender;
    if (g === 'L') g = 'LAKI-LAKI';
    else if (g === 'P') g = 'PEREMPUAN';
    var map = {
      'k-gender': g,
      'k-usia': c.usia,
      'k-tb': c.tb,
      'k-bb': c.bb,
      'k-pendidikan': c.pendidikan,
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var v = map[id];
      el.value = v && v !== '-' ? v : '';
    });
    var searchEl = document.getElementById('search-kandidat-manual');
    if (searchEl && !searchEl.value) searchEl.value = (c.nama || '') + ' - ' + (c.wa || '');
  }
  cekDokumenSebelumnya(wa);
}

// ===== INDIKATOR STATUS UPLOAD (modal Input Manual) =====
// Saat file dipilih di <input type=file> -> tampilkan "terpilih"
export function tandaiFileDipilih(inputId, statusId, label) {
  var el = document.getElementById(statusId);
  var input = document.getElementById(inputId);
  if (!el) return;
  if (input && input.files && input.files.length > 0) {
    el.innerHTML =
      '<span class="text-amber-300"><i class="fas fa-paperclip mr-0.5"></i>' +
      label +
      ' ' +
      window.tr('ui.file_selected') +
      '</span>';
  } else {
    el.innerHTML = '';
  }
}

// Status per file: uploading / ok / fail / none
export function setUploadStatus(statusId, label, state) {
  var el = document.getElementById(statusId);
  if (!el) return;
  if (state === 'uploading')
    el.innerHTML =
      '<span class="text-sky-300"><i class="fas fa-spinner fa-spin mr-0.5"></i>' +
      label +
      ' ' +
      window.tr('ui.file_uploading') +
      '</span>';
  else if (state === 'ok')
    el.innerHTML =
      '<span class="text-emerald-400"><i class="fas fa-check-circle mr-0.5"></i>' +
      label +
      ' ' +
      window.tr('ui.file_uploaded') +
      '</span>';
  else if (state === 'fail')
    el.innerHTML =
      '<span class="text-rose-400"><i class="fas fa-times-circle mr-0.5"></i>' +
      label +
      ' ' +
      window.tr('ui.file_failed') +
      '</span>';
  else if (state === 'none')
    el.innerHTML =
      '<span class="text-slate-500"><i class="fas fa-minus-circle mr-0.5"></i>' +
      label +
      ' ' +
      window.tr('ui.file_none') +
      '</span>';
}

export function markUploadResults(labels, okList) {
  var all = [
    ['st-photo', 'PAS_PHOTO', 'PAS PHOTO'],
    ['st-cv', 'CV', 'CV'],
    ['st-jft', 'JFT', 'JFT'],
    ['st-ssw', 'SSW', 'SSW'],
  ];
  all.forEach(function (x) {
    var sel = labels.indexOf(x[1]) >= 0;
    var ok = (okList || []).indexOf(x[1]) >= 0;
    setUploadStatus(x[0], x[2], ok ? 'ok' : sel ? 'fail' : 'none');
  });
}

export function resetUploadStatus() {
  [
    'st-photo',
    'st-cv',
    'st-jft',
    'st-ssw',
    'edit-k-st-photo',
    'edit-k-st-cv',
    'edit-k-st-jft',
    'edit-k-st-ssw',
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  // Status baris dokumen lain (dinamis, per baris: k-st-lain-N / edit-k-st-lain-N).
  document.querySelectorAll('[id^="k-st-lain-"], [id^="edit-k-st-lain-"]').forEach(function (el) {
    if (el) el.innerHTML = '';
  });
}

// ===== BARIS DOKUMEN LAIN DINAMIS (modal Input Kandidat & Super Edit) =====
// Admin bisa upload >1 dokumen lain sekaligus: tombol + menambah baris,
// tombol − menghapus (minimal 1 baris tersisa). Prefix: 'k' (Input Manual)
// atau 'edit-k' (Super Edit Kandidat).
export var LAIN_JENIS_OPTIONS =
  '<option value="PAS PHOTO">PAS PHOTO</option>' +
  '<option value="CV">CV</option>' +
  '<option value="JFT">JFT (Sertifikat Bahasa Jepang)</option>' +
  '<option value="SSW">SSW (Sertifikat SSW)</option>' +
  '<option value="KTP">KTP</option>' +
  '<option value="KK">KK (Kartu Keluarga)</option>' +
  '<option value="AKTE">AKTE KELAHIRAN</option>' +
  '<option value="IJAZAH SD">IJAZAH SD</option>' +
  '<option value="IJAZAH SMP">IJAZAH SMP</option>' +
  '<option value="IJAZAH SMA">IJAZAH SMA</option>' +
  '<option value="UNIVERSITAS">IJAZAH UNIVERSITAS</option>' +
  '<option value="SIM">SIM (Surat Izin Mengemudi)</option>' +
  '<option value="PASPORT">PASPORT</option>' +
  '<option value="MCU">MCU (Medical Check Up)</option>' +
  '<option value="EKTLN">EKTLN (Kartu Tenaga Kerja)</option>' +
  '<option value="KONTRAK KERJA">KONTRAK KERJA</option>' +
  '<option value="SERTIFIKAT JAPAN">SERTIFIKAT JAPAN</option>' +
  '<option value="SURAT IJIN ORTU">SURAT IJIN ORTU</option>' +
  '<option value="PERNYATAAN CPMI">PERNYATAAN CPMI</option>' +
  '<option value="STATUS PERKAWINAN">STATUS PERKAWINAN</option>' +
  '<option value="SURAT SEHAT">SURAT SEHAT PUSKESMAS</option>' +
  '<option value="BPJS">BPJS KETENAGAKERJAAN</option>' +
  '<option value="PSIKOTES">HASIL PSIKOTES</option>' +
  '<option value="LAINNYA">LAINNYA</option>';

export function renderLainRow(prefix, idx) {
  return (
    '<div class="grid grid-cols-2 gap-2" data-lain-row>' +
    '<div><label class="block text-[10px] font-bold text-slate-400 mb-1" data-lang="admin.form_other_docs_type">JENIS DOKUMEN</label>' +
    '<select id="' +
    prefix +
    '-lain-jenis-' +
    idx +
    '" class="w-full p-2.5 rounded-lg bg-black/60 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500 transition">' +
    LAIN_JENIS_OPTIONS +
    '</select></div>' +
    '<div><label class="block text-[10px] font-bold text-slate-400 mb-1" data-lang="admin.form_other_docs_file">FILE (PDF/Gambar)</label>' +
    '<input type="file" id="' +
    prefix +
    '-lain-' +
    idx +
    '" accept=".pdf,.jpg,.jpeg,.png" onchange="tandaiFileDipilih(\'' +
    prefix +
    '-lain-' +
    idx +
    "','" +
    prefix +
    '-st-lain-' +
    idx +
    '\',\'DOKUMEN\')" class="w-full text-sm text-slate-400 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-slate-700 file:text-white">' +
    '</div>' +
    '<div class="col-span-2 flex items-center justify-between gap-2">' +
    '<span id="' +
    prefix +
    '-st-lain-' +
    idx +
    '" class="block text-xs font-bold h-4"></span>' +
    '<div class="flex gap-1.5">' +
    '<button type="button" onclick="tambahBarisLain(\'' +
    prefix +
    '\')" class="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg leading-none transition" aria-label="' +
    window.tr('admin.add_doc') +
    '" title="' +
    window.tr('admin.add_doc') +
    '"><i class="fas fa-plus"></i></button>' +
    '<button type="button" onclick="hapusBarisLain(this,\'' +
    prefix +
    '\')" class="w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-lg leading-none transition" aria-label="' +
    window.tr('admin.remove_doc') +
    '" title="' +
    window.tr('admin.remove_doc') +
    '"><i class="fas fa-minus"></i></button>' +
    '</div></div></div>'
  );
}

export function initLainRows(prefix) {
  var container = document.getElementById(prefix + '-lain-rows');
  if (!container) return;
  container.innerHTML = renderLainRow(prefix, 0);
  if (typeof renderLanguage === 'function') renderLanguage();
}

// ===== BERKAS TERSIMPAN (Super Edit Kandidat) =====
// Tampilkan daftar berkas pemberkasan yang SUDAH ada (c.berkas dari
// pemberkasan_checklist) sebagai chip read-only dengan link buka, supaya
// admin langsung lihat "dokumen lengkap" kandidat sebelum menambah.
export var BERKAS_TAMPIL_LABEL = {
  kk: 'KK',
  akte: 'AKTE',
  sd: 'IJAZAH SD',
  smp: 'IJAZAH SMP',
  sma: 'IJAZAH SMA',
  univ: 'UNIVERSITAS',
  pasport: 'PASPORT',
  mcu: 'MCU',
  kontrak: 'KONTRAK KERJA',
  cert: 'CERTIFICATE JAPAN',
  ktp: 'KTP',
  foto2: 'PAS FOTO STUDIO',
  ijinortu: 'SURAT IJIN ORTU',
  cpmi: 'PERNYATAAN CPMI',
  kawin: 'STATUS PERKAWINAN',
  sehat: 'SURAT SEHAT PUSKESMAS',
  bpjs: 'BPJS KETENAGAKERJAAN',
  psikotes: 'HASIL PSIKOTES',
};
export function renderBerkasTersimpan(berkas) {
  var box = document.getElementById('edit-k-berkas-ada');
  if (!box) return;
  if (!berkas || Object.keys(berkas).length === 0) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  var chips = '';
  Object.keys(berkas).forEach(function (k) {
    var url = String(berkas[k] || '');
    if (!url || url === '-') return;
    var label = BERKAS_TAMPIL_LABEL[k] || k.toUpperCase();
    var safe = url.replace(/'/g, "\\'");
    // Label adalah teks tampil chip (sudah terlihat), jadi tanpa title=
    // — audit i18n menolak title dinamis yang bukan tr().
    chips +=
      '<a href="' +
      url +
      '" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold hover:bg-emerald-800/60 transition"><i class="fas fa-file-alt"></i> ' +
      label +
      '</a>';
  });
  if (!chips) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML =
    '<p class="text-[10px] font-bold text-emerald-400 mb-1.5"><i class="fas fa-check-circle mr-1"></i><span data-lang="ui.berkas_tersimpan">Berkas Sudah Tersimpan</span>:</p><div class="flex flex-wrap gap-1.5">' +
    chips +
    '</div>';
  if (typeof renderLanguage === 'function') renderLanguage();
}

export function tambahBarisLain(prefix) {
  var container = document.getElementById(prefix + '-lain-rows');
  if (!container) return;
  var idx = container.children.length;
  container.insertAdjacentHTML('beforeend', renderLainRow(prefix, idx));
  if (typeof renderLanguage === 'function') renderLanguage();
}

export function hapusBarisLain(btn, prefix) {
  var container = document.getElementById(prefix + '-lain-rows');
  if (!container || container.children.length <= 1) return;
  var row = btn.closest('[data-lain-row]');
  if (row) row.remove();
}

// Kumpulkan semua baris dokumen lain yang punya file terpilih.
export function collectLainRows(prefix) {
  var out = [];
  var container = document.getElementById(prefix + '-lain-rows');
  if (!container) return out;
  Array.prototype.forEach.call(container.children, function (row) {
    var input = row.querySelector('input[type=file]');
    if (!input || !input.files || input.files.length === 0) return;
    var sel = row.querySelector('select');
    var st = row.querySelector('span');
    out.push({ jenis: sel ? sel.value : 'LAINNYA', input: input, stId: st ? st.id : '' });
  });
  return out;
}

// ===== GUARD FILE UPLOAD (UKURAN + EKSTENSI) =====
// cekUkuranFile/cekEkstensiFile/MAX_FILE_MB didefinisikan di 03_candidate.js
// (file yang dimuat PALING AWAL di semua halaman) — satu sumber kebenaran
// untuk semua jalur upload. Di sini wrapper untuk cek semua input modal admin.
// Periksa SEMUA file (foto/CV/JFT/SSW + semua baris dokumen lain): ukuran
// dulu, lalu ekstensi — user langsung dapat toast tanpa nunggu server.
export function cekSemuaUkuranFile(lainPrefix) {
  var errs = [
    window.cekUkuranFile(document.getElementById(lainPrefix + '-photo')),
    window.cekUkuranFile(document.getElementById(lainPrefix + '-cv')),
    window.cekUkuranFile(
      document.getElementById(lainPrefix === 'edit-k' ? 'edit-k-file-jft' : lainPrefix + '-jft'),
    ),
    window.cekUkuranFile(
      document.getElementById(lainPrefix === 'edit-k' ? 'edit-k-file-ssw' : lainPrefix + '-ssw'),
    ),
  ];
  collectLainRows(lainPrefix).forEach(function (r) {
    errs.push(window.cekUkuranFile(r.input));
  });
  for (var i = 0; i < errs.length; i++) {
    if (errs[i]) return errs[i];
  }
  return '';
}

// Sama seperti cekSemuaUkuranFile tapi untuk EKSTENSI: return pesan error
// pertama (urutan: foto, CV, JFT, SSW, lalu baris dokumen lain).
export function cekSemuaEkstensiFile(lainPrefix) {
  var errs = [
    window.cekEkstensiFile(document.getElementById(lainPrefix + '-photo')),
    window.cekEkstensiFile(document.getElementById(lainPrefix + '-cv')),
    window.cekEkstensiFile(
      document.getElementById(lainPrefix === 'edit-k' ? 'edit-k-file-jft' : lainPrefix + '-jft'),
    ),
    window.cekEkstensiFile(
      document.getElementById(lainPrefix === 'edit-k' ? 'edit-k-file-ssw' : lainPrefix + '-ssw'),
    ),
  ];
  collectLainRows(lainPrefix).forEach(function (r) {
    errs.push(window.cekEkstensiFile(r.input));
  });
  for (var i = 0; i < errs.length; i++) {
    if (errs[i]) return errs[i];
  }
  return '';
}

// Guard gabungan (ukuran dulu, lalu ekstensi) untuk dipanggil di awal
// submit — satu titik yang menjamin SEMUA jalur modal admin lolos dua-duanya.
export function cekSemuaFileModal(lainPrefix) {
  var u = cekSemuaUkuranFile(lainPrefix);
  if (u) return u;
  return cekSemuaEkstensiFile(lainPrefix);
}

export async function prosesUploadKandidat() {
  var btn = document.getElementById('btn-submit-kandidat');
  var nama = document.getElementById('k-nama').value;
  var wa = document.getElementById('k-wa').value;
  var loker = document.getElementById('k-loker').value || 'UMUM';
  if (!nama || !wa) return;
  // Guard ukuran: tolak SEBELUM baca base64 supaya tidak buang waktu & tidak
  // kena 413/limit server untuk file yang pasti gagal.
  // Guard ukuran + ekstensi: tolak SEBELUM baca base64 supaya tidak buang
  // waktu & tidak kena 413/limit server untuk file yang pasti gagal.
  var ukuranErr = cekSemuaFileModal('k');
  if (ukuranErr) {
    window.showToast(ukuranErr, 'error');
    return;
  }
  btn.innerHTML = window.tr('ui.processing');
  btn.disabled = true;
  // Ambil File asli dari input — untuk upload LANGSUNG ke Cloudinary
  // (backend hanya menerima URL string, bukan base64 lewat Netlify).
  function ambilFileInput(id, label) {
    const el = document.getElementById(id);
    const f = el && el.files && el.files[0] ? el.files[0] : null;
    return f ? { label: label, name: f.name, file: f } : null;
  }
  let fd = [];
  let ph = ambilFileInput('k-photo', 'PAS_PHOTO');
  if (ph) fd.push(ph);
  let pc = ambilFileInput('k-cv', 'CV');
  if (pc) fd.push(pc);
  let pj = ambilFileInput('k-jft', 'JFT');
  if (pj) fd.push(pj);
  let ps = ambilFileInput('k-ssw', 'SSW');
  if (ps) fd.push(ps);

  // Indikator: semua file yang dipilih -> mengupload (yang kosong -> tidak dipilih)
  var labels = fd.map(function (f) {
    return f.label;
  });
  markUploadResults(labels, []);
  labels.forEach(function (l) {
    var map = {
      PAS_PHOTO: ['st-photo', 'PAS PHOTO'],
      CV: ['st-cv', 'CV'],
      JFT: ['st-jft', 'JFT'],
      SSW: ['st-ssw', 'SSW'],
    };
    if (map[l]) setUploadStatus(map[l][0], map[l][1], 'uploading');
  });

  document.getElementById('global-loader').style.display = 'flex';
  // Upload file ke Cloudinary (langsung dari browser) — backend hanya
  // menerima URL string di payload JSON, tidak lagi base64.
  const cloudFiles = [];
  for (const f of fd) {
    try {
      const url = await window.uploadToCloudinary(f.file);
      cloudFiles.push({ label: f.label, name: f.name, url: url });
    } catch (err) {
      markUploadResults([f.label], []);
      window.showToast(
        'Gagal upload ' + f.label + ' ke Cloudinary: ' + (err && err.message ? err.message : err),
        'error',
      );
      btn.innerHTML = window.tr('button.save_upload');
      btn.disabled = false;
      document.getElementById('global-loader').style.display = 'none';
      return;
    }
  }

  // Kirim key 'loker' (bukan 'idLoker') + array files[] berlabel supaya
  // backend simpanKandidatDanUpload menerima kode job & URL file dengan benar.
  // Field fisik (gender/usia/TB/BB/pendidikan) ikut dikirim supaya kandidat
  // tidak lahir "kosong" - disimpan ke master + baris lamaran di backend.
  var data = {
    nama: nama,
    wa: wa,
    loker: loker,
    gender: document.getElementById('k-gender').value,
    usia: document.getElementById('k-usia').value,
    tb: document.getElementById('k-tb').value,
    bb: document.getElementById('k-bb').value,
    pendidikan: document.getElementById('k-pendidikan').value,
    files: cloudFiles,
  };
  try {
    const res = await window.callAPI('simpanKandidatDanUpload', [data]);
    if (res.success) {
      const okList = res.uploaded || [];
      markUploadResults(labels, okList);
      const ringkas =
        fd.length === 0 ? 'tanpa berkas' : okList.length + '/' + fd.length + ' berkas terupload';
      // Password kandidat selalu 4 digit terakhir WA (kebijakan seragam)
      // - ditampilkan supaya admin langsung tahu, tidak ada yang tertutup.
      const passInfo =
        ' · ' +
        window.tr('ui.cand_pass_label') +
        ': ' +
        String(wa).replace(/\D/g, '').slice(-4) +
        ' (' +
        window.tr('ui.cand_pass_hint') +
        ')';

      // Upload dokumen lain (opsional, seperti form + Job) lewat jalur
      // pemberkasan — admin boleh upload langsung (bypass approval).
      // Bisa >1 dokumen sekaligus: tiap baris yang punya file di-upload.
      const lainRows = collectLainRows('k');
      for (const r of lainRows) {
        const jenisLabel = String(r.jenis || 'DOKUMEN');
        setUploadStatus(r.stId, jenisLabel, 'uploading');
        const lainUrl = await window.uploadToCloudinary(r.input.files[0]).catch(() => null);
        if (lainUrl) {
          try {
            const lr = await window.callAPI('simpanBerkasTahapan', [
              { wa: wa, nama: nama, jenisBerkas: r.jenis, fileUrl: lainUrl },
            ]);
            setUploadStatus(r.stId, jenisLabel, lr && lr.success ? 'ok' : 'fail');
          } catch (e) {
            setUploadStatus(r.stId, jenisLabel, 'fail');
          }
        }
      }
      window.showToast(window.tr('ui.toast_cand_saved') + ringkas + '.' + passInfo, 'success');
      // Tampilkan centang beberapa saat supaya admin langsung melihat hasil, lalu tutup
      setTimeout(function () {
        document.getElementById('form-tambah-kandidat').reset();
        document.getElementById('modal-tambah-kandidat').classList.add('hidden');
        resetUploadStatus();
        window.refreshDataDinamis('pelamar');
      }, 1400);
    } else {
      markUploadResults(labels, []); // semua yang dipilih -> gagal
      window.showToast(res.error, 'error');
    }
  } catch (err) {
    markUploadResults(labels, []);
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  } finally {
    btn.innerHTML = window.tr('button.save_upload');
    btn.disabled = false;
    document.getElementById('global-loader').style.display = 'none';
  }
}

export function bukaSuperEditKandidat(idKan) {
  var c = ALL_CANDIDATES.find((x) => x.idKandidat === idKan);
  if (!c) return window.showToast(window.tr('ui.toast_data_not_found'), 'error');

  window.safeSet('super-nama-kandidat', c.nama);
  document.getElementById('edit-k-row').value = c.rowIndex;
  document.getElementById('edit-k-wa').value = window.normalizePhone(c.wa);

  document.getElementById('edit-k-tahapan').value = c.tahapan || '';
  document.getElementById('edit-k-status').value = c.status || 'Aktif';

  let rawInt = c.catatanInt || '';
  let isVip = rawInt.includes('[VIP]');
  document.getElementById('edit-k-privilege').checked = isVip;

  document.getElementById('edit-k-catatan').value = c.catatanExt || c.catatan || '';

  // Normalisasi gender (DB campur kapital: perempuan/PEREMPUAN/Perempuan/Laki-laki)
  // supaya select yang opsi-nya hanya LAKI-LAKI/PEREMPUAN selalu terisi benar.
  document.getElementById('edit-k-gender').value = normalizeGenderValue(c.gender);
  document.getElementById('edit-k-tempat-lahir').value =
    c.tempatLahir && c.tempatLahir !== '-' ? c.tempatLahir : '';
  var editTgl = document.getElementById('edit-k-tgl-lahir');
  if (editTgl) editTgl.value = window.toDateInputValue(c.tglLahir);
  document.getElementById('edit-k-tb').value =
    c.tb && c.tb !== '-' ? String(c.tb).replace(/\D/g, '') : '';
  document.getElementById('edit-k-bb').value =
    c.bb && c.bb !== '-' ? String(c.bb).replace(/\D/g, '') : '';
  document.getElementById('edit-k-pendidikan').value = c.pendidikan || '-';

  let umur = '';
  if (c.tglLahir && c.tglLahir !== '-' && c.tglLahir.trim() !== '') {
    let dob = new Date(c.tglLahir);
    // @ts-expect-error JS→TS migration
    if (!isNaN(dob)) {
      let today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      let m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      // @ts-expect-error JS→TS migration
      umur = age > 0 ? age : '';
    }
  }
  if (umur === '' && c.usia && c.usia !== '-') {
    umur = c.usia;
  }

  document.getElementById('edit-k-usia').value = umur;

  document.getElementById('edit-k-jft').value = c.jftText !== '-' ? c.jftText || '' : '';
  document.getElementById('edit-k-ssw').value = c.sswText !== '-' ? c.sswText || '' : '';

  ['edit-k-photo', 'edit-k-cv', 'edit-k-file-jft', 'edit-k-file-ssw'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Baris dokumen lain mulai dari 1 baris kosong (kandidat baru dipilih).
  initLainRows('edit-k');
  // Daftar berkas yang SUDAH tersimpan (pemberkasan_checklist) — read-only.
  renderBerkasTersimpan(c.berkas);
  // Tampilkan "Sudah pernah upload" untuk Photo/CV/JFT/SSW yang sudah ada.
  cekDokumenSebelumnya(c.wa);

  document.getElementById('modal-edit-kandidat').classList.remove('hidden');
}

export async function simpanSuperEditKandidat() {
  const btn = document.getElementById('btn-save-super');
  // Guard ukuran: cek dokumen lain di modal edit sebelum baca base64.
  const ukuranErr = cekSemuaFileModal('edit-k');
  if (ukuranErr) {
    window.showToast(ukuranErr, 'error');
    return;
  }
  btn.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-2"></i> ' + window.tr('ui.saving_upper') + '';
  btn.disabled = true;
  document.getElementById('global-loader').style.display = 'flex';

  const payload = {
    rowIndex: document.getElementById('edit-k-row').value,
    wa: window.normalizePhone(document.getElementById('edit-k-wa').value),
    admin: currentAdminName,
    tahapan: document.getElementById('edit-k-tahapan').value,
    status: document.getElementById('edit-k-status').value,
    catatanExt: document.getElementById('edit-k-catatan').value,
    // Normalisasi ke format kanonikal supaya DB konvergen (dan CV AI
    // yang mengecek includes('PEREMPUAN') tidak salah render Laki-laki).
    gender: normalizeGenderValue(document.getElementById('edit-k-gender').value),
    tempatLahir: document.getElementById('edit-k-tempat-lahir').value.trim(),
    tglLahir: document.getElementById('edit-k-tgl-lahir').value,
    tb: document.getElementById('edit-k-tb').value,
    bb: document.getElementById('edit-k-bb').value,
    pendidikan: document.getElementById('edit-k-pendidikan').value,
    usia: document.getElementById('edit-k-usia').value,
    jftText: document.getElementById('edit-k-jft').value,
    sswText: document.getElementById('edit-k-ssw').value,
    isVip: document.getElementById('edit-k-privilege').checked,
  };

  try {
    const res = await window.callAPI('updateKandidatSuper', [payload]);
    if (res.success) {
      // Upload dokumen lain (opsional, seperti modal Input Kandidat):
      // admin boleh lampirkan berkas pemberkasan tambahan saat edit.
      // Bisa >1 dokumen sekaligus: tiap baris yang punya file di-upload.
      const eLainRows = collectLainRows('edit-k');

      // Tambahkan file utama (photo, cv, jft, ssw) ke daftar upload jika dipilih
      const mPhoto = document.getElementById('edit-k-photo');
      if (mPhoto && mPhoto.files && mPhoto.files.length > 0)
        eLainRows.unshift({ jenis: 'PAS_PHOTO', stId: 'edit-k-st-photo', input: mPhoto });
      const mCv = document.getElementById('edit-k-cv');
      if (mCv && mCv.files && mCv.files.length > 0)
        eLainRows.unshift({ jenis: 'CV', stId: 'edit-k-st-cv', input: mCv });
      const mJft = document.getElementById('edit-k-file-jft');
      if (mJft && mJft.files && mJft.files.length > 0)
        eLainRows.unshift({ jenis: 'JFT', stId: 'edit-k-st-jft', input: mJft });
      const mSsw = document.getElementById('edit-k-file-ssw');
      if (mSsw && mSsw.files && mSsw.files.length > 0)
        eLainRows.unshift({ jenis: 'SSW', stId: 'edit-k-st-ssw', input: mSsw });
      // IJAZAH SD/SMP/SMA + UNIVERSITAS — upload ulang (opsional) di
      // modal edit super; disimpan ke pemberkasan_checklist (sd_url/
      // smp_url/sma_url/univ_url) via simpanBerkasTahapan.
      const mIjazahSd = document.getElementById('edit-k-ijazah-sd');
      if (mIjazahSd && mIjazahSd.files && mIjazahSd.files.length > 0)
        eLainRows.unshift({ jenis: 'IJAZAH SD', stId: 'edit-k-st-ijazah-sd', input: mIjazahSd });
      const mIjazahSmp = document.getElementById('edit-k-ijazah-smp');
      if (mIjazahSmp && mIjazahSmp.files && mIjazahSmp.files.length > 0)
        eLainRows.unshift({ jenis: 'IJAZAH SMP', stId: 'edit-k-st-ijazah-smp', input: mIjazahSmp });
      const mIjazahSma = document.getElementById('edit-k-ijazah-sma');
      if (mIjazahSma && mIjazahSma.files && mIjazahSma.files.length > 0)
        eLainRows.unshift({ jenis: 'IJAZAH SMA', stId: 'edit-k-st-ijazah-sma', input: mIjazahSma });
      const mUniv = document.getElementById('edit-k-univ');
      if (mUniv && mUniv.files && mUniv.files.length > 0)
        eLainRows.unshift({ jenis: 'UNIVERSITAS', stId: 'edit-k-st-univ', input: mUniv });

      for (const er of eLainRows) {
        const eJenisLabel = String(er.jenis || 'DOKUMEN');
        setUploadStatus(er.stId, eJenisLabel, 'uploading');
        const eLainUrl = await window.uploadToCloudinary(er.input.files[0]).catch(() => null);
        if (eLainUrl) {
          try {
            // Nama kandidat untuk folder storage diambil dari data
            // (payload tidak membawa nama) — folder harus cocok dengan
            // master kandidat supaya berkas bisa dipreview.
            const eCand = (ALL_CANDIDATES || []).find(function (x) {
              return window.normalizePhone(String(x.wa || '')) === payload.wa;
            });
            const eNama = eCand && eCand.nama ? String(eCand.nama).toUpperCase() : 'KANDIDAT';
            const lr2 = await window.callAPI('simpanBerkasTahapan', [
              { wa: payload.wa, nama: eNama, jenisBerkas: er.jenis, fileUrl: eLainUrl },
            ]);
            setUploadStatus(er.stId, eJenisLabel, lr2 && lr2.success ? 'ok' : 'fail');
          } catch (e2) {
            setUploadStatus(er.stId, eJenisLabel, 'fail');
          }
        }
      }
      document.getElementById('modal-edit-kandidat').classList.add('hidden');
      window.showToast(window.tr('ui.toast_sync3_success'), 'success');
      window.refreshDataDinamis('pelamar');
    } else {
      window.showToast(window.tr('ui.toast_error_prefix') + res.error, 'error');
    }
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  } finally {
    btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> ' + window.tr('ui.sync_3way') + '';
    btn.disabled = false;
    document.getElementById('global-loader').style.display = 'none';
  }
}

export async function prosesUploadRevisi() {
  let input = document.getElementById('file-revisi');
  if (!input.files[0]) {
    window.showToast(window.tr('ui.toast_pick_revisi'), 'error');
    return;
  }
  let btn = document.getElementById('btn-revisi');
  btn.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> ' + window.tr('ui.uploading_short') + '';
  btn.disabled = true;
  document.getElementById('global-loader').style.display = 'flex';
  try {
    // Upload CV revisi LANGSUNG ke Cloudinary, backend hanya menerima URL.
    const fileUrl = await window.uploadToCloudinary(input.files[0]);
    const res = await window.callAPI('simpanRevisiKandidat', [
      currentKandidatWa,
      { name: input.files[0].name, url: fileUrl },
    ]);
    if (res.success) {
      window.showToast(window.tr('ui.toast_revisi_uploaded'), 'success');
      window.refreshDataDinamis();
    } else {
      window.showToast(window.tr('ui.toast_failed_prefix') + res.error, 'error');
    }
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  } finally {
    btn.innerHTML = window.tr('button.upload_revise');
    btn.disabled = false;
    document.getElementById('global-loader').style.display = 'none';
  }
}

// QR di-generate LOKAL (vendor/qrcode-generator.min.js) — tanpa layanan eksternal
// (api.qrserver.com) supaya offline/PWA tetap jalan dan 100% mandiri.
// Kembalikan data URL gambar QR dari teks; '' bila lib tidak termuat.
export function buatQrDataUrl(text: string, targetPx?: number) {
  if (typeof window.qrcode !== 'function' || !text) return '';
  try {
    var qr = window.qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    var count = qr.getModuleCount();
    var cell = Math.max(2, Math.floor((targetPx || 250) / (count + 2)));
    return qr.createDataURL(cell, 1);
  } catch (e) {
    return '';
  }
}

export async function aksiGenerateQr(c, k) {
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = 'flex';

  var job = ALL_JOBS.find((j) => j.code === c);
  var jobTitle = job ? c + ' - ' + job.pekerjaan : c;
  var templateCv = job ? job.templateCv : '';

  try {
    const b = await window.callAPI('generateFormBridge', [c, k]);
    if (b && b.formUrl) {
      var qrData = buatQrDataUrl(b.formUrl);
      if (!qrData) throw new Error('QR lib tidak termuat');
      window.safeSet('qr-job-title', jobTitle);
      window.setImg('qr-image', qrData);

      var btnDownload = document.getElementById('btn-download-qr');
      btnDownload.href = qrData;
      btnDownload.download = 'QR_LOKER_' + c + '.png';

      document.getElementById('qr-link-form').value = b.formUrl;
      var tplContainer = document.getElementById('qr-template-container');
      if (templateCv && templateCv !== '-' && templateCv.length > 5) {
        document.getElementById('qr-link-template').value = window.getDirectDownloadUrl(templateCv);
        tplContainer.classList.remove('hidden');
      } else {
        tplContainer.classList.add('hidden');
      }
      document.getElementById('modal-qr').classList.remove('hidden');
    } else {
      window.showToast(window.tr('ui.toast_qr_failed'), 'error');
    }
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

export function tutupModalQr() {
  document.getElementById('modal-qr').classList.add('hidden');
}

export function filterCbx(containerId, val) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var labels = container.getElementsByTagName('label');
  var filter = val.toLowerCase();
  for (var i = 0; i < labels.length; i++) {
    var text = labels[i].innerText || labels[i].textContent;
    if (text.toLowerCase().indexOf(filter) > -1) {
      labels[i].style.display = '';
    } else {
      labels[i].style.display = 'none';
    }
  }
}

// ===== Pagination kandidat admin =====
// getAppData admin hanya mengirim halaman 1 (50) + candidatesTotal. Sisa
// halaman dimuat on-demand: tombol "Muat Lebih" menambah satu halaman,
// ensureAllCandidates() menarik sisanya untuk fitur yang butuh daftar penuh
// (blast WA, esign match, modal, dll). No-op bila total <= yang sudah dimuat
// (mode kandidat: candidatesTotal tidak ada -> langsung kembali).
export async function fetchCandidatesPage(page, pageSize, q) {
  const res = await window.callAPI('getCandidatesPage', [
    { page: page, pageSize: pageSize, q: q || '' },
  ]);
  if (!res || res.success !== true) throw new Error((res && res.error) || 'Gagal memuat kandidat');
  return res;
}
export function appendCandidates(list) {
  var existing = new Set(
    (ALL_CANDIDATES || []).map(function (c) {
      return c.wa;
    }),
  );
  (list || []).forEach(function (c) {
    if (c && c.wa && !existing.has(c.wa)) {
      ALL_CANDIDATES.push(c);
      existing.add(c.wa);
    }
  });
}
export async function ensureAllCandidates() {
  var loaded = (ALL_CANDIDATES || []).length;
  var total = ALL_CANDIDATES_TOTAL || loaded;
  if (loaded >= total) return;

  // Dapatkan halaman mana saja yang belum dimuat (mulai dari halaman 2 jika getAppData memuat hal 1)
  var totalPages = Math.ceil(total / 50);
  var loadedPagesCount = Math.ceil(loaded / 50);

  var promises = [];
  for (var p = loadedPagesCount + 1; p <= totalPages; p++) {
    promises.push(fetchCandidatesPage(p, 50, ''));
  }

  if (promises.length === 0) return;

  try {
    // Halaman-halaman independen ditarik BERSAMAAN (Promise.all)
    const results = await Promise.all(promises);
    results.forEach(function (res) {
      if (res && res.candidates) {
        appendCandidates(res.candidates);
      }
    });
    // Update total jika ada perubahan di backend
    var lastRes = results[results.length - 1];
    if (lastRes && lastRes.total) window.ALL_CANDIDATES_TOTAL = lastRes.total;
  } catch (err) {
    /* gagal: lanjut dengan data yang sudah dimuat */
  }
}
export async function muatLebihKandidat() {
  var loaded = (ALL_CANDIDATES || []).length;
  var page = Math.floor(loaded / 50) + 1;
  try {
    const res = await fetchCandidatesPage(page, 50, '');
    appendCandidates(res.candidates);
    window.ALL_CANDIDATES_TOTAL = res.total;
    if (typeof renderAdminFull === 'function') renderAdminFull();
    window.showToast(
      window.tr('ui.toast_cand_label') +
        ALL_CANDIDATES.length +
        window.tr('ui.toast_of_sep') +
        res.total,
      'success',
    );
  } catch (err) {
    window.showToast(window.tr('alert.failed') + ' ' + (err.message || err), 'error');
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick/onchange (partials/modals-shared.html + admin/index) +
// render/*, 03_candidate.js, 08_wa_pintar.js, 10_cv_rirekisho.js,
// 12_esign_match.js, admin_ops/candidates.js (window.ensureAllCandidates).
registerSeamAliases({
  bukaModalTambahKandidat,
  pilihKandidatManual,
  cekKandidatOtomatis,
  tandaiFileDipilih,
  tambahBarisLain,
  hapusBarisLain,
  prosesUploadKandidat,
  bukaSuperEditKandidat,
  simpanSuperEditKandidat,
  prosesUploadRevisi,
  aksiGenerateQr,
  tutupModalQr,
  filterCbx,
  cariKandidatManual,
  ensureAllCandidates,
  muatLebihKandidat,
});
