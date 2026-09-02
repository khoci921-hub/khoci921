import { ALL_CANDIDATES, currentKandidatWa, isAdmin, isKandidat } from './init/state.ts';
import { ensureAllCandidates, buatQrDataUrl } from './api/candidates.ts';
import { registerSeamAliases } from './core/bridge.ts';
// ESM (Fase 3 langkah 12): modul ES — alias window.* di bridge bawah utk
// HTML onclick (bukaModalTtd, bukaLayarCanvas, clearFsCanvas, saveFsCanvas,
// submitDataEsignFull, jalankanMatchmaking, kirimTawaranMassal), onclick
// string render/admin.js (bukaMatchmaking) & engine/init.js
// (renderStudentCard). State fsCanvas/activeDrawingType/signData/… sengaja
// PRIVAT modul (tak ada pemakai luar).

// 12. E-SIGN CANVAS, DIGITAL STUDENT CARD & MATCHMAKING
// ==========================================
// ==========================================
// LOGIKA FULL SCREEN CANVAS E-SIGN
// ==========================================
let fsCanvas,
  fsCtx,
  isDrawing = false;
let activeDrawingType = '';
let isLandscapeMode = false; // Penanda mode putar

// Objek untuk menampung data base64 sebelum dikirim ke server
let signData = { ttd1: null, nama1: null, ttd2: null, nama2: null };

// ATURAN LOCK (dokumentasi — lihat juga AGENTS.md "Aturan lock fitur kandidat"):
// E-Sign & Data Naitei terbuka kalau TAHAPAN kandidat di loker sudah masuk
// tahap lolos/pemberkasan (LOLOS..NAITEI — sama persis dengan situs lama
// asjportal.netlify.app). BUKAN status lamaran LULUS di mail inbox. Admin
// selalu bisa membuka.
export async function bukaModalTtd() {
  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  let cleanWa = window.normalizePhone(currentKandidatWa);
  let c = ALL_CANDIDATES.find(
    (kan) => window.normalizePhone(kan.wa) === window.normalizePhone(cleanWa),
  );
  if (!c) return;
  let thp = String(c.tahapan).toUpperCase();
  let isValid =
    /LOLOS|PEMBERKASAN|MCU|MEDICAL|MEDIKAL|PARPOR|PASPOR|PASPORT|MATCH|TERIMA|SIAP|TTD|KONTRAK|VISA|COE|KTKLN|SISKOP|FLIGHT|BERANGKAT|TERBANG|TIKET|E-ID|NAITEI/i.test(
      thp,
    );

  if (!isValid && !isAdmin) {
    window.showToast(window.tr('ui.toast_naitei_locked'), 'error');
    return;
  }
  document.getElementById('modal-ttd').classList.remove('hidden');
}

export function initFsCanvas() {
  if (!fsCanvas) {
    fsCanvas = document.getElementById('fs-canvas');
    fsCtx = fsCanvas.getContext('2d');

    // Mouse Events
    fsCanvas.addEventListener('mousedown', startDrawFs);
    fsCanvas.addEventListener('mousemove', drawFs);
    fsCanvas.addEventListener('mouseup', stopDrawFs);
    fsCanvas.addEventListener('mouseout', stopDrawFs);

    // Touch Events (Mencegah layar scroll)
    fsCanvas.addEventListener(
      'touchstart',
      function (e) {
        e.preventDefault();
        startDrawFs(e.touches[0] || e);
      },
      { passive: false },
    );
    fsCanvas.addEventListener(
      'touchmove',
      function (e) {
        e.preventDefault();
        drawFs(e.touches[0] || e);
      },
      { passive: false },
    );
    fsCanvas.addEventListener('touchend', stopDrawFs);
  }
}

