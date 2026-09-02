import { ALL_CANDIDATES, ALL_DB_JOBS } from '../init/state.ts';
import { renderAdminFull } from '../render/admin.ts';
import { ensureAllCandidates } from '../api/candidates.ts';
import { upsertCandidateMemory, patchFormMail } from '../api/forms.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// js/admin_ops/{schedule,candidates,sysconfig,loading,migration,drive}.js.
// ==========================================
// LIST KANDIDAT PER JOB & UNDANGAN GRUP + CEK DATA SISWA
// ==========================================

export async function bukaModalListKandidat(code) {
  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  var job = ALL_DB_JOBS.find((j) => j.code === code);
  var cands = ALL_CANDIDATES.filter((c) => c.idLoker && c.idLoker.includes(code));
  if (!job) return;
  window.safeSet('list-job-code', code);
  var html = '';
  var txt = '*LIST KANDIDAT JOB ' + code + '* Total: ' + cands.length + ' Pelamar \n\n';

  if (cands.length === 0) {
    html =
      '<div class="text-center text-slate-500 py-4">' + window.tr('ui.no_applicants') + '</div>';
    txt += window.tr('ui.no_candidates_empty');
  } else {
    cands.forEach((c, i) => {
      html += `<div class="p-3 bg-black/40 border border-slate-700 rounded-lg flex justify-between items-center mb-2">
                        <div class="font-bold text-white text-xs">${i + 1}. ${window.esc(c.nama)}</div>
                        <div class="flex items-center gap-2">
                        <button onclick="bukaDigitalCV('${window.escJs(c.idKandidat)}')" aria-label="${window.tr('ui.peek_cv')}" class="w-7 h-7 flex items-center justify-center bg-sky-900/50 hover:bg-sky-600 text-sky-400 hover:text-white rounded-full transition shadow" title="${window.tr('ui.peek_cv')}"><i class="fas fa-eye text-xs"></i></button>
                        <button onclick="keluarkanKandidatDariJob('${window.escJs(c.wa)}', '${window.escJs(code)}')" class="px-2 py-1 bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white rounded text-[10px] font-bold transition shadow" title="${window.tr('ui.remove_from_job')}">${window.tr('ui.btn_gagal')}</button>
                        </div></div>`;
      txt += i + 1 + '. ' + c.nama + ' - WA: ' + c.wa + '\n';
    });
  }
  var lc = document.getElementById('list-kandidat-content');
  if (lc) lc.innerHTML = html;
  window.currentCopyListTxt = txt;
  var modalLk = document.getElementById('modal-list-kandidat');
  if (modalLk) modalLk.classList.remove('hidden');
}

export async function keluarkanKandidatDariJob(wa, jobCode) {
  if (!confirm(window.tr('ui.confirm_remove_cand_from_job').replace('{job}', jobCode))) return;
  try {
    const res = await window.callAPI('tandaiGagalJob', [wa, jobCode]);
    if (res.success) {
      window.showToast(window.tr('ui.toast_cand_removed_job'), 'success');
      var modalLk2 = document.getElementById('modal-list-kandidat');
      if (modalLk2) modalLk2.classList.add('hidden');
      // PATCH-IN-PLACE: backend mengembalikan kandidat & baris mail hasil
      // update — timpa di memori + render ulang, tanpa tarik ulang getAppData.
      upsertCandidateMemory(res.candidate);
      if (res.form) patchFormMail(res.form.rowIndex, res.form);
      if (typeof renderAdminFull === 'function') renderAdminFull();
    } else window.showToast(window.tr('ui.toast_error_prefix') + res.error, 'error');
  } catch (err) {
    window.showToast(window.tr('ui.toast_network_error'), 'error');
  }
}

