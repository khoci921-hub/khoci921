import {
  ALL_CANDIDATES,
  ALL_DB_JOBS,
  ALL_JOBS,
  ASSETS,
  currentAdminName,
  isAdmin,
} from '../init/state.ts';
import { ensureAllCandidates } from '../api/candidates.ts';
import { normalizeGenderValue } from '../03_candidate.ts';
import { previewFileInFrame } from '../init/preview.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// ==========================================
// MODAL CV DIGITAL (DOSSIER) — buka CV, edit cepat, preview inline/PDF,
// simpan catatan admin (cache buster trigger)
// ==========================================

export async function bukaDigitalCV(id) {
  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  try {
    var c = ALL_CANDIDATES.find((kan) => String(kan.idKandidat).trim() === String(id).trim());
    if (!c) {
      window.showToast(window.tr('ui.toast_profile_not_found2'), 'error');
      return;
    }
    // Simpan kandidat aktif untuk form Edit Data Cepat (tanpa buka CV AI).
    window.__cvKandidatAktif = c;
    isiEditCepatCv(c);

    let logoCv = document.getElementById('cv-logo-asj');
    if (logoCv && ASSETS.LOGO) logoCv.src = ASSETS.LOGO;

    window.safeSet('cv-id', c.idKandidat || '-');

    let htmlNama = (c.nama || '-').toUpperCase();

    let miniFields = [c.nama, c.wa, c.gender, c.usia, c.tb, c.bb, c.pendidikan, c.pasPhoto];
    let miniFilled = 0;
    miniFields.forEach((f) => {
      if (f && String(f).trim() !== '' && String(f).trim() !== '-') miniFilled++;
    });
    let pMini = Math.round((miniFilled / miniFields.length) * 100);

    let masterFields = [c.email, c.tempatLahir, c.tglLahir, c.alamat, c.jftText, c.sswText];
    let masterFilled = 0;
    masterFields.forEach((f) => {
      if (f && String(f).trim() !== '' && String(f).trim() !== '-') masterFilled++;
    });
    let pMaster = Math.round((masterFilled / masterFields.length) * 100);

    let cvBadges = '<span class="inline-flex items-center gap-1.5 ml-3 align-middle">';
    cvBadges +=
      '<i class="fas fa-medal text-orange-500 text-lg drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" title="' +
      window.tr('ui.badge_bronze') +
      '"></i>';
    if (pMini === 100)
      cvBadges +=
        '<i class="fas fa-award text-slate-300 text-lg drop-shadow-[0_0_8px_rgba(203,213,225,0.8)]" title="' +
        window.tr('ui.badge_silver') +
        '"></i>';
    if (pMaster === 100)
      cvBadges +=
        '<i class="fas fa-crown text-yellow-400 text-xl drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" title="' +
        window.tr('ui.badge_gold') +
        '"></i>';

    let catatanIntStr = c.catatanInt || '';
    if (catatanIntStr.includes('[VIP]')) {
      let logoSrc =
        ASSETS.LOGO ||
        'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/logo_asj.png';
      cvBadges +=
        '<img src="' +
        logoSrc +
        '" class="w-6 h-6 object-contain drop-shadow-[0_0_10px_rgba(52,211,153,0.8)] rounded-full border border-emerald-500/50" title="' +
        window.tr('ui.badge_official') +
        '">';
    }

    // PERBAIKAN 1: Support deteksi [KELAS G] maupun tulisan [G] — tapi [VIP]
    // BUKAN kelas (tag VIP dikelola checkbox tersendiri, jangan jadi badge KELAS).
    let kelasMatch = catatanIntStr.match(/\[(?:KELAS\s*([A-Z0-9]+)|(?![VIP\])([A-Z0-9]+))\]/i);
    if (kelasMatch) {
      let namaKelas = kelasMatch[1] || kelasMatch[2];
      cvBadges += `<span class="px-2 py-0.5 ml-1 bg-indigo-900/60 text-indigo-300 border border-indigo-500/50 rounded text-[9px] font-bold shadow-sm whitespace-nowrap align-middle"><i class="fas fa-users mr-1"></i>${namaKelas.toUpperCase()}</span>`;
    }
    cvBadges += '</span>';

    window.safeSet('cv-nama', htmlNama + cvBadges);
    window.safeSet('cv-wa', c.wa || '-');
    window.safeSet('cv-gender', c.gender || '-');

    let umurLive = '-';
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
        umurLive = age + window.tr('ui.age_years_suffix');
      }
    }
    if (umurLive === '-' && c.usia && c.usia !== '-')
      umurLive = c.usia + window.tr('ui.age_years_suffix');
    window.safeSet('cv-usia', umurLive);

    // TB/BB & TTL digabung di backend (mapCandidate: field tbBb/ttl) supaya
    // modal CV selalu menampilkan data fisik meski baris lamaran kosong
    // (data sebenarnya ada di master_database_candidate).
    window.safeSet('cv-tbbb', c.tbBb || c.tb_bb || '-');
    // riwayatpendidikan kini JSON array 5-baris — tampilkan tingkat terakhir terbaca
    window.safeSet('cv-pendidikan', window.formatPendidikanTingkat(c.pendidikan) || '-');
    window.safeSet('cv-jft-nilai', c.jftText && c.jftText !== '-' ? c.jftText : '-');
    window.safeSet('cv-ssw', c.sswText && c.sswText !== '-' ? c.sswText : '-');

    window.safeSet('cv-ttl-lengkap', c.ttl || '-');
    window.safeSet('cv-email', c.email || '-');
    window.safeSet('cv-alamat', c.alamat || '-');

    let statusText =
      window.esc(window.trOption(c.tahapan || 'Baru')) +
      ' \n(' +
      window.esc(window.trOption(c.status || 'Aktif')) +
      ')';
    window.safeSet('cv-status', statusText);

    var waLink = document.getElementById('cv-wa-link');
    if (waLink) waLink.href = 'https://wa.me/' + String(c.wa).replace(/\D/g, '');

    // Password kandidat: default 4 digit terakhir No. WA. Sejak fitur
    // Ganti Password (2026-08-12) kandidat bisa mengganti sendiri — kalau
    // passwordDiubah=true, tampilkan peringatan (admin tidak bisa tahu),
    // bukan 4 digit WA yang sudah tidak berlaku.
    var passRow = document.getElementById('cv-pass-row');
    var passEl = document.getElementById('cv-pass');
    if (passRow && passEl) {
      if (isAdmin) {
        if (c.passwordDiubah) {
          passEl.textContent =
            window.tr('ui.pass_changed_admin') + ' — ' + window.tr('ui.pass_changed_hint');
          passRow.classList.remove('hidden');
        } else {
          var pass4 = String(c.wa || '')
            .replace(/\D/g, '')
            .slice(-4);
          if (pass4) {
            passEl.textContent = pass4 + ' (' + window.tr('ui.cand_pass_hint') + ')';
            passRow.classList.remove('hidden');
          } else {
            passRow.classList.add('hidden');
          }
        }
      } else {
        passRow.classList.add('hidden');
      }
    }

    let jobTagsContainer = document.getElementById('cv-job-tags');
    if (jobTagsContainer) {
      // DOM OPT: kumpulkan ke SATU string dulu, injeksikan sekali
      // (dulu innerHTML += per job = tulis DOM berulang dalam loop).
      // Multi-apply: tampilkan SEMUA lamaran dari mail (code + status),
      // bukan cuma id_loker_pilihan.
      let apps = (c.applications || []).filter((a) => a && a.code);
      let jobHtml = '';
      if (apps.length > 0) {
        apps.forEach((a) => {
          let st = String(a.status || 'MENUNGGU').toUpperCase();
          let stColor =
            st === 'LULUS' || st === 'AKTIF'
              ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700/60'
              : st === 'GAGAL' || st === 'REJECT' || st === 'DITOLAK'
                ? 'bg-red-900/50 text-red-300 border-red-700/60'
                : 'bg-sky-900/50 text-sky-300 border-sky-700/60';
          jobHtml +=
            '<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-900/30 text-pink-300 border border-pink-700/50 rounded-lg text-[10px] font-bold shadow-sm" title="' +
            window.esc(st) +
            '"><i class="fas fa-briefcase mr-1"></i>' +
            window.esc(a.code) +
            '<span class="px-1.5 py-0.5 rounded-md text-[9px] border ' +
            stColor +
            '">' +
            window.esc(st) +
            '</span></span>';
        });
      } else {
        let jobString = c.idLoker || '';
        if (jobString && jobString !== '-') {
          jobHtml = jobString
            .split(',')
            .map((job) => {
              let cleanJob = job.trim();
              return cleanJob
                ? '<span class="px-3 py-1 bg-pink-900/30 text-pink-300 border border-pink-700/50 rounded-lg text-[10px] font-bold shadow-sm"><i class="fas fa-briefcase mr-1"></i> ' +
                    window.esc(cleanJob) +
                    '</span>'
                : '';
            })
            .join('');
        } else {
          jobHtml =
            '<span class="text-xs text-slate-500 italic">' +
            window.tr('ui.not_applied_general') +
            '</span>';
        }
      }
      jobTagsContainer.innerHTML = jobHtml;
    }

    var img = document.getElementById('cv-foto');
    var icn = document.getElementById('cv-no-foto');
    if (img && icn) {
      img.classList.add('hidden');
      icn.classList.remove('hidden');
      if (c.pasPhoto && c.pasPhoto !== '-' && c.pasPhoto.length > 5) {
        var finalUrl = window.getHighResImage(c.pasPhoto);
        img.onload = function () {
          img.classList.remove('hidden');
          icn.classList.add('hidden');
        };
        // FIX 2026-08-12: onerror fallback — URL lh3/Drive yang 403/404
        // tidak boleh diam-diam menampilkan foto kosong: coba unduhan
        // alternatif (Drive), lalu tampilkan ikon no-foto.
        img.onerror = function () {
          var alt = window.getDirectDownloadUrl(c.pasPhoto);
          // @ts-expect-error JS→TS migration
          if (alt && alt !== finalUrl && !img._fotoRetry) {
            // @ts-expect-error JS→TS migration
            img._fotoRetry = true;
            img.src = alt;
          } else {
            img.classList.add('hidden');
            icn.classList.remove('hidden');
          }
        };
        img.src = finalUrl;
      }
    }

    var btnJft = document.getElementById('btn-cv-jft');
    var btnSsw = document.getElementById('btn-cv-ssw');
    var btnCv = document.getElementById('btn-cv-dokumen');

    if (isAdmin) {
      if (c.jftUrl && c.jftUrl !== '-' && c.jftUrl.toLowerCase().startsWith('http')) {
        btnJft.onclick = function () {
          bukaInlinePreview(c.jftUrl);
        };
        btnJft.classList.remove('hidden');
      } else {
        if (btnJft) btnJft.classList.add('hidden');
      }
      if (c.sswUrl && c.sswUrl !== '-' && c.sswUrl.toLowerCase().startsWith('http')) {
        btnSsw.onclick = function () {
          bukaInlinePreview(c.sswUrl);
        };
        btnSsw.classList.remove('hidden');
      } else {
        if (btnSsw) btnSsw.classList.add('hidden');
      }
      if (c.cvUrl && c.cvUrl !== '-' && c.cvUrl.toLowerCase().startsWith('http')) {
        btnCv.onclick = function () {
          bukaInlinePreview(c.cvUrl);
        };
        btnCv.classList.remove('hidden');
      } else {
        if (btnCv) btnCv.classList.add('hidden');
      }
    } else {
      if (btnJft) btnJft.classList.add('hidden');
      if (btnSsw) btnSsw.classList.add('hidden');
      if (btnCv) btnCv.classList.add('hidden');
    }

    let notesArea = document.getElementById('cv-admin-notes-area');
    if (notesArea) {
      if (isAdmin) {
        notesArea.classList.remove('hidden');
        // Biar kalau disave ulang, tulisan Kelasnya tidak terhapus berantakan
        document.getElementById('cv-catatan-int').value = catatanIntStr
          .replace(/\[VIP\]/gi, '')
          .replace(/\[(?:KELAS\s*[A-Z0-9]+|[A-Z0-9]+)\]/gi, '')
          .trim();
        document.getElementById('cv-catatan-ext').value = c.catatanExt || '';
        // FIX VIP: state checkbox mengikuti tag [VIP] yang tersimpan — tag
        // tidak hilang lagi kalau admin simpan catatan tanpa menulis ulang.
        var vipToggle = document.getElementById('cv-vip-toggle');
        if (vipToggle) vipToggle.checked = /\[VIP\]/i.test(catatanIntStr);
      } else {
        notesArea.classList.add('hidden');
      }
    }

    // PERBAIKAN 2: Regex ini sekarang mencakup kata "MCU", "PARPOR", "MATCH", dll (sama persis dengan dashboard kandidat)
    let isLolos =
      /LOLOS|PEMBERKASAN|MCU|MEDICAL|MEDIKAL|PARPOR|PASPOR|PASPORT|MATCH|TERIMA|SIAP|TTD|KONTRAK|VISA|COE|KTKLN|SISKOP|FLIGHT|BERANGKAT|TERBANG|TIKET|E-ID/i.test(
        c.tahapan || '',
      );

    let areaBerkas = document.getElementById('cv-pemberkasan-area');
    let btnFolder = document.getElementById('btn-cv-folder');

    if (areaBerkas) {
      if (isAdmin && isLolos) {
        areaBerkas.classList.remove('hidden');

        var bFolder = document.getElementById('btn-cv-folder');
        if (bFolder) {
          var jd = ALL_DB_JOBS.find((j) => j.code === c.idLoker);
          var jobFolder = jd && jd.folderUrl && jd.folderUrl !== '-' ? jd.folderUrl : c.folderUrl;
          if (jobFolder && jobFolder !== '-') {
            bFolder.href = jobFolder;
            bFolder.classList.remove('hidden');
          } else {
            bFolder.classList.add('hidden');
          }
        }

        var bCv = document.getElementById('btn-cv-file-cv');
        if (bCv) {
          if (c.cvUrl && c.cvUrl !== '-') {
            bCv.onclick = function () {
              window.bukaPreviewDokumen(c.cvUrl);
            };
            bCv.classList.remove('hidden');
          } else bCv.classList.add('hidden');
        }

        var bJft = document.getElementById('btn-cv-file-jft');
        if (bJft) {
          if (c.jftUrl && c.jftUrl !== '-') {
            bJft.onclick = function () {
              window.bukaPreviewDokumen(c.jftUrl);
            };
            bJft.classList.remove('hidden');
          } else bJft.classList.add('hidden');
        }

        var bSsw = document.getElementById('btn-cv-file-ssw');
        if (bSsw) {
          if (c.sswUrl && c.sswUrl !== '-') {
            bSsw.onclick = function () {
              window.bukaPreviewDokumen(c.sswUrl);
            };
            bSsw.classList.remove('hidden');
          } else bSsw.classList.add('hidden');
        }

        var bPhoto = document.getElementById('btn-cv-file-photo');
        if (bPhoto) {
          if (c.pasPhoto && c.pasPhoto !== '-') {
            bPhoto.onclick = function () {
              window.bukaPreviewDokumen(c.pasPhoto);
            };
            bPhoto.classList.remove('hidden');
          } else bPhoto.classList.add('hidden');
        }

        var bKtp = document.getElementById('btn-cv-file-ktp');
        if (bKtp) {
          var ktpUrl = (c.berkas && c.berkas.ktp) || c.ktpUrl || '';
          if (ktpUrl && ktpUrl !== '-') {
            bKtp.onclick = function () {
              window.bukaPreviewDokumen(ktpUrl);
            };
            bKtp.classList.remove('hidden');
          } else bKtp.classList.add('hidden');
        }
      } else {
        areaBerkas.classList.add('hidden');
      }
    }

    document.getElementById('modal-cv').classList.remove('hidden');
  } catch (err) {
    window.showToast(window.tr('ui.toast_load_profile_failed'), 'error');
  }
}