export function bukaLayarCanvas(type, title) {
  activeDrawingType = type;
  document.getElementById('fs-canvas-title').innerText = title;
  document.getElementById('modal-fs-canvas').classList.remove('hidden');

  initFsCanvas();

  // 1. CEK MODE TULISAN ATAU TTD
  // Jika sedang menulis "Nama", kita paksa putar layarnya 90 derajat (Landscape Virtual)
  if (type === 'nama1' || type === 'nama2') {
    isLandscapeMode = true;
    document.getElementById('fs-canvas-hint').innerHTML =
      '<span class="text-amber-400">' +
      window.tr('ui.rotate_phone') +
      '</span> ' +
      window.tr('ui.rotate_phone_rest') +
      '';

    // Resolusi memanjang (Lebar > Tinggi)
    fsCanvas.width = 1200;
    fsCanvas.height = 400;

    // Putar Canvas 90 derajat secara Visual
    fsCanvas.style.transform = 'rotate(90deg)';
    fsCanvas.style.width = '60vh'; // Menjadi tingginya HP
    fsCanvas.style.height = '90vw'; // Menjadi lebarnya HP
  } else {
    // Mode Tanda Tangan Normal
    isLandscapeMode = false;
    document.getElementById('fs-canvas-hint').innerText = window.tr('ui.draw_hint');

    fsCanvas.width = 800;
    fsCanvas.height = 400;

    // Kembalikan putaran
    fsCanvas.style.transform = 'rotate(0deg)';
    fsCanvas.style.width = '90%';
    fsCanvas.style.height = '60vh';
  }

  clearFsCanvas();

  // 2. MENEBALKAN PENSIL
  fsCtx.lineWidth = 7; // Kemarin 4, sekarang 7 agar tebal seperti Spidol
  fsCtx.lineCap = 'round';
  fsCtx.lineJoin = 'round'; // Bikin sudut tikungan garis lebih halus
  fsCtx.strokeStyle = '#0f172a'; // Tinta biru gelap
}

export function getFsPointerPos(e) {
  let rect = fsCanvas.getBoundingClientRect();

  // Kalkulasi posisi jika Canvas diputar (Landscape Mode)
  if (isLandscapeMode) {
    // Karena diputar 90 derajat, koordinat X dan Y tertukar posisinya terhadap mouse/jari
    let scaleX = fsCanvas.height / rect.width; // Perhatikan ini dibalik
    let scaleY = fsCanvas.width / rect.height; // Perhatikan ini dibalik

    return {
      x: (e.clientY - rect.top) * scaleY,
      // Y dihitung dari kanan ke kiri karena rotasi
      y: fsCanvas.height - (e.clientX - rect.left) * scaleX,
    };
  } else {
    // Kalkulasi Normal
    let scaleX = fsCanvas.width / rect.width;
    let scaleY = fsCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }
}

export function startDrawFs(e) {
  isDrawing = true;
  let pos = getFsPointerPos(e);
  fsCtx.beginPath();
  fsCtx.moveTo(pos.x, pos.y);
}

export function drawFs(e) {
  if (!isDrawing) return;
  let pos = getFsPointerPos(e);
  fsCtx.lineTo(pos.x, pos.y);
  fsCtx.stroke();
}

export function stopDrawFs() {
  isDrawing = false;
}

export function clearFsCanvas() {
  if (fsCtx) {
    fsCtx.clearRect(0, 0, fsCanvas.width, fsCanvas.height);
  }
}

export function isCanvasBlank(canvasObj) {
  return !canvasObj
    .getContext('2d')
    .getImageData(0, 0, canvasObj.width, canvasObj.height)
    .data.some((channel) => channel !== 0);
}

export function saveFsCanvas() {
  if (isCanvasBlank(fsCanvas)) {
    window.showToast(window.tr('ui.toast_area_empty'), 'error');
    return;
  }

  // Ambil data gambar (format PNG transparan)
  let b64 = fsCanvas.toDataURL('image/png');
  signData[activeDrawingType] = b64.split(',')[1];

  document.getElementById('preview-' + activeDrawingType).src = b64;
  document.getElementById('preview-' + activeDrawingType).classList.remove('hidden');
  document.getElementById('btn-' + activeDrawingType).innerHTML =
    '<i class="fas fa-edit mr-1"></i> ' + window.tr('ui.redo_sign') + '';

  document.getElementById('modal-fs-canvas').classList.add('hidden');
}