export async function mulaiKirimUndanganGrup() {
  var linkEl = document.getElementById('input-link-grup');
  var intervalEl = document.getElementById('input-interval');
  var jobCodeEl = document.getElementById('list-job-code');
  let linkGrup = linkEl ? linkEl.value : '';
  let interval = parseInt(intervalEl ? intervalEl.value : '') || 5;
  let jobCode = jobCodeEl ? jobCodeEl.innerText : '';

  if (!linkGrup) {
    window.showToast(window.tr('ui.toast_group_link_required'), 'error');
    return;
  }

  if (typeof ensureAllCandidates === 'function') {
    try {
      await ensureAllCandidates();
    } catch (e) {}
  }
  let cands = ALL_CANDIDATES.filter((c) => c.idLoker && c.idLoker.includes(jobCode));
  if (cands.length === 0) {
    window.showToast(window.tr('ui.toast_no_cand_in_job'), 'error');
    return;
  }

  let btn = document.getElementById('btn-undang-grup');
  if (btn) {
    btn.innerHTML = window.tr('ui.sending');
    btn.disabled = true;
  }

  // Loop client-side per kandidat (kirimSatuPesanFonnte) diganti satu
  // panggilan server: kirimTawaranMassal (whatsapp.ts). Jeda antar pesan
  // dikirim sebagai parameter `interval` supaya pacing user dihormati.
  // Pesan default server = "gabung ke Grup Resmi" (sama seperti dulu).
  try {
    const res = await window.callAPI('kirimTawaranMassal', [
      { candidates: cands, jobCode: jobCode, linkGrup: linkGrup, interval: interval },
    ]);
    const results = (res && res.results) || [];
    const successCount = results.filter((r) => r.success).length;
    window.showToast(window.tr('ui.toast_invites_done_n').replace('{n}', successCount), 'success');
  } catch (e) {
    window.showToast(
      window.tr('ui.toast_invite_send_failed') + (e && e.message ? e.message : e),
      'error',
    );
  }

  if (btn) {
    btn.innerHTML = window.tr('ui.start_send_invite');
    btn.disabled = false;
  }
}

// ==========================================
// UNDANGAN GRUP KELAS (orang tua/wali) — Opsi A: tanpa ubah DB.
// Admin menempel daftar "Nama|628xxx" (1 baris per orang tua), isi link grup
// + jeda, lalu kirim via action kirimTawaranMassal yang SUDAH ADA (anti-ban:
// tiap orang dapat PESAN berisi link undangan, bukan add anggota manual).
// ==========================================

// Template default pesan undangan kelas (contoh pesan ortu yang dipakai admin,
// placeholder {nama} = nama siswa, {link_grup} = link grup dari form).
const DEFAULT_PESAN_UNDANGAN_KELAS = [
  "Assalamu'alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari {nama}.",
  'Kami dari pengurus LPK AMANAH SAKURA JAPAN PONOROGO mengundang Bapak/Ibu untuk bergabung ke dalam grup WhatsApp resmi kelas guna memantau perkembangan belajar serta informasi kegiatan belajar mengajar (KBM).',
  '',
  'Silakan klik tautan berikut untuk bergabung:',
  '{link_grup}',
  '',
  'Terima kasih atas perhatian dan kerja samanya.',
].join('\n');

// Parse daftar tempelan "Nama|628xxx" → [{nama, wa}]. Terima pemisah |, tab,
// titik koma, atau nomor di akhir baris tanpa separator. Baris tanpa nomor
// valid (gate 628… 12-13 digit) dihitung invalid & dikeluarkan.
export function parseDaftarOrtu(text) {
  const list = [];
  let invalid = 0;
  String(text || '')
    .split(/\r?\n/)
    .forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      let nama = '';
      let waRaw = '';
      const sep = line.search(/[|\t;]/);
      if (sep !== -1) {
        nama = line.slice(0, sep).trim();
        waRaw = line.slice(sep + 1).trim();
      } else {
        const m = line.match(/^(.*?)(\d{9,15})$/);
        if (!m) {
          invalid += 1;
          return;
        }
        nama = m[1].trim();
        waRaw = m[2];
      }
      const wa = window.normalizeWaInput
        ? window.normalizeWaInput(waRaw)
        : waRaw.replace(/\D/g, '');
      const ok = window.isValidWaInput ? window.isValidWaInput(wa) : /^628\d{9,11}$/.test(wa);
      if (!ok || !wa) {
        invalid += 1;
        return;
      }
      list.push({ nama: nama || 'Orang Tua/Wali', wa });
    });
  return { list, invalid };
}

