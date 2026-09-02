import { ALL_CANDIDATES, ALL_FORM, currentAdminName } from '../init/state.ts';
import { renderFormInbox } from '../render/mail.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// 9. INTERAKSI BACKEND (NETLIFY FUNCTIONS + SUPABASE) — DOMAIN MAIL INBOX
// ==========================================
// js/api/{forms,jobs,candidates,wa}.js (global scope TETAP di fase ini).
// File ini: aksi mail/form (review/approve/reject/delete/tandai dibaca) +
// patch-in-place di memori (window.ALL_FORM / window.ALL_CANDIDATES / window.MAIL_SELECTED).
// REFACTOR: semua interaksi backend kini async/await + try/catch/finally.
// Pola lama .then().catch() diganti blok try/finally supaya loader dan
// tombol tidak pernah terkunci, dan error terpusat di satu tempat.
// ===== PATCH-IN-PLACE (aksi admin tanpa tarik ulang data penuh) =====
// Backend kini mengembalikan baris yang berubah (form/candidate) per aksi.
// Frontend cukup menimpa data di memori lalu render tabel aktif SAJA —
// tanpa global-loader/skeleton. Tarikan penuh (getAppData) tetap berjalan
// diam-diam lewat AUTO_REFRESH_TIMER (60 dtk) untuk menangkap perubahan
// dari admin lain, jadi data tidak pernah basi dalam waktu lama.
// FIX #6 (audit 2026-09-02): Patching by form id, bukan rowIndex.
// Auto-refresh bisa bergeser array index kapan saja — selalu cari by id.
export function patchFormMail(idOrIndex, newForm) {
  if (!newForm) return;
  // Cari by id (jalur baru) atau index (legacy fallback)
  var found = -1;
  for (var k = 0; k < ALL_FORM.length; k++) {
    if (ALL_FORM[k] && String(ALL_FORM[k].id) === String(newForm.id)) {
      found = k;
      break;
    }
  }
  if (found >= 0) {
    ALL_FORM[found] = newForm;
  } else {
    // Fallback: coba cari by id dari parameter
    var byParam = -1;
    for (var k2 = 0; k2 < ALL_FORM.length; k2++) {
      if (ALL_FORM[k2] && String(ALL_FORM[k2].id) === String(idOrIndex)) {
        byParam = k2;
        break;
      }
    }
    if (byParam >= 0) ALL_FORM[byParam] = newForm;
    else ALL_FORM.push(newForm);
  }
  if (typeof renderFormInbox === 'function') renderFormInbox();
  if (typeof window.updateMailBadge === 'function') window.updateMailBadge();
}
// Upsert kandidat hasil approve/reject ke memori — tab DB JOB & daftar
// kandidat langsung benar saat admin pindah tab (tanpa refetch).
export function upsertCandidateMemory(cand) {
  if (!cand || !cand.wa) return;
  var found = -1;
  for (var k = 0; k < ALL_CANDIDATES.length; k++) {
    if (ALL_CANDIDATES[k] && ALL_CANDIDATES[k].wa === cand.wa) {
      found = k;
      break;
    }
  }
  if (found >= 0) ALL_CANDIDATES[found] = cand;
  else ALL_CANDIDATES.push(cand);
}
// Hapus baris mail di memori + render ulang (dipakai hapus tunggal).
// FIX #6 (audit 2026-09-02): Hapus by id, bukan rowIndex.
export function removeFormMail(idOrIndex) {
  var id = String(idOrIndex);
  var found = -1;
  for (var k = 0; k < ALL_FORM.length; k++) {
    if (ALL_FORM[k] && String(ALL_FORM[k].id) === id) {
      found = k;
      break;
    }
  }
  if (found >= 0) ALL_FORM.splice(found, 1);
  // Seleksi massal tidak valid setelah hapus — bersihkan.
  window.MAIL_SELECTED = {};
  if (typeof renderFormInbox === 'function') renderFormInbox();
  if (typeof window.updateMailBadge === 'function') window.updateMailBadge();
}
// FIX #6 (audit 2026-09-02): r = form id (string), bukan rowIndex (number).
export async function prosesReviewForm(r) {
  if (!confirm(window.tr('form.txt_review_confirm'))) return;
  try {
    const res = await window.callAPI('reviewForm', [String(r), currentAdminName]);
    if (res.success) {
      window.MAIL_SELECTED[String(r)] = true;
      patchFormMail(r, res.form);
    } else window.showToast(window.tr('alert.failed') + ' ' + (res.error || ''), 'error');
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  }
}
export async function prosesApproveForm(r) {
  if (!confirm(window.tr('form.txt_approve_confirm'))) return;
  try {
    const res = await window.callAPI('approveForm', [String(r), currentAdminName]);
    if (res.success) {
      window.MAIL_SELECTED[String(r)] = true;
      patchFormMail(r, res.form);
      upsertCandidateMemory(res.candidate);
    } else window.showToast(window.tr('alert.failed') + ' ' + (res.error || ''), 'error');
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  }
}
export function prosesRejectForm(r) {
  // FIX #6: Simpan form id (bukan rowIndex) untuk submit nanti.
  document.getElementById('reject-row-index').value = String(r);
  document.getElementById('reject-reason-text').value = '';
  const modal = document.getElementById('modal-reject-mail');
  if (modal) modal.classList.remove('hidden');
}
export async function submitRejectForm() {
  const r = document.getElementById('reject-row-index').value;
  const reason = document.getElementById('reject-reason-text').value;
  document.getElementById('modal-reject-mail').classList.add('hidden');
  try {
    const res = await window.callAPI('rejectForm', [String(r), currentAdminName, reason]);
    if (res.success) {
      window.MAIL_SELECTED[String(r)] = true;
      patchFormMail(r, res.form);
      upsertCandidateMemory(res.candidate);
    } else window.showToast(window.tr('alert.failed') + ' ' + (res.error || ''), 'error');
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  }
}
// Tandai Dibaca — baris status UPDATE (kandidat ubah data) kembali ke
// status aslinya (LULUS/GAGAL/REVIEW) via [[PREV:...]] di feedback_berkas.
export async function tandaiDibacaForm(r) {
  try {
    const res = await window.callAPI('tandaiDibacaForm', [String(r)]);
    if (res.success) {
      delete window.MAIL_SELECTED[String(r)];
      patchFormMail(r, res.form);
    } else window.showToast(window.tr('alert.failed') + ' ' + (res.error || ''), 'error');
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  }
}
export function toggleMailSelect(cb) {
  if (!cb) return;
  var idx = cb.dataset && cb.dataset.idx;
  if (idx === undefined || idx === null) return;
  if (cb.checked) window.MAIL_SELECTED[idx] = true;
  else delete window.MAIL_SELECTED[idx];
  // Sinkronkan tombol "centang semua" dengan kondisi baris yang tampil.
  var all = document.getElementById('mail-check-all');
  if (all) {
    var boxes = document.querySelectorAll('#admin-mail-body .mail-check');
    var vis = Array.prototype.filter.call(boxes, function (b) {
      return !b.closest('tr').classList.contains('hidden');
    });
    all.checked =
      vis.length > 0 &&
      vis.every(function (b) {
        return b.checked;
      });
  }
}
export function mailSelectAll(cb) {
  var boxes = document.querySelectorAll('#admin-mail-body .mail-check');
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].checked = cb.checked;
    if (cb.checked) window.MAIL_SELECTED[boxes[i].dataset.idx] = true;
    else delete window.MAIL_SELECTED[boxes[i].dataset.idx];
  }
}// FIX #6 (audit 2026-09-02): Hapus massal by form id, bukan rowIndex.
export async function hapusFormMailTerpilih() {
  var formIds = Object.keys(window.MAIL_SELECTED);
  if (formIds.length === 0) {
    window.showToast(window.tr('ui.select_mail_first'), 'error');
    return;
  }
  if (
    !confirm(
      'Hapus ' + formIds.length + ' lamaran terpilih? Data kandidat & master TIDAK ikut terhapus.',
    )
  )
  return;
  var ok = 0;
  var fail = 0;
  try {
    for (var i = 0; i < formIds.length; i++) {
      try {
        const res = await window.callAPI('deleteForm', [formIds[i]]);
        if (res && res.success) {
          ok++;
          // Hapus dari memori by id
          for (var k = ALL_FORM.length - 1; k >= 0; k--) {
            if (ALL_FORM[k] && String(ALL_FORM[k].id) === String(formIds[i])) {
              ALL_FORM.splice(k, 1);
              break;
            }
          }
        } else fail++;
      } catch (e) {
        fail++;
      }
    }
    window.MAIL_SELECTED = {};
    window.showToast(
      'Hapus: ' + ok + ' berhasil' + (fail ? ', ' + fail + ' gagal' : ''),
      fail ? 'error' : 'success',
    );
    if (fail > 0) {
      window.refreshDataDinamis('mail');
    } else {
      if (typeof renderFormInbox === 'function') renderFormInbox();
      if (typeof window.updateMailBadge === 'function') window.updateMailBadge();
    }
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  }
}
export async function hapusFormMail(formId) {
  if (!confirm(window.tr('ui.confirm_delete_mail'))) return;
  try {
    const res = await window.callAPI('deleteForm', [String(formId)]);
    if (res.success) removeFormMail(formId);
    else window.showToast(window.tr('alert.failed') + ' ' + (res.error || ''), 'error');
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (mail table render/mail.js + partials/modals-shared.html).
registerSeamAliases({
  submitRejectForm,
  toggleMailSelect,
  mailSelectAll,
  hapusFormMailTerpilih,
  hapusFormMail,
  prosesReviewForm,
  prosesApproveForm,
  prosesRejectForm,
  tandaiDibacaForm,
});