export async function submitDataEsignFull() {
  if (!signData.ttd1 && !signData.nama1 && !signData.ttd2 && !signData.nama2) {
    window.showToast(window.tr('ui.toast_sign_area_required'), 'error');
    return;
  }

  let btn = document.getElementById('btn-submit-esign');
  btn.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-2"></i> ' + window.tr('ui.uploading_server') + '';
  btn.disabled = true;
  document.getElementById('global-loader').style.display = 'flex';

  let payload = {
    ttd1: signData.ttd1,
    nama1: signData.nama1,
    ttd2: signData.ttd2,
    nama2: signData.nama2,
  };

  try {
    const res = await window.callAPI('simpanDataTtdNaitei', {
      wa: currentKandidatWa,
      ...payload,
    });
    if (res.success) {
      window.showToast(window.tr('ui.toast_saved_server'), 'success');
      document.getElementById('modal-ttd').classList.add('hidden');
      window.refreshDataDinamis();
    } else {
      window.showToast(window.tr('ui.toast_failed_prefix') + res.error, 'error');
    }
  } catch (err) {
    window.showToast(window.tr('ui.toast_network_error'), 'error');
  } finally {
    btn.innerHTML =
      '<i class="fas fa-cloud-upload-alt mr-2"></i> ' + window.tr('ui.save_all_docs') + '';
    btn.disabled = false;
    document.getElementById('global-loader').style.display = 'none';
  }
}

// ==========================================
// LOGIKA DIGITAL STUDENT CARD & MATCHMAKING
// ==========================================

// Panggil fungsi ini saat data selesai di-load (disisipkan di fungsi initApp)
export async function renderStudentCard() {
  if (!isKandidat) return;
  let myData = ALL_CANDIDATES.find(
    (c) => window.normalizePhone(c.wa) === window.normalizePhone(currentKandidatWa),
  );
  if (!myData) return;

  let catatan = myData.catatanInt || '';
  let isVip = catatan.includes('[VIP]');
  // [VIP] bukan kelas — kalau tidak, kartu menampilkan "KELAS VIP"
  // alih-alih "VIP MEMBER" untuk member berstatus VIP.
  let kelasMatch = catatan.match(/\[(?:KELAS\s*([A-Z0-9]+)|(?![VIP\])([A-Z0-9]+))\]/i);

  // Munculkan kartu jika VIP atau punya KELAS
  if (isVip || kelasMatch) {
    document.getElementById('student-card-container').classList.remove('hidden');

    // Nama panjang otomatis mengecilkan font & wrap 2 baris (line-clamp-2)
    // supaya tidak terpotong "..." di kartu QR. Nama pendek tetap besar.
    let scNama = document.getElementById('sc-nama');
    let namaLen = String(myData.nama || '').length;
    if (scNama) {
      scNama.innerText = myData.nama.toUpperCase();
      scNama.classList.remove(
        'text-sm',
        'md:text-base',
        'text-xs',
        'md:text-sm',
        'text-[10px]',
        'md:text-xs',
      );
      if (namaLen <= 16) {
        scNama.classList.add('text-sm', 'md:text-base');
      } else if (namaLen <= 24) {
        scNama.classList.add('text-xs', 'md:text-sm');
      } else {
        scNama.classList.add('text-[10px]', 'md:text-xs');
      }
    }
    document.getElementById('sc-id').innerText = myData.idKandidat;

    if (kelasMatch) {
      let namaKelas = kelasMatch[1] || kelasMatch[2];
      document.getElementById('sc-kelas').innerText = 'KELAS ' + namaKelas.toUpperCase();
    } else if (isVip) {
      document.getElementById('sc-kelas').innerText = 'VIP MEMBER';
    }

    // Link QR = Digital CV (ASJ Dossier) yang terbuka otomatis saat scan.
    // FIX: arahkan ke index (/?cv=ID) — SATU-SATUNYA halaman yang punya
    // handler `?cv=` → bukaDigitalCV() (03_engine.js). Sebelumnya QR
    // mengarah ke siswa-baru.html?cv=... yang TIDAK punya handler itu,
    // jadi scan tidak membuka apa-apa ("QR masih error").
    // QR di-generate LOKAL (buatQrDataUrl) — tanpa api.qrserver.com eksternal.
    try {
      let base = typeof location !== 'undefined' && location.origin ? location.origin : '';
      let verifyUrl = base + '/?cv=' + encodeURIComponent(myData.idKandidat);
      var qrData = typeof buatQrDataUrl === 'function' ? buatQrDataUrl(verifyUrl) : '';
      document.getElementById('sc-qr').src =
        qrData ||
        'data:image/svg+xml;utf8,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250"><rect width="250" height="250" fill="%23111"/><text x="125" y="128" fill="%2376b900" font-size="20" font-family="sans-serif" text-anchor="middle" font-weight="bold">QR GAGAL</text></svg>',
          );
    } catch (err) {
      /* QR tetap placeholder — non-fatal */
    }
  }
}