// ==========================================
// EDIT DATA CEPAT di Modal CV (dossier) — gender/usia/TTL/TB/JFT/SSW
// tanpa harus buka CV AI. Hanya untuk admin.
// ==========================================
export function isiEditCepatCv(c) {
  var btn = document.getElementById('btn-cv-edit-cepat');
  var form = document.getElementById('cv-edit-cepat-form');
  if (!btn || !form) return;
  if (!isAdmin) {
    btn.classList.add('hidden');
    form.classList.add('hidden');
    return;
  }
  btn.classList.remove('hidden');
  // isi nilai awal (jangan reset form kalau sudah kebuka — biar tidak
  // menghapus ketikan admin saat modal dibuka ulang)
  var gen = document.getElementById('cv-edit-gender');
  // Normalisasi gender (DB campur kapital) supaya select Edit Cepat terisi.
  if (gen && !gen.dataset.touched) gen.value = normalizeGenderValue(c.gender);
  var usia = document.getElementById('cv-edit-usia');
  if (usia && !usia.dataset.touched)
    usia.value = c.usia && c.usia !== '-' && c.usia !== '' ? c.usia : '';
  var tmp = document.getElementById('cv-edit-tempat-lahir');
  if (tmp && !tmp.dataset.touched)
    tmp.value = c.tempatLahir && c.tempatLahir !== '-' ? c.tempatLahir : '';
  var tgl = document.getElementById('cv-edit-tgl-lahir');
  if (tgl && !tgl.dataset.touched) tgl.value = toDateInputValue(c.tglLahir);
  var tb = document.getElementById('cv-edit-tb');
  if (tb && !tb.dataset.touched)
    tb.value = c.tb && c.tb !== '-' && c.tb !== '' ? String(c.tb).replace(/\D/g, '') : '';
  var bb = document.getElementById('cv-edit-bb');
  if (bb && !bb.dataset.touched)
    bb.value = c.bb && c.bb !== '-' && c.bb !== '' ? String(c.bb).replace(/\D/g, '') : '';
  var jft = document.getElementById('cv-edit-jft');
  if (jft && !jft.dataset.touched) jft.value = c.jftText && c.jftText !== '-' ? c.jftText : '';
  var ssw = document.getElementById('cv-edit-ssw');
  if (ssw && !ssw.dataset.touched) ssw.value = c.sswText && c.sswText !== '-' ? c.sswText : '';
  // Job utama (id_loker_pilihan) — pilihan dari daftar loker aktif.
  var loker = document.getElementById('cv-edit-loker');
  if (loker && !loker.dataset.touched) {
    var curCodes = String(c.idLoker || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    // Job yang sudah LULUS di mail tampil PALING ATAS — biar admin langsung
    // melihat lamaran aktif saat memilih job utama kandidat (id_loker_pilihan).
    var lulusCodes = (c.applications || [])
      .filter(function (a) {
        return a && a.code && String(a.status || '').toUpperCase() === 'LULUS';
      })
      .map(function (a) {
        return String(a.code).trim();
      });
    var jobs = (ALL_JOBS || []).slice();
    jobs.sort(function (a, b) {
      var ai = lulusCodes.indexOf(String((a && a.code) || '')) !== -1 ? 0 : 1;
      var bi = lulusCodes.indexOf(String((b && b.code) || '')) !== -1 ? 0 : 1;
      return ai - bi;
    });
    var opts = '<option value="">-</option>';
    // Job utama sekarang yang tidak ada di daftar loker (mis. "UMUM" atau
    // loker CLOSE) tetap dipertahankan sebagai opsi agar tidak hilang saat
    // admin menyimpan Edit Cepat.
    if (
      curCodes.length &&
      !jobs.some(function (j) {
        return String((j && j.code) || '') === curCodes[0];
      })
    ) {
      opts +=
        '<option value="' +
        window.esc(curCodes[0]) +
        '" selected>' +
        window.esc(curCodes[0]) +
        '</option>';
    }
    jobs.forEach(function (j) {
      var code = j && j.code ? String(j.code) : '';
      if (!code) return;
      var sel = curCodes.indexOf(code) !== -1 ? ' selected' : '';
      opts +=
        '<option value="' +
        window.esc(code) +
        '"' +
        sel +
        '>' +
        window.esc(code + (j.pekerjaan ? ' — ' + j.pekerjaan : '')) +
        '</option>';
    });
    loker.innerHTML = opts;
  }
  // Daftar lamaran aktif kandidat (semua job di mail) — info, bukan input.
  var appsEl = document.getElementById('cv-edit-apps');
  if (appsEl) {
    var apps = (c.applications || []).filter(function (a) {
      return a && a.code;
    });
    if (apps.length > 0) {
      appsEl.innerHTML = apps
        .map(function (a) {
          return (
            '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-900/40 text-sky-300 border border-sky-700/60 text-[9px] font-bold">' +
            window.esc(a.code) +
            ' · ' +
            window.esc(String(a.status || 'MENUNGGU').toUpperCase()) +
            '</span>'
          );
        })
        .join(' ');
    } else {
      appsEl.innerHTML =
        '<span class="text-slate-500 italic">' + window.tr('ui.not_applied_general') + '</span>';
    }
  }
  // tutup form setiap buka modal (biar bersih)
  form.classList.add('hidden');
}

export function toDateInputValue(tgl) {
  if (!tgl || tgl === '-' || String(tgl).trim() === '') return '';
  var d = new Date(tgl);
  // @ts-expect-error JS→TS migration
  if (isNaN(d)) return '';
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

export function toggleEditCepatCv() {
  var form = document.getElementById('cv-edit-cepat-form');
  if (form) form.classList.toggle('hidden');
}

export async function simpanEditCepatCv() {
  var c = window.__cvKandidatAktif;
  if (!c) {
    window.showToast(window.tr('ui.toast_data_not_found'), 'error');
    return;
  }
  // @ts-expect-error JS→TS migration
  var wa = window.normalizePhone(c.wa);
  if (!wa) {
    window.showToast(window.tr('ui.toast_data_not_found'), 'error');
    return;
  }
  var payload = {
    wa: wa,
    admin: currentAdminName,
    // Normalisasi ke format kanonikal supaya DB konvergen.
    gender: normalizeGenderValue(document.getElementById('cv-edit-gender').value),
    usia: document.getElementById('cv-edit-usia').value,
    tempatLahir: document.getElementById('cv-edit-tempat-lahir').value.trim(),
    tglLahir: document.getElementById('cv-edit-tgl-lahir').value,
    tb: document.getElementById('cv-edit-tb').value,
    bb: document.getElementById('cv-edit-bb').value,
    jftText: document.getElementById('cv-edit-jft').value.trim(),
    sswText: document.getElementById('cv-edit-ssw').value.trim(),
    idLoker: document.getElementById('cv-edit-loker').value,
  };
  document.getElementById('global-loader').style.display = 'flex';
  try {
    const res = await window.callAPI('updateKandidatSuper', [payload]);
    if (res && res.success) {
      window.showToast(window.tr('ui.toast_sync3_success'), 'success');
      // reset flag touched biar form terisi ulang data baru
      [
        'cv-edit-gender',
        'cv-edit-usia',
        'cv-edit-tempat-lahir',
        'cv-edit-tgl-lahir',
        'cv-edit-tb',
        'cv-edit-bb',
        'cv-edit-jft',
        'cv-edit-ssw',
        'cv-edit-loker',
      ].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) delete el.dataset.touched;
      });
      window.refreshDataDinamis('pelamar');
    } else {
      window.showToast(
        window.tr('ui.toast_error_prefix') + (res && res.error ? res.error : ''),
        'error',
      );
    }
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

export function bukaInlinePreview(url) {
  if (!url || url === '-') return;
  var previewContainer = document.getElementById('cv-inline-preview');
  var frame = document.getElementById('cv-inline-iframe');
  var btnExt = document.getElementById('cv-inline-external');

  if (previewContainer && frame) {
    // Satu pintu preview: gambar/PDF native, CSV -> render lokal,
    // Office (docx/pptx) -> MS Office Viewer, lain -> URL asli.
    previewFileInFrame(frame, url);
    if (btnExt) btnExt.href = url;
    previewContainer.classList.remove('hidden');
  } else {
    // Fallback to old modal if inline container is missing
    bukaPdfPreview(url);
  }
}

export function bukaPdfPreview(url) {
  if (!url || url === '-') return;
  var frame = document.getElementById('pdf-frame');
  var btnExt = document.getElementById('btn-pdf-external');

  if (frame) {
    previewFileInFrame(frame, url);
  }
  if (btnExt) btnExt.href = url;

  var modal = document.getElementById('modal-pdf-viewer');
  if (modal) modal.classList.remove('hidden');
}

export async function simpanCatatanCv() {
  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  var id = document.getElementById('cv-id').innerText;
  var intNote = document.getElementById('cv-catatan-int').value;
  var extNote = document.getElementById('cv-catatan-ext').value;

  if (!id || id === '-') return;

  var c = ALL_CANDIDATES.find((kan) => String(kan.idKandidat).trim() === String(id).trim());
  // FIX VIP: tulis ulang [VIP] kalau checkbox aktif (mirip penanganan KELAS di
  // bawah). Kalau dicentang maka [VIP] pasti tersimpan; kalau tidak dicentang
  // tag dihapus secara eksplisit oleh admin.
  var vipToggle = document.getElementById('cv-vip-toggle');
  var vipOn = !!(vipToggle && vipToggle.checked);
  if (vipOn && !/\[VIP\]/i.test(intNote)) {
    intNote = intNote.trim() ? '[VIP] ' + intNote.trim() : '[VIP]';
  } else if (!vipOn && /\[VIP\]/i.test(intNote)) {
    intNote = intNote.replace(/\[VIP\]/gi, '').trim();
  }
  // FIX VIP: regex kelas TIDAK boleh menangkap [VIP] — kalau tidak, VIP
  // ditulis ulang diam-diam setiap save (bug: tag VIP selalu "kembali"
  // walau checkbox sudah di-uncheck).
  let kelasMatch = (c.catatanInt || '').match(/\[(?:KELAS\s*([A-Z0-9]+)|(?![VIP\])([A-Z0-9]+))\]/i);
  if (kelasMatch) {
    let namaKelas = kelasMatch[1] || kelasMatch[2];
    intNote += ` [${namaKelas.toUpperCase()}]`;
  }

  document.getElementById('global-loader').style.display = 'flex';
  try {
    const res = await window.callAPI('updateCatatanKandidat', [
      id,
      intNote,
      extNote,
      currentAdminName,
    ]);
    if (res.success) {
      window.showToast(window.tr('ui.toast_eval_note_saved'), 'success');
      document.getElementById('modal-cv').classList.add('hidden');
      window.refreshDataDinamis('pelamar');
    } else {
      window.showToast(window.tr('ui.toast_save_failed') + res.error, 'error');
    }
  } catch (err) {
    window.showToast(window.tr('ui.toast_conn_failed') + err.message, 'error');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

export async function downloadBiodataLengkap(wa) {
  if (!wa || wa === '-') {
    window.showToast('Data WA tidak valid', 'error');
    return;
  }
  document.getElementById('global-loader').style.display = 'flex';
  try {
    const res = await window.callAPI('getDrafCvMaster', [wa]);

    // Gabungkan data dari cache (untuk fallback profil dasar) dan data master
    // @ts-ignore
    const c: any = window.__cvKandidatAktif || {};
    let data: any = {};
    if (res && res.data) {
      data = res.data;
    } else {
      // Jika master belum ada, pakai data cache sebagai fallback
      data = {
        nama_lengkap: c.nama,
        wa: c.wa,
        email: c.email,
        gender: c.gender,
        usia: c.usia,
        tempat_lahir: c.tempatLahir,
        tgl_lahir: c.tglLahir,
        tb: c.tb,
        bb: c.bb,
        alamat_lengkap: c.alamat,
        pendidikan: c.pendidikan,
        nilai_jft_text: c.jftText,
        bidang_ssw_text: c.sswText,
      };
      window.showToast('Data Master CV belum ada, menggunakan data profil dasar', 'warning');
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Biodata - ${window.esc(data.nama_lengkap || c.nama || '')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { 
            font-family: 'Inter', Arial, sans-serif; 
            padding: 40px; 
            color: #1f2937; 
            line-height: 1.5; 
            font-size: 13px; 
            max-width: 900px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            align-items: center;
            border-bottom: 3px solid #b91c1c;
            padding-bottom: 15px;
            margin-bottom: 30px;
          }
          .logo {
            width: 70px;
            height: 70px;
            margin-right: 20px;
            object-fit: contain;
          }
          .header-text h2 {
            margin: 0;
            color: #b91c1c;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .header-text p {
            margin: 4px 0 0;
            color: #4b5563;
            font-size: 12px;
          }
          h1.title { 
            text-align: center; 
            margin-bottom: 30px; 
            font-size: 20px; 
            font-weight: 700;
            text-transform: uppercase; 
            letter-spacing: 1px;
          }
          .section-title { 
            margin-top: 25px; 
            background-color: #f3f4f6;
            padding: 6px 12px;
            border-left: 4px solid #b91c1c;
            color: #111827;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 12px;
          }
          
          .basic-info-wrapper {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
          }
          .basic-info-table-container {
            flex: 1;
          }
          
          .photo-container {
            width: 140px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .photo-box {
            width: 130px;
            height: 170px;
            border: 1px solid #d1d5db;
            padding: 4px;
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .photo-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .no-photo {
            width: 100%;
            height: 100%;
            background: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9ca3af;
            font-size: 11px;
            text-align: center;
          }

          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 15px; 
          }
          th, td { 
            border: 1px solid #e5e7eb; 
            padding: 8px 12px; 
            text-align: left; 
            vertical-align: top; 
          }
          th { 
            background-color: #f9fafb; 
            width: 35%; 
            font-weight: 600; 
            color: #4b5563;
          }
          td {
            color: #111827;
          }
          
          @media print {
            body { padding: 0; max-width: none; }
            @page { margin: 15mm; }
            .photo-box { box-shadow: none; border: 1px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/icons/icon-512.png" alt="ASJ Logo" class="logo" onerror="this.style.display='none'">
          <div class="header-text">
            <h2>PT AMANAH SAKURA JAPAN</h2>
            <p>Sistem Informasi Manajemen Kandidat Terpadu</p>
          </div>
        </div>
        
        <h1 class="title">BIODATA KANDIDAT</h1>
        
        <div class="section-title">A. Informasi Dasar</div>
        <div class="basic-info-wrapper">
          <div class="basic-info-table-container">
            <table>
              <tr><th>Nama Lengkap</th><td>${window.esc(data.nama_lengkap || c.nama || '-')}</td></tr>
              <tr><th>No. WA</th><td>${window.esc(data.wa || c.wa || '-')}</td></tr>
              <tr><th>Email</th><td>${window.esc(data.email || c.email || '-')}</td></tr>
              <tr><th>Jenis Kelamin</th><td>${window.esc(data.gender || c.gender || '-')}</td></tr>
              <tr><th>Usia</th><td>${window.esc(data.usia || c.usia || '-')}</td></tr>
              <tr><th>Tempat, Tanggal Lahir</th><td>${window.esc(data.tempat_lahir || c.tempatLahir || '-')} , ${window.esc(data.tgl_lahir || c.tglLahir || '-')}</td></tr>
              <tr><th>Tinggi / Berat Badan</th><td>${window.esc(data.tb || c.tb || '-')} cm / ${window.esc(data.bb || c.bb || '-')} kg</td></tr>
              <tr><th>Alamat Lengkap</th><td>${window.esc(data.alamat_lengkap || c.alamat || '-')}</td></tr>
              <tr><th>Pendidikan Terakhir</th><td>${window.esc(data.pendidikan_terakhir || data.pendidikan || c.pendidikan || '-')}</td></tr>
              <tr><th>Status Pernikahan</th><td>${window.esc(data.status_pernikahan || '-')}</td></tr>
              <tr><th>Agama</th><td>${window.esc(data.agama || '-')}</td></tr>
              <tr><th>Golongan Darah</th><td>${window.esc(data.golongan_darah || '-')}</td></tr>
            </table>
          </div>
          <div class="photo-container">
            <div class="photo-box">
              ${
                c.pasPhoto && c.pasPhoto !== '-'
                  ? `<img src="${window.esc(window.getHighResImage ? window.getHighResImage(c.pasPhoto) : c.pasPhoto)}" alt="Pas Foto" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="no-photo" style="display:none;">Foto Gagal Dimuat</div>`
                  : `<div class="no-photo">Tidak Ada Foto</div>`
              }
            </div>
          </div>
        </div>

        <div class="section-title">B. Kompetensi & Sertifikasi</div>
        <table>
          <tr><th>Sertifikat JFT / Kemampuan Bahasa</th><td>${window.esc(data.nilai_jft_text || c.jftText || '-')}</td></tr>
          <tr><th>Sertifikat SSW / Bidang Skill</th><td>${window.esc(data.bidang_ssw_text || c.sswText || '-')}</td></tr>
        </table>
        
        <div class="section-title">C. Riwayat Pendidikan</div>
        <table>
          ${
            data.pendidikan && Array.isArray(data.pendidikan) && data.pendidikan.length > 0
              ? data.pendidikan
                  .map(
                    (p) =>
                      `<tr><th>${window.esc(p.tingkat || '-')}</th><td><strong>${window.esc(p.nama_sekolah || '-')}</strong><br><span style="color:#6b7280;font-size:12px;">Tahun: ${window.esc(p.tahun_masuk || '-')} - ${window.esc(p.tahun_lulus || '-')}</span></td></tr>`,
                  )
                  .join('')
              : `<tr><td colspan="2" style="text-align:center; color:#9ca3af;">Tidak ada data pendidikan</td></tr>`
          }
        </table>

        <div class="section-title">D. Pengalaman Kerja</div>
        <table>
          ${
            data.pekerjaan && Array.isArray(data.pekerjaan) && data.pekerjaan.length > 0
              ? data.pekerjaan
                  .map(
                    (p) =>
                      `<tr><th>${window.esc(p.nama_perusahaan || '-')}</th><td><strong>${window.esc(p.posisi || '-')}</strong><br><span style="color:#6b7280;font-size:12px;">Masa Kerja: ${window.esc(p.bulan_masuk || '-')}/${window.esc(p.tahun_masuk || '-')} - ${window.esc(p.bulan_keluar || '-')}/${window.esc(p.tahun_keluar || '-')}</span></td></tr>`,
                  )
                  .join('')
              : `<tr><td colspan="2" style="text-align:center; color:#9ca3af;">Tidak ada data pengalaman kerja</td></tr>`
          }
        </table>
        
        <div class="section-title">E. Susunan Keluarga</div>
        <table>
          ${
            data.keluarga && Array.isArray(data.keluarga) && data.keluarga.length > 0
              ? data.keluarga
                  .map(
                    (p) =>
                      `<tr><th>${window.esc(p.hubungan || '-')}</th><td>Nama: <strong>${window.esc(p.nama || '-')}</strong><br>Usia: ${window.esc(p.usia || '-')} tahun<br>Pekerjaan: ${window.esc(p.pekerjaan || '-')}</td></tr>`,
                  )
                  .join('')
              : `<tr><td colspan="2" style="text-align:center; color:#9ca3af;">Tidak ada data keluarga</td></tr>`
          }
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 800);
          }
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    window.showToast('Koneksi gagal saat mengunduh biodata: ' + err.message, 'error');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (partials/modals-shared.html toggleEditCepatCv /
// simpanEditCepatCv / simpanCatatanCv), render/mail.js & render/candidate.js
// (onclick bukaPdfPreview), engine/init.js (window.bukaDigitalCV),
// api/candidates.js (window.toDateInputValue).
registerSeamAliases({
  bukaDigitalCV,
  toDateInputValue,
  toggleEditCepatCv,
  simpanEditCepatCv,
  bukaPdfPreview,
  simpanCatatanCv,
  downloadBiodataLengkap,
});
