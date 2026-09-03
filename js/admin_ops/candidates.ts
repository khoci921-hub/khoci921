import { ALL_CANDIDATES, ALL_DB_JOBS, ALL_WA_TEMPLATES } from '../init/state.ts';
import { renderAdminFull } from '../render/admin.ts';
import { ensureAllCandidates } from '../api/candidates.ts';
import { upsertCandidateMemory, patchFormMail } from '../api/forms.ts';
import { registerSeamAliases } from '../core/bridge.ts';
import { splitPesanVariants, buatVarianPesanOtomatis } from '../../shared/wa-text.ts';
import { parseDaftarOrtuRows } from '../../shared/wa-list.ts';
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

  // Loop client-side per kandidat (1 nomor = 1 panggilan server cepat +
  // jeda acak anti-ban di browser — kirimBertahap). Jeda TIDAK boleh
  // dijalankan server (kirimTawaranMassal): fungsi Netlify sinkron dibunuh
  // platform ±10 dtk, jadi dengan jeda 10 dtk hanya pesan pertama yang
  // terkirim lalu berhenti (bug 2026-09-03: WA Pintar cuma kirim 1x).
  if (btn) {
    btn.innerHTML = window.tr('ui.sending') + ' (0/' + cands.length + ')';
    btn.disabled = true;
  }
  try {
    const results = await kirimBertahap({
      list: cands,
      jobCode: jobCode,
      linkGrup: linkGrup,
      interval: interval,
      onProgress: (done, total) => {
        if (btn) btn.innerHTML = window.tr('ui.sending') + ' (' + done + '/' + total + ')';
      },
    });
    const successCount = results.filter((r) => r.success).length;
    window.showToast(
      window.tr('ui.toast_invites_done_n').replace('{n}', String(successCount)),
      'success',
    );
  } catch (e) {
    window.showToast(
      window.tr('ui.toast_invite_send_failed') + (e && e.message ? e.message : e),
      'error',
    );
  } finally {
    if (btn) {
      btn.innerHTML = window.tr('ui.start_send_invite');
      btn.disabled = false;
    }
  }
}

// ==========================================
// UNDANGAN GRUP KELAS (orang tua/wali) — Opsi A: tanpa ubah DB.
// Admin menempel daftar "Nama|628xxx" (1 baris per orang tua), isi link grup
// + jeda, lalu kirim bertahap per nomor (kirimSatuTawaran via kirimBertahap —
// anti-ban: tiap orang dapat PESAN berisi link undangan, bukan add anggota
// manual; pacing dijalankan browser supaya tidak kena timeout Netlify).
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

// Parse daftar tempelan → [{nama, wa}]: format lama "Nama|628xxx" (pemisah
// |/tab/;) ATAU nomor di akhir baris ATAU tempelan daftar anggota WhatsApp
// ("1. NAMA +62 831-9187-1783"). Nomor internasional eksplisit ("+81 …",
// "+65 …") sah untuk daftar undangan ini — hanya untuk data KANDIDAT gate
// 628… tetap berlaku (shared/wa-rules.ts). Baris tanpa nomor valid dihitung
// invalid & dikeluarkan. SUMBER KEBENARAN parsing di shared/wa-list.ts
// (parseDaftarOrtuRows) — di-unit-test di sana.
export function parseDaftarOrtu(text) {
  return parseDaftarOrtuRows(text);
}

// Pisahkan beberapa VARIAN pesan (dipisah baris `---`). Backend mengirim
// varian BERGILIRAN per penerima — tiap orang tua dapat pesan berbeda
// (anti-ban pesan identik massal). Dipakai preview di sini; SUMBER KEBENARAN
// TUNGGAL parsing di shared/wa-text.ts (splitPesanVariants, dipakai juga
// backend actions-wa). Nama lama parseVarianPesan dipertahankan utk seam
// window.* (render/admin + partials) — jangan definisikan parsing ulang.
export const parseVarianPesan = splitPesanVariants;

// ==========================================
// KIRIM BERTAHAP (pacing di BROWSER, jeda acak anti-ban)
// ==========================================
// 1 nomor = 1 panggilan server `kirimSatuTawaran` yang cepat & stateless
// (<2 dtk) — tidak pernah kena timeout platform Netlify. Jeda antar nomor
// dijalankan DI SINI (browser) dengan nilai acak `interval` s.d.
// `interval + 50%` (min +2 dtk) supaya pola kirim tidak seragam & tidak pernah
// lebih cepat dari input admin.
//
// Kenapa bukan kirimTawaranMassal: versi massal menidurkan interval DI DALAM
// SATU invokasi fungsi Netlify. Fungsi sinkron Netlify dibunuh platform
// setelah ~10 dtk (default; maks 26 dtk) — dengan jeda default 10 dtk hanya
// pesan pertama yang sempat terkirim lalu proses mati (bug 2026-09-03: WA
// Pintar cuma kirim 1x, abis itu berhenti).

// Fallback template wa_templates (aturan sama dengan backend kirimTawaranMassal:
// nama mengandung grup/undang) dipakai saat customMessage kosong.
export function templateWaFallback() {
  const found = (ALL_WA_TEMPLATES || []).find((r) => {
    const n = String((r && r.nama) || '').toLowerCase();
    return n.includes('grup') || n.includes('undang');
  });
  return found && found.isi ? String(found.isi) : null;
}

// Tidur acak: interval + Math.random() × (50% interval, minimal 2 dtk).
export function sleepAcak(interval) {
  const base = (Number(interval) > 0 ? Number(interval) : 10) * 1000;
  const jitter = Math.floor(Math.random() * Math.max(2000, Math.round(base / 2)));
  return new Promise((resolve) => setTimeout(resolve, base + jitter));
}