// Panggil fungsi renderStudentCard di akhir fungsi refreshDataDinamis -> initApp()
// Pastikan Anda memanggilnya dengan cara mencari baris "renderRiwayatKandidat();" di Script.html,
// lalu tambahkan "renderStudentCard();" tepat di bawahnya.

// --- FUNGSI AI HEADHUNTER / MATCHMAKING CERDAS ---
let matchedCandidates = [];
let currentMatchJobCode = '';

// Fungsi Pembantu: Mengubah teks pendidikan jadi bobot angka
export function getPendidikanScore(str) {
  let p = String(str).toUpperCase();
  if (p.includes('S1') || p.includes('SARJANA')) return 5;
  if (p.includes('D3') || p.includes('D4') || p.includes('DIPLOMA')) return 4;
  if (p.includes('SMA') || p.includes('SMK') || p.includes('MA') || p.includes('SLTA')) return 3;
  if (p.includes('SMP') || p.includes('SD')) return 2;
  return 0; // Tidak terdeteksi
}

export function bukaMatchmaking(jobCode, jobName, reqGender) {
  document.getElementById('modal-matchmaking').classList.remove('hidden');
  document.getElementById('match-job-title').innerText = jobCode + ' - ' + jobName;
  currentMatchJobCode = jobCode;

  // Reset Layar Hasil & Tombol
  document.getElementById('match-result-list').innerHTML =
    '<div class="text-center p-6 text-slate-500 text-xs italic"><i class="fas fa-robot text-3xl mb-3 text-slate-600"></i><br>' +
    window.tr('ui.match_hint') +
    '</div>';
  document.getElementById('match-count-badge').innerText = '0 Kandidat';
  document.getElementById('btn-blast-match').disabled = true;

  // Auto-fill Filter Gender dari Job
  let filterGen = document.getElementById('match-filter-gender');
  let jobGenInfo = String(reqGender).toUpperCase();
  if (jobGenInfo.includes('LAKI') || jobGenInfo.includes('PRIA')) {
    filterGen.value = 'L';
  } else if (jobGenInfo.includes('PEREMPUAN') || jobGenInfo.includes('WANITA')) {
    filterGen.value = 'P';
  } else {
    filterGen.value = 'ALL';
  }

  // Kosongkan semua filter advance lainnya
  document.getElementById('match-filter-usia-min').value = '';
  document.getElementById('match-filter-usia-max').value = '';
  document.getElementById('match-filter-tb').value = '';
  document.getElementById('match-filter-bb').value = '';
  document.getElementById('match-filter-pendidikan').value = '0';
  document.getElementById('match-filter-keyword').value = '';
  document.getElementById('match-filter-jft').checked = false;
  document.getElementById('match-filter-ssw').checked = false;
}