// Pisahkan beberapa VARIAN pesan (dipisah baris `---`). Backend mengirim
// varian BERGILIRAN per penerima — tiap orang tua dapat pesan berbeda
// (anti-ban pesan identik massal). Dipakai preview di sini, logika kirim
// ada di actions-wa.js (handleKirimTawaranMassal).
export function parseVarianPesan(tpl) {
  return String(tpl || '')
    .split(/^---\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function bukaModalUndanganKelas() {
  const linkInput = document.getElementById('input-link-grup-kelas');
  // Prefill link dari kiriman terakhir (localStorage) supaya tidak ketik ulang.
  if (linkInput && !linkInput.value) {
    try {
      linkInput.value = localStorage.getItem('asj_link_grup_kelas') || '';
    } catch (e) {
      /* private mode */
    }
  }
  const pesan = document.getElementById('input-pesan-kelas');
  if (pesan && !pesan.value) pesan.value = DEFAULT_PESAN_UNDANGAN_KELAS;
  previewUndanganKelas();
  const modal = document.getElementById('modal-undangan-kelas');
  if (modal) modal.classList.remove('hidden');
}

export function previewUndanganKelas() {
  const daftarEl = document.getElementById('input-daftar-ortu');
  const list = parseDaftarOrtu(daftarEl ? daftarEl.value : '').list;
  const jml = document.getElementById('span-kelas-jumlah');
  if (jml) jml.textContent = window.tr('ui.list_preview_n').replace('{n}', String(list.length));
  const linkEl = document.getElementById('input-link-grup-kelas');
  const link = linkEl ? linkEl.value.trim() : '';
  const tplEl = document.getElementById('input-pesan-kelas');
  const tpl = tplEl ? tplEl.value : '';
  const variants = parseVarianPesan(tpl);
  const varianEl = document.getElementById('span-kelas-varian');
  if (varianEl) {
    varianEl.textContent =
      variants.length > 1
        ? ' • ' + window.tr('ui.variant_count_n').replace('{n}', String(variants.length))
        : '';
  }
  const prv = document.getElementById('preview-pesan-kelas');
  if (prv) {
    const contohNama = list.length ? list[0].nama : 'Nama Siswa';
    // Preview memakai varian pertama (penerima pertama dapat varian pertama).
    const contohVarian = variants.length ? variants[0] : tpl;
    prv.textContent = contohVarian
      .replace(/\{nama\}/g, contohNama)
      .replace(/\{link_grup\}/g, link || 'https://chat.whatsapp.com/...');
  }
}

export async function kirimUndanganKelas() {
  const daftarEl = document.getElementById('input-daftar-ortu');
  const { list, invalid } = parseDaftarOrtu(daftarEl ? daftarEl.value : '');
  const linkGrup = (document.getElementById('input-link-grup-kelas').value || '').trim();
  const interval = parseInt(document.getElementById('input-interval-kelas').value) || 10;
  const pesan = (document.getElementById('input-pesan-kelas').value || '').trim();

  if (list.length === 0) {
    window.showToast(window.tr('ui.toast_no_valid_wa'), 'error');
    return;
  }
  if (invalid > 0) {
    window.showToast(
      window.tr('ui.toast_invalid_rows_n').replace('{n}', String(invalid)),
      'warning',
    );
  }
  if (!linkGrup) {
    window.showToast(window.tr('ui.toast_group_link_required'), 'error');
    return;
  }
  if (!pesan) {
    window.showToast(window.tr('ui.toast_msg_empty'), 'error');
    return;
  }
  if (
    !confirm(
      window
        .tr('ui.toast_confirm_send_n')
        .replace('{n}', String(list.length))
        .replace('{s}', String(interval)),
    )
  )
    return;

  const btn = document.getElementById('btn-undang-kelas');
  btn.innerHTML = window.tr('ui.sending');
  btn.disabled = true;
  try {
    const res = await window.callAPI('kirimTawaranMassal', [
      {
        candidates: list,
        jobCode: '',
        linkGrup: linkGrup,
        interval: interval,
        customMessage: pesan,
      },
    ]);
    const results = (res && res.results) || [];
    const ok = results.filter((r) => r.success).length;
    try {
      localStorage.setItem('asj_link_grup_kelas', linkGrup);
    } catch (e) {
      /* private mode */
    }
    window.showToast(window.tr('ui.toast_invites_done_n').replace('{n}', String(ok)), 'success');
  } catch (e) {
    window.showToast(
      window.tr('ui.toast_invite_send_failed') + (e && e.message ? e.message : e),
      'error',
    );
  } finally {
    btn.innerHTML = window.tr('ui.start_send_invite');
    btn.disabled = false;
  }
}

// === FUNGSI BUKA MODAL CEK DATA SISWA ===
export async function bukaModalCekDataSiswa() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = 'flex';

  try {
    const res = await window.callAPI('getDaftarSiswaBaru', []);
    if (res.success) {
      let tb = document.getElementById('tbody-cek-siswa');
      let html = '';

      if (res.data.length === 0) {
        html =
          '<tr><td colspan="4" class="p-8 text-center text-slate-500 font-bold italic">' +
          window.tr('ui.no_students') +
          '</td></tr>';
      } else {
        res.data.forEach((s, i) => {
          // Backend sudah kirim kanonikal 'L'/'P'/'' (normalisasi tunggal di
          // normalizeGender → LAKI-LAKI/PEREMPUAN → L/P). Jangan tambah
          // normalisasi varian lain di sini.
          const g = String(s.jenis_kelamin || '');
          let gBadge;
          if (g === 'L') {
            gBadge =
              '<span class="w-6 h-6 rounded-full bg-blue-900/50 text-blue-400 flex items-center justify-center font-bold text-[10px] mx-auto border border-blue-500/30">L</span>';
          } else if (g === 'P') {
            gBadge =
              '<span class="w-6 h-6 rounded-full bg-pink-900/50 text-pink-400 flex items-center justify-center font-bold text-[10px] mx-auto border border-pink-500/30">P</span>';
          } else {
            gBadge =
              '<span class="w-6 h-6 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center font-bold text-[10px] mx-auto border border-slate-600/50" title="Gender belum diisi">&mdash;</span>';
          }

          html += `<tr class="hover:bg-white/5 transition duration-200">
                            <td class="p-3 text-center text-slate-400 text-xs">${i + 1}</td>
                            <td class="p-3 font-bold text-white text-xs">${window.esc(s.nama_lengkap || s.nama)}</td>
                            <td class="p-3 align-middle">${gBadge}</td>
                            <td class="p-3 text-xs text-amber-300 font-medium"><i class="fas fa-map-marker-alt text-red-400 mr-1.5"></i>${window.esc(s.alamat_lengkap || '-')}</td>
                        </tr>`;
        });
      }
      if (tb) tb.innerHTML = html;
      var modalSiswa = document.getElementById('modal-cek-siswa');
      if (modalSiswa) modalSiswa.classList.remove('hidden');
    } else {
      window.showToast(window.tr('ui.toast_load_data_failed_prefix') + res.error, 'error');
    }
  } catch (err) {
    window.showToast(window.tr('ui.toast_network_error_prefix') + err.message, 'error');
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (render/admin.js bukaModalListKandidat, partials
// mulaiKirimUndanganGrup, admin/index bukaModalCekDataSiswa, tombol
// keluarkanKandidatDariJob di daftar).
registerSeamAliases({
  bukaModalListKandidat,
  keluarkanKandidatDariJob,
  mulaiKirimUndanganGrup,
  bukaModalCekDataSiswa,
  parseDaftarOrtu,
  parseVarianPesan,
  bukaModalUndanganKelas,
  previewUndanganKelas,
  kirimUndanganKelas,
});