// Loop kirim per penerima. `list` = [{wa, nama}]. Mengembalikan array hasil
// per penerima {wa, nama, success, error} — kegagalan satu nomor TIDAK
// menghentikan sisa daftar. onProgress(done, total, { menungguRateLimit })
// dipanggil tiap nomor.
//
// RATE LIMIT (FONNTE_ACTIONS = 2/menit per admin di handlers.ts): saat server
// membalas { rateLimited: true, retryAfter } — nomor yang SAMA diulang setelah
// `retryAfter + 1` dtk (maks 3 percobaan), jadi batch tetap terkirim SEMUA
// dengan pace ~1 pesan/30 dtk, bukan gagal diam-diam di nomor ke-3.
export async function kirimBertahap(opts) {
  const list = (opts && opts.list) || [];
  const jobCode = String((opts && opts.jobCode) || '');
  const linkGrup = String((opts && opts.linkGrup) || '');
  const interval = Number((opts && opts.interval) || 10);
  const customMessage = String((opts && opts.customMessage) || '');
  const onProgress = (opts && opts.onProgress) || null;
  // Resolve template fallback SEKALI per batch (bukan per nomor).
  const templateIsi = templateWaFallback();
  const results = [];
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i] || {};
    const wa = String(c.wa || '').trim();
    const nama = String(c.nama || 'Kandidat');
    // any: respons callAPI bisa { success, error } biasa ATAU { success:false,
    // rateLimited:true, retryAfter } dari rate limiter (handlers.ts).
    let res = { success: false, error: 'Nomor WA tidak valid.', rateLimited: false, retryAfter: 0 };
    if (wa) {
      // Ulangi nomor yang sama saat server minta jeda (rate limit) —
      // tunggu retryAfter + 1 dtk, maks 3 percobaan per nomor.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        res = await window.callAPI('kirimSatuTawaran', [
          { wa: wa, nama: nama, index: i, jobCode: jobCode, linkGrup: linkGrup, customMessage: customMessage, templateIsi: templateIsi },
        ]);
        if (!res || !res.rateLimited) break;
        const wait = Math.max(Number(res.retryAfter) || 60, 1) + 1;
        if (onProgress) {
          try {
            onProgress(i + 1, list.length, { menungguRateLimit: true, wait: wait });
          } catch (e) {
            /* progress opsional */
          }
        }
        await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      }
    }
    results.push({
      wa: wa,
      nama: nama,
      success: !!(res && res.success),
      error: (res && res.error) || null,
    });
    if (onProgress) {
      try {
        onProgress(i + 1, list.length);
      } catch (e) {
        /* progress opsional */
      }
    }
    if (i < list.length - 1) await sleepAcak(interval);
  }
  return results;
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
// ==========================================
// AUTO-VARIAN ANTI-BAN — ubah 1 template jadi 2-4 variasi pembuka/penutup
// (pesan asli tetap varian #1, isi/link/job TIDAK diubah). Dipicu tombol di
// modal (onclick generateVarianOtomatisKelas) — lalu preview di-refresh.
// ==========================================
export function generateVarianOtomatisKelas() {
  const ta = document.getElementById('input-pesan-kelas');
  const tpl = ta ? String(ta.value || '') : '';
  const existing = splitPesanVariants(tpl);
  if (existing.length > 1) {
    window.showToast(
      window.tr('ui.autovarian_exists').replace('{n}', String(existing.length)),
      'warning',
    );
    return;
  }
  const daftarEl = document.getElementById('input-daftar-ortu');
  const list = parseDaftarOrtuRows(daftarEl ? daftarEl.value : '').list;
  // Ideal: tiap penerima dapat varian unik; otomatis maks 4 variasi total.
  const target = Math.min(Math.max(list.length, 2), 4);
  const variants = buatVarianPesanOtomatis(tpl, target);
  if (!variants.length) {
    window.showToast(window.tr('ui.toast_msg_empty'), 'error');
    return;
  }
  if (variants.length < 2) {
    window.showToast(window.tr('ui.toast_no_valid_wa'), 'error');
    return;
  }
  ta.value = variants.join('\n---\n');
  previewUndanganKelas();
  window.showToast(
    window.tr('ui.autovarian_ok').replace('{n}', String(variants.length)),
    'success',
  );
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
  btn.innerHTML = window.tr('ui.sending') + ' (0/' + list.length + ')';
  btn.disabled = true;
  try {
    const results = await kirimBertahap({
      list: list,
      jobCode: '',
      linkGrup: linkGrup,
      interval: interval,
      customMessage: pesan,
      onProgress: (done, total, info) => {
        if (info && info.menungguRateLimit) {
          btn.innerHTML =
            window.tr('ui.sending_wait_rl').replace('{s}', String(info.wait || '')) +
            ' (' +
            done +
            '/' +
            total +
            ')';
        } else {
          btn.innerHTML = window.tr('ui.sending') + ' (' + done + '/' + total + ')';
        }
      },
    });
    const ok = results.filter((r) => r.success).length;
    try {
      localStorage.setItem('asj_link_grup_kelas', linkGrup);
    } catch (e) {
      /* private mode */
    }
    const gagal = results.length - ok;
    window.showToast(
      window.tr('ui.toast_invites_done_n').replace('{n}', String(ok)) +
        (gagal > 0 ? window.tr('ui.toast_invites_done_failed_n').replace('{n}', String(gagal)) : ''),
      gagal > 0 ? 'warning' : 'success',
    );
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
  generateVarianOtomatisKelas,
  kirimUndanganKelas,
});