export function jalankanMatchmaking() {
  let resultList = document.getElementById('match-result-list');
  resultList.innerHTML =
    '<div class="text-center p-6"><i class="fas fa-spinner fa-spin text-violet-500 text-3xl"></i><p class="text-xs text-slate-400 mt-3 font-bold tracking-widest">' +
    window.tr('ui.sifting_db') +
    '</p></div>';

  // Ambil Nilai dari Form Filter
  let fGender = document.getElementById('match-filter-gender').value;
  let fUsiaMin = parseInt(document.getElementById('match-filter-usia-min').value) || 0;
  let fUsiaMax = parseInt(document.getElementById('match-filter-usia-max').value) || 99;
  let fTbMin = parseInt(document.getElementById('match-filter-tb').value) || 0;
  let fBbMax = parseInt(document.getElementById('match-filter-bb').value) || 999;
  let fPendidikan = parseInt(document.getElementById('match-filter-pendidikan').value) || 0;
  let fKeyword = document.getElementById('match-filter-keyword').value.trim().toUpperCase();
  let fJft = document.getElementById('match-filter-jft').checked;
  let fSsw = document.getElementById('match-filter-ssw').checked;

  setTimeout(async () => {
    if (typeof ensureAllCandidates === 'function') {
      try {
        await ensureAllCandidates();
      } catch (e) {}
    }
    matchedCandidates = ALL_CANDIDATES.filter((c) => {
      // RULE 1: WAJIB Status Aktif & Belum Terdaftar di Job ini
      if (c.status.toUpperCase() !== 'AKTIF') return false;
      if ((c.idLoker || '').includes(currentMatchJobCode)) return false;

      // RULE 2: Gender
      let cGender = String(c.gender).toUpperCase();
      if (
        fGender === 'L' &&
        (cGender.includes('PEREMPUAN') || cGender === 'P' || cGender.includes('WANITA'))
      )
        return false;
      if (
        fGender === 'P' &&
        (cGender.includes('LAKI') || cGender === 'L' || cGender.includes('PRIA'))
      )
        return false;

      // RULE 3: Rentang Usia
      let cUsia = parseInt(String(c.usia).replace(/\D/g, '')) || 0;
      if (cUsia > 0 && (cUsia < fUsiaMin || cUsia > fUsiaMax)) return false;

      // RULE 4: Fisik (TB & BB)
      let cTb = parseInt(String(c.tb).replace(/\D/g, '')) || 0;
      if (fTbMin > 0 && cTb > 0 && cTb < fTbMin) return false;

      let cBb = parseInt(String(c.bb).replace(/\D/g, '')) || 0;
      if (fBbMax < 999 && cBb > 0 && cBb > fBbMax) return false;

      // RULE 5: Pendidikan Minimal
      if (fPendidikan > 0) {
        if (getPendidikanScore(c.pendidikan) < fPendidikan) return false;
      }

      // RULE 6: Wajib Sertifikat
      if (fJft && (c.jftText === '-' || c.jftText.trim() === '')) return false;
      if (fSsw && (c.sswText === '-' || c.sswText.trim() === '')) return false;

      // RULE 7 (FITUR SAKTI): Filter Pencarian Kata Kunci Global (Regex)
      // Kita gabungkan seluruh data biodata kandidat menjadi satu teks raksasa, lalu kita cari kata kuncinya di dalam teks tersebut.
      if (fKeyword) {
        let globalText = JSON.stringify(c).toUpperCase();
        // Pengecekan multi-keyword (contoh: jika admin ketik "SIM A, LANSIA")
        let keywords = fKeyword
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k !== '');
        let isMatchKeyword = false;

        // Gunakan "every" kalau ingin semua kata wajib ada, atau "some" jika salah satu ada.
        // Di sini kita pakai "some" (Minimal salah satu pengalaman/SIM cocok)
        isMatchKeyword = keywords.some((kunci) => globalText.includes(kunci));

        if (!isMatchKeyword) return false;
      }

      return true; // Selamat! Anda lolos seleksi ekstrim Kaisha!
    });

    // Urutkan Prioritas Berdasarkan Kelengkapan Sertifikat & Foto
    matchedCandidates.sort((a, b) => {
      let aScore =
        (a.pasPhoto !== '-' ? 1 : 0) + (a.jftText !== '-' ? 2 : 0) + (a.sswText !== '-' ? 2 : 0);
      let bScore =
        (b.pasPhoto !== '-' ? 1 : 0) + (b.jftText !== '-' ? 2 : 0) + (b.sswText !== '-' ? 2 : 0);
      return bScore - aScore;
    });

    // RENDER HASIL
    document.getElementById('match-count-badge').innerText = matchedCandidates.length + ' Kandidat';
    let btnBlast = document.getElementById('btn-blast-match');

    if (matchedCandidates.length === 0) {
      resultList.innerHTML =
        '<div class="text-center p-6 text-slate-400 text-xs italic bg-red-900/20 rounded-xl border border-red-500/30"><i class="fas fa-search-minus text-3xl text-red-500 mb-3"></i><br>' +
        window.tr('ui.no_match') +
        '</div>';
      btnBlast.disabled = true;
    } else {
      let html = '';
      matchedCandidates.slice(0, 30).forEach((c, idx) => {
        // Batasi tampil 30 di layar agar tidak lag
        let umur = c.usia !== '-' ? window.esc(c.usia) + ' Thn' : '? Thn';
        let tb_bb =
          c.tb !== '-' || c.bb !== '-'
            ? `TB:${c.tb.replace(/\D/g, '')} BB:${c.bb.replace(/\D/g, '')}`
            : '';
        let g = c.gender.toUpperCase().includes('P')
          ? '<span class="text-pink-400 font-bold"><i class="fas fa-venus"></i> P</span>'
          : '<span class="text-blue-400 font-bold"><i class="fas fa-mars"></i> L</span>';

        let certBadges = '';
        if (c.jftText !== '-')
          certBadges += `<span class="bg-sky-900/50 text-sky-300 border border-sky-500/50 px-1.5 py-0.5 rounded mr-1">JFT</span>`;
        if (c.sswText !== '-')
          certBadges += `<span class="bg-emerald-900/50 text-emerald-300 border border-emerald-500/50 px-1.5 py-0.5 rounded">SSW</span>`;
        if (!certBadges) certBadges = `<span class="text-slate-500 italic">No-Cert</span>`;

        html += `
                    <div class="p-3 bg-slate-900 border border-slate-700 rounded-lg flex justify-between items-center hover:bg-slate-800 transition shadow-inner">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs shadow">
                                <i class="fas fa-user text-slate-400"></i>
                            </div>
                            <div>
                                <h4 class="text-xs font-bold text-white">${window.esc(c.nama)}</h4>
                                <p class="text-[9px] text-slate-400 mt-0.5">${g} <span class="mx-1">|</span> ${umur} <span class="mx-1">|</span> ${tb_bb}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-[8px] font-bold mb-1">${certBadges}</div>
                            <span class="text-[9px] text-violet-300 bg-violet-900/40 px-2 py-0.5 rounded border border-violet-500/30 font-bold"><i class="fas fa-check"></i> Cocok</span>
                        </div>
                    </div>`;
      });
      resultList.innerHTML = html;
      btnBlast.disabled = false;
    }
  }, 1000); // 1 detik loading animasi biar dramatis
}

