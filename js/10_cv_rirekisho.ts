import { ALL_CANDIDATES, currentKandidatWa, isAdmin } from './init/state.ts';
import { ensureAllCandidates } from './api/candidates.ts';
import { registerSeamAliases } from './core/bridge.ts';
// ESM (Fase 3 langkah 12): modul ES — pemakai classic/bundel via window.*
// (render/candidate.js onclick "bukaPreviewCV_Admin", HTML onclick
// "bukaPreviewCV", onclick "cetakCVRirekisho"). Helper dari helpers_cv.js &
// 10b_cv_builders.js (modul ES) dipanggil eksplisit window.*.

// === FUNGSI BUKA PREVIEW DRAF CV RIREKISHO ===
// FUNGSI 1: Dipanggil saat Admin mengklik tombol "CV" di tabel
export async function bukaPreviewCV_Admin(waTarget) {
  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  if (!waTarget) return window.showToast(window.tr('ui.toast_wa_invalid'), 'error');

  document.getElementById('global-loader').style.display = 'flex';

  try {
    const fullData = await window.callAPI('getDrafCvMaster', [waTarget]);
    if (!fullData || fullData.error) {
      // Tampilkan pesan asli dari backend (mis. "Data Master belum ada untuk …")
      // agar admin/kandidat tahu persis kenapa preview gagal.
      window.showToast(
        (fullData && fullData.error) || window.tr('ui.toast_master_incomplete'),
        'error',
      );
      return;
    }

    let c = ALL_CANDIDATES.find(
      (k) => window.normalizePhone(k.wa) === window.normalizePhone(waTarget),
    );
    // Foto utama dari master (uploads.photo) — pas_photo di database_candidate
    // bisa basi/menunjuk file yang sudah tidak ada (mis. PAS_PHOTO.jpg terhapus).
    let photoUrl =
      fullData && fullData.uploads && fullData.uploads.photo
        ? window.getHighResImage(fullData.uploads.photo)
        : '';
    // Fallback: pas_photo di daftar kandidat
    if (!photoUrl && c && c.pasPhoto !== '-') {
      photoUrl = window.getHighResImage(c.pasPhoto);
    }

    try {
      renderCVAjaib(fullData, photoUrl, waTarget);
    } catch (e) {
      window.showToast(window.tr('ui.toast_cv_build_failed') + e.message, 'error');
    }
  } catch (err) {
    window.showToast(window.tr('ui.toast_server_conn_failed'), 'error');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

// FUNGSI 2: Dipanggil saat Kandidat mengklik "Preview Desain CV" di dashboardnya
export function bukaPreviewCV() {
  let waTarget = currentKandidatWa;
  if (!waTarget) return window.showToast(window.tr('ui.toast_session_invalid'), 'error');
  prosesBukaRirekisho(waTarget);
}

// MESIN UTAMA PENARIK DATA KE SERVER
export async function prosesBukaRirekisho(waTarget) {
  document.getElementById('global-loader').style.display = 'flex';

  try {
    const fullData = await window.callAPI('getDrafCvMaster', [waTarget]);
    if (!fullData || fullData.error) {
      // Tampilkan pesan asli dari backend (mis. "Data Master belum ada untuk …")
      // agar admin/kandidat tahu persis kenapa preview gagal.
      window.showToast(
        (fullData && fullData.error) || window.tr('ui.toast_master_incomplete'),
        'error',
      );
      return;
    }

    let c = ALL_CANDIDATES.find(
      (k) => window.normalizePhone(k.wa) === window.normalizePhone(waTarget),
    );
    // Foto utama dari master (uploads.photo) — pas_photo di database_candidate
    // bisa basi/menunjuk file yang sudah tidak ada (mis. PAS_PHOTO.jpg terhapus).
    let photoUrl =
      fullData && fullData.uploads && fullData.uploads.photo
        ? window.getHighResImage(fullData.uploads.photo)
        : '';
    // Fallback: pas_photo di daftar kandidat
    if (!photoUrl && c && c.pasPhoto !== '-') {
      photoUrl = window.getHighResImage(c.pasPhoto);
    }

    try {
      // Panggil fungsi renderCVAjaib yang sudah Kakak pasang sebelumnya
      renderCVAjaib(fullData, photoUrl, waTarget);
    } catch (e) {
      window.showToast(window.tr('ui.toast_cv_build_failed') + e.message, 'error');
    }
  } catch (err) {
    window.showToast(window.tr('ui.toast_server_conn_failed'), 'error');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  } // Panggil fungsi server getDrafCvMaster()
}

export function renderCVAjaib(d, fotoUrl, waTarget) {
  // 1. TARIK MEMORI JSON AI JEKLIN
  let ai: Record<string, any> = {};
  try {
    if (d.AIDATAJSON && d.AIDATAJSON !== '-') ai = JSON.parse(d.AIDATAJSON);
  } catch (e) {}

  // 2. MESIN PENCARI DATA — helper pure logic dari helpers_cv.js
  // Prioritas: (a) d nested hasil getDrafCvMaster (identitas.nama_lengkap,
  // wawancara.kelebihan_jp, dst), (b) ai_data_json (AIDATAJSON), (c) key flat
  // uppercase lama (NAMALENGKAP, GENDER, dst) agar kompatibel data legacy.
  const vRaw = window.makeV(d, ai);
  // S1 (XSS): semua nilai dari v() di-escape HTML sebelum masuk template A4 —
  // data kandidat (nama, sekolah, alamat, dst) bisa mengandung <, >, &, kutip.
  const v = (...keys) => window.esc(vRaw(...keys));
  // Baca array riwayat dari d (hasil getDrafCvMaster) + ai (AIDATAJSON) dan
  // GABUNG keduanya (union + dedupe) — helper pure mergeArrRiwayat di
  // helpers_cv.js. Backend sudah menggabungkan kolom master dengan isi CV AI
  // di buildMasterNested, tapi jaring pengaman ini memastikan satu sumber
  // tidak menutupi yang lain walau backend masih versi lama — kolom master
  // sering hanya menyimpan baris pertama (mis. keluarga_1) padahal isi CV AI
  // punya 3-4 anggota → preview CV tampak "dikit". Kolom flat legacy tidak
  // dipakai lagi karena backend sudah menormalkan ke array.
  const keyOf = {
    pendidikan: (e) =>
      String((e.tingkat || '') + (e.sekolah || e.sekolah_id || e.nama_sekolah || ''))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ''),
    pekerjaan: (e) =>
      String(
        (e.perusahaan || e.perusahaan_id || e.nama_perusahaan || '') +
          (e.jabatan || e.jabatan_id || ''),
      )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ''),
    keluarga: (e) =>
      String(e.nama || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ''),
  };
  const getArr = (key) =>
    // @ts-expect-error JS→TS migration
    window.mergeArrRiwayat(window.getPath(d, key), window.getPath(ai, key), keyOf[key]);
  let eduList = getArr('pendidikan');
  let jobList = getArr('pekerjaan');
  let famList = getArr('keluarga');

  let tglAsli = v('TGLLAHIR', 'TANGGALLAHIR', 'identitas.tgl_lahir');
  let tglFormat = '-';
  if (tglAsli !== '-') {
    let dt = new Date(tglAsli);
    // @ts-expect-error JS→TS migration
    if (!isNaN(dt)) {
      tglFormat =
        dt.getFullYear() +
        '年' +
        String(dt.getMonth() + 1).padStart(2, '0') +
        '月' +
        String(dt.getDate()).padStart(2, '0') +
        '日';
    } else {
      tglFormat = tglAsli;
    }
  }

  // --- PERBAIKAN FOTO DI SINI ---
  // Menggunakan min-height: 195px (seukuran 11 baris tabel) & object-fit cover agar pas kotak tanpa gepeng
  let fotoHtml = fotoUrl
    ? `<img src="${fotoUrl}" style="width: 100%; height: 100%; min-height: 195px; object-fit: cover; object-position: top center; display: block; margin: 0; padding: 0;">`
    : `<div style="width: 100%; min-height: 195px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: gray;">FOTO</div>`;

  let btnPrintHtml = isAdmin
    ? `
            <div class="flex flex-wrap items-center gap-2 mb-3 print:hidden z-50 relative">
                <button onclick="cetakCVRirekisho()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg flex items-center font-sans text-sm transition-all hover:scale-105 border border-emerald-500">
                    <i class="fas fa-print mr-2"></i> Cetak Rirekisho
                </button>
                <button onclick="cetakCVRirekisho()" class="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg shadow-lg flex items-center font-sans text-sm transition-all hover:scale-105 border border-sky-500">
                    <i class="fas fa-file-pdf mr-2"></i> Simpan PDF
                </button>
            </div>
        `
    : `
            <div class="text-center mb-3 print:hidden z-50 relative">
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/80 text-slate-300 text-[10px] font-bold rounded-full border border-slate-500/50">
                    <i class="fas fa-eye mr-1"></i> MODE PREVIEW — Hanya bisa dicetak oleh Admin
                </span>
            </div>
        `;

  // Bangun tiap blok lewat builder murni (10b_cv_builders.js)
  let eduHtml = window.buildEduRows(eduList, v);
  let jobHtml = window.buildJobRows(jobList, v);
  let famHtml = window.buildFamRows(famList, v);
  let idn = window.buildCvIdentitas(v);

  // Rakit template A4 (10b_cv_builders.js)
  let html = window.buildCvKertasA4({
    v,
    fotoHtml,
    btnPrintHtml,
    tglFormat,
    waTarget,
    ...idn,
    eduHtml,
    jobHtml,
    famHtml,
  });

  document.getElementById('cv-kertas-a4').innerHTML = html;
  document.getElementById('modal-preview-cv').classList.remove('hidden');
}

// BRIDGE ESM → classic (bundel): HTML onclick (bukaPreviewCV), onclick string
// render/candidate.js (bukaPreviewCV_Admin) & onclick "cetakCVRirekisho" di
// btnPrintHtml (dibuat renderCVAjaib) butuh global — alias data property.
registerSeamAliases({
  bukaPreviewCV_Admin,
  bukaPreviewCV,
  cetakCVRirekisho,
});

// Cetak / Simpan PDF Rirekisho: hanya tersedia untuk Admin (tombolnya tidak
// dirender untuk kandidat). "Simpan PDF" membuka dialog print yang sama,
// browser menyediakan opsi "Save as PDF".
export function cetakCVRirekisho() {
  if (!isAdmin) {
    window.showToast(window.tr('ui.toast_rireki_admin_only'), 'error');
    return;
  }
  window.print();
}