export async function kirimTawaranMassal() {
  if (matchedCandidates.length === 0)
    return window.showToast(window.tr('ui.toast_no_cand_offer'), 'error');

  if (!window.confirm(`Kirim penawaran via WhatsApp ke ${matchedCandidates.length} kandidat ini?`))
    return;

  let btn = document.getElementById('btn-blast-match');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> ' + window.tr('ui.sending') + '';
  btn.disabled = true;

  // FIX 2026-08-12: getBaseUrl_() TIDAK pernah didefinisikan di proyek (sisa era GAS) —
  // ReferenceError tiap klik "Kirim Penawaran". Ganti dengan origin + root path,
  // pola sama dengan shareLinkFor() di 05_render.js.
  let linkPortal = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  // Loop client-side per kandidat (kirimSatuPesanFonnte + jeda 4 detik)
  // diganti 2026-08-09 dengan satu panggilan server: kirimTawaranMassal
  // (whatsapp.ts) yang mengirim berurutan dengan jeda 2 detik per kandidat.
  let msg = `Halo Kak {nama} 👋\n\nBerdasarkan kecocokan data Anda di sistem ASJ, kami ingin menawarkan *Lowongan Kerja Baru* yang sangat sesuai untuk Anda!\n\nKode Job: *{job_code}*\n\nJika Kakak tertarik, silakan segera login ke Dashboard dan lamar pekerjaan ini di:\n🔗 {link_grup}\n\nSemangat! 🇯🇵`;

  try {
    const res = await window.callAPI('kirimTawaranMassal', [
      {
        candidates: matchedCandidates,
        jobCode: currentMatchJobCode,
        linkGrup: linkPortal,
        customMessage: msg,
      },
    ]);
    const results = (res && res.results) || [];
    const successCount = results.filter((r) => r.success).length;
    window.showToast(window.tr('ui.toast_offer_sent_n').replace('{n}', successCount), 'success');
  } catch (e) {
    window.showToast(
      window.tr('ui.toast_offer_send_failed') + (e && e.message ? e.message : e),
      'error',
    );
  }

  btn.innerHTML = window.tr('ui.send_offer_all');
  btn.disabled = false;
  document.getElementById('modal-matchmaking').classList.add('hidden');
}

// BRIDGE ESM → classic (bundel): alias window.* utk HTML onclick
// (modals-shared: bukaModalTtd/bukaLayarCanvas/clearFsCanvas/saveFsCanvas/
// submitDataEsignFull/jalankanMatchmaking/kirimTawaranMassal), onclick
// string render/admin.js (bukaMatchmaking) & engine/init.js
// (renderStudentCard). initFsCanvas/getFsPointerPos/drawFs/dll tetap
// internal — dipanggil file ini saja (addEventListener & helper).
registerSeamAliases({
  bukaModalTtd,
  bukaLayarCanvas,
  clearFsCanvas,
  saveFsCanvas,
  submitDataEsignFull,
  bukaMatchmaking,
  jalankanMatchmaking,
  kirimTawaranMassal,
});
