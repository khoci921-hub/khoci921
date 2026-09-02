import { ALL_DB_JOBS, ALL_JOBS, currentAdminName } from '../init/state.ts';
import { renderAdminFull } from '../render/admin.ts';
import { registerSeamAliases } from '../core/bridge.ts';
import { uploadToCloudinary } from '../cloudinary.ts';
// 9. INTERAKSI BACKEND — DOMAIN LOKER / KELOLA (jobs)
// ==========================================
// js/api/{forms,jobs,candidates,wa}.js (global scope TETAP di fase ini).
// File ini: kelola loker (simpan/edit/status/hapus/tahapan DB), upload
// pamflet/template (downscale + signed URL), & helper memori window.ALL_DB_JOBS/
// ===== PATCH-IN-PLACE: KELOLA LOKER =====
// Sama seperti mail: backend mengembalikan baris yang berubah, frontend
// menimpa di memori + render ulang dari memori (window.renderAdminFull = murni DOM,
// tanpa network/skeleton). Tarikan penuh tetap jalan diam-diam lewat
// AUTO_REFRESH_TIMER (60 dtk) untuk menangkap perubahan admin lain.
export function upsertJobMemory(job) {
  if (!job || !job.code) return;
  [ALL_DB_JOBS, ALL_JOBS].forEach(function (arr) {
    if (!arr) return;
    var found = -1;
    for (var k = 0; k < arr.length; k++) {
      if (arr[k] && arr[k].code === job.code) {
        found = k;
        break;
      }
    }
    if (found >= 0) arr[found] = job;
    else arr.push(job);
  });
}
export function removeJobMemory(code) {
  if (!code) return;
  [ALL_DB_JOBS, ALL_JOBS].forEach(function (arr) {
    if (!arr) return;
    for (var k = arr.length - 1; k >= 0; k--) {
      if (arr[k] && arr[k].code === code) arr.splice(k, 1);
    }
  });
}
export async function aksiAdmin(st, r) {
  if (!confirm('Ubah status Loker?')) return;
  try {
    const res = await window.callAPI('ubahStatusJob', [r, st, currentAdminName]);
    if (res.success) {
      upsertJobMemory(res.job);
      if (typeof renderAdminFull === 'function') renderAdminFull();
    } else window.showToast(res.error || 'Gagal ubah status', 'error');
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  }
}
export async function hapusLoker(r) {
  if (!confirm('Hapus Loker?')) return;
  try {
    const res = await window.callAPI('hapusJobData', [r, currentAdminName]);
    if (res.success) {
      removeJobMemory(r);
      if (typeof renderAdminFull === 'function') renderAdminFull();
    } else
      window.showToast(
        res.error || 'Gagal hapus loker. Mungkin masih ada kandidat terkait.',
        'error',
      );
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  }
}

// Downscale gambar (pamflet/foto) saat upload via canvas — max 800px, jpeg
// quality 0.8. Tujuan: byte di Storage kecil SELAMANYA tanpa fitur berbayar
// Supabase Image Transformations (Free plan tidak menyediakan resize).
// Non-gambar (pdf/docx template CV) & gambar gagal-decode (HEIC/korup)
// dikembalikan apa adanya supaya alur upload tidak berubah/macet.
export async function downscaleImageFile(file, maxWidth, quality) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('read fail'));
      r.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode fail'));
      // @ts-expect-error JS→TS migration
      i.src = dataUrl;
    });
    // @ts-expect-error JS→TS migration
    let w = img.width,
      // @ts-expect-error JS→TS migration
      h = img.height;
    const MAX = maxWidth || 800;
    if (w > MAX) {
      h = Math.round((h * MAX) / w);
      w = MAX;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    // @ts-expect-error JS→TS migration
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality || 0.8),
    );
    // @ts-expect-error JS→TS migration
    if (!blob || blob.size >= file.size) return file; // hasil tak lebih kecil → kirim asli
    const base = String(file.name || 'image').replace(/\.[^/.]+$/, '') || 'image';
    // @ts-expect-error JS→TS migration
    return new File([blob], base + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    return file;
  }
}

export async function uploadFilesDirectly(filesObj, folder) {
  // Downscale dulu (foto/pamflet → max 800px jpeg) supaya byte di Cloudinary
  // kecil; non-gambar dibiarkan utuh oleh downscaleImageFile.
  const files: Record<string, any> = {};
  for (const k of Object.keys(filesObj))
    files[k] = filesObj[k] ? await downscaleImageFile(filesObj[k], 800, 0.8) : null;
  const toUpload = Object.keys(files).filter((k) => files[k]);
  if (toUpload.length === 0) return {};
  // Upload LANGSUNG ke Cloudinary — backend hanya menerima string URL hasil
  // upload (tidak ada lagi getUploadUrls / PUT ke Supabase Storage).
  const uploadedUrls: Record<string, any> = {};
  for (const key of toUpload) {
    // @ts-expect-error JS→TS migration
    uploadedUrls[key] = await uploadToCloudinary(files[key]);
  }
  return uploadedUrls;
}

export async function submitFormAdmin(e) {
  e.preventDefault();
  var btn = document.getElementById('btn-submit-admin');
  if (!btn) return;
  btn.innerHTML = window.tr('ui.uploading');
  btn.disabled = true;
  document.getElementById('global-loader').style.display = 'flex';

  var cbl = document.querySelectorAll('input[name="lokasi_cb"]:checked');
  var arrLok = [];
  for (var i = 0; i < cbl.length; i++) {
    arrLok.push(cbl[i].value);
  }
  var customLok = document.getElementById('custom-lokasi').value;
  if (customLok.trim()) arrLok.push(customLok.trim());

  var cbs = document.querySelectorAll('input[name="syarat_cb"]:checked');
  var arrSyr = [];
  for (var j = 0; j < cbs.length; j++) {
    arrSyr.push(cbs[j].value);
  }
  var customSyr = document.getElementById('custom-syarat').value;
  if (customSyr.trim()) arrSyr.push(customSyr.trim());

  var cbr = document.querySelectorAll('input.cbx-req-file:checked');
  var arrReq = [];
  for (var k = 0; k < cbr.length; k++) {
    arrReq.push(cbr[k].value);
  }
  var customReq = document.getElementById('custom-req-file').value;
  if (customReq.trim()) {
    customReq.split(',').forEach(function (val) {
      if (val.trim()) arrReq.push(val.trim());
    });
  }

  try {
    var filesToUpload: Record<string, any> = {};
    if (document.getElementById('input-template').files[0])
      filesToUpload.formatCv = document.getElementById('input-template').files[0];
    if (document.getElementById('input-pamflet').files[0])
      filesToUpload.pamflet = document.getElementById('input-pamflet').files[0];

    var jobName = document.getElementById('input-pekerjaan').value;
    var folderName =
      'jobs/' + Date.now() + '_' + jobName.substring(0, 10).replace(/[^A-Z0-9_-]/gi, '_');
    var uploadedUrls = await uploadFilesDirectly(filesToUpload, folderName);

    var data = {
      admin: currentAdminName,
      tsk: document.getElementById('input-tsk').value || '-',
      kategori: document.getElementById('input-kategori').value,
      pekerjaan: jobName,
      lokasi: arrLok.length > 0 ? arrLok.join(', ') : '-',
      gender: document.getElementById('input-gender').value,
      templateCv: uploadedUrls.formatCv || '-',
      status: '✅ OPEN',
      kuota: document.getElementById('input-kuota').value || '-',
      jmlKandidat: '0',
      syarat: arrSyr.length > 0 ? arrSyr.join(', ') : '-',
      keterangan: document.getElementById('input-keterangan').value || '-',
      pamflet: uploadedUrls.pamflet || '-',
      tahapanDB: document.getElementById('input-tahapan-db').value || '-',
      totalBiaya: document.getElementById('input-total-biaya').value || '',
      rincianBiaya: document.getElementById('input-rincian-biaya').value || '',
      dokumenShare: arrReq.join(','),
    };
    const res = await window.callAPI('simpanJobBaru', [data]);
    if (res.success) {
      document.getElementById('form-tambah-job').reset();
      window.refreshDataDinamis('kelola');
    } else window.showToast(window.tr('alert.failed') + ' ' + (res.error || ''), 'error');
  } catch (err) {
    window.showToast(window.tr('ui.toast_upload_failed') + err.message, 'error');
  } finally {
    btn.innerHTML = window.tr('button.upload_job');
    btn.disabled = false;
    document.getElementById('global-loader').style.display = 'none';
  }
}

export function bukaEditFullLoker(c) {
  try {
    var jp = ALL_JOBS.find((j) => j.code === c);
    var jd = ALL_DB_JOBS.find((j) => j.code === c);
    if (!jp) return;
    document.getElementById('ef-code').value = c;
    document.getElementById('ef-pekerjaan').value = jp.pekerjaan || '';
    document.getElementById('ef-kategori').value = jp.kategori || '';
    document.getElementById('ef-lokasi').value = jp.lokasi || '';
    document.getElementById('ef-gender').value = jp.gender || '';
    document.getElementById('ef-syarat').value = jp.syarat || '';
    document.getElementById('ef-keterangan').value = jp.keterangan || '';
    document.getElementById('ef-total-biaya').value = jp.totalBiaya || '';
    document.getElementById('ef-rincian-biaya').value = jp.rincianBiaya || '';
    var sumEdit = document.getElementById('rincian-summary-edit');
    if (sumEdit && typeof window.rbSummaryFromData === 'function') {
      sumEdit.innerHTML =
        window.rbSummaryFromData(jp.totalBiaya || '', jp.rincianBiaya || '') ||
        'Klik untuk isi rincian biaya';
    }
    if (jd) {
      document.getElementById('ef-tsk').value = jd.tsk || '';
      document.getElementById('ef-kuota').value = jd.kuota || '';
      // document.getElementById('ef-template').value = jd.templateCv || "";
      // document.getElementById('ef-pamflet').value = jd.pamflet || "";
    }

    // Set Checkboxes untuk Dokumen Share
    var dokArr =
      jd && jd.dokumen_share
        ? jd.dokumen_share.split(',')
        : jp.dokumen_share
          ? jp.dokumen_share.split(',')
          : ['CV', 'JFT', 'SSW'];
    var cbsEdit = document.querySelectorAll('.cbx-req-file-edit');
    cbsEdit.forEach((cb) => (cb.checked = false));
    var customReqsEdit = [];
    var standardVals = Array.from(cbsEdit).map((cb) => cb.value);
    dokArr.forEach((d) => {
      var dt = d.trim();
      if (standardVals.includes(dt)) {
        var cbMatch = Array.from(cbsEdit).find((cb) => cb.value === dt);
        if (cbMatch) cbMatch.checked = true;
      } else if (dt) {
        customReqsEdit.push(dt);
      }
    });
    if (document.getElementById('custom-req-file-edit')) {
      document.getElementById('custom-req-file-edit').value = customReqsEdit.join(', ');
    }
    document.getElementById('modal-edit-full-loker').classList.remove('hidden');
  } catch (e) {
    window.showToast(window.tr('ui.toast_modal_error'), 'error');
  }
}

export async function submitEditFullLoker(e) {
  e.preventDefault();
  var btn = document.getElementById('btn-submit-ef');
  if (!btn) return;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> ' + window.tr('ui.saving') + '';
  btn.disabled = true;
  document.getElementById('global-loader').style.display = 'flex';

  var cbr = document.querySelectorAll('input.cbx-req-file-edit:checked');
  var arrReq = [];
  for (var k = 0; k < cbr.length; k++) {
    arrReq.push(cbr[k].value);
  }
  var customReq = document.getElementById('custom-req-file-edit')
    ? document.getElementById('custom-req-file-edit').value
    : '';
  if (customReq.trim()) {
    customReq.split(',').forEach(function (val) {
      if (val.trim()) arrReq.push(val.trim());
    });
  }

  try {
    var filesToUpload: Record<string, any> = {};
    if (document.getElementById('ef-template').files[0])
      filesToUpload.formatCv = document.getElementById('ef-template').files[0];
    if (document.getElementById('ef-pamflet').files[0])
      filesToUpload.pamflet = document.getElementById('ef-pamflet').files[0];

    var jobCode = document.getElementById('ef-code').value;
    var uploadedUrls: Record<string, any> = {};
    if (Object.keys(filesToUpload).length > 0) {
      var folderName = 'jobs/' + jobCode;
      uploadedUrls = await uploadFilesDirectly(filesToUpload, folderName);
    }

    var jd = ALL_DB_JOBS.find((j) => j.code === jobCode);
    var finalTemplate = uploadedUrls.formatCv || (jd ? jd.templateCv : '-');
    var finalPamflet = uploadedUrls.pamflet || (jd ? jd.pamflet : '-');

    var data = {
      admin: currentAdminName,
      code: jobCode,
      pekerjaan: document.getElementById('ef-pekerjaan').value,
      kategori: document.getElementById('ef-kategori').value,
      lokasi: document.getElementById('ef-lokasi').value,
      gender: document.getElementById('ef-gender').value,
      syarat: document.getElementById('ef-syarat').value,
      keterangan: document.getElementById('ef-keterangan').value,
      tsk: document.getElementById('ef-tsk').value,
      kuota: document.getElementById('ef-kuota').value,
      templateCv: finalTemplate,
      pamflet: finalPamflet,
      totalBiaya: document.getElementById('ef-total-biaya').value || '',
      rincianBiaya: document.getElementById('ef-rincian-biaya').value || '',
      // Kirim nilai mentah (bisa kosong) — backend editLokerFull yang
      // memutuskan: kosong = pertahankan nilai lama, isi = timpa.
      dokumenShare: arrReq.join(','),
    };
    const res = await window.callAPI('editLokerFull', [data]);
    if (res.success) {
      document.getElementById('modal-edit-full-loker').classList.add('hidden');
      window.refreshDataDinamis('kelola');
    } else window.showToast(window.tr('alert.failed') + ' ' + (res.error || ''), 'error');
  } catch (err) {
    window.showToast(window.tr('ui.toast_upload_failed') + err.message, 'error');
  } finally {
    btn.innerText = window.tr('button.save_changes');
    btn.disabled = false;
    document.getElementById('global-loader').style.display = 'none';
  }
}

export function bukaModalEditDbJob(r, th, st) {
  const edr = document.getElementById('edit-db-row');
  if (edr) edr.value = r;
  const edt = document.getElementById('edit-db-tahapan');
  if (edt) edt.value = th;
  const eds = document.getElementById('edit-db-status');
  if (eds) eds.value = st;
  document.getElementById('modal-edit-dbjob').classList.remove('hidden');
}

export async function simpanUpdateDbJob() {
  const btn = document.getElementById('btn-save-dbjob');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> ' + window.tr('ui.saving') + '';
  btn.disabled = true;
  document.getElementById('global-loader').style.display = 'flex';
  try {
    const res = await window.callAPI('updateTahapanDbJob', [
      document.getElementById('edit-db-row').value,
      document.getElementById('edit-db-tahapan').value,
      document.getElementById('edit-db-status').value, // probe2
      currentAdminName,
    ]); // probe
    if (res.success) {
      document.getElementById('modal-edit-dbjob').classList.add('hidden');
      upsertJobMemory(res.job);
      if (typeof renderAdminFull === 'function') renderAdminFull();
    } else window.showToast(window.tr('alert.failed') + ' ' + (res.error || ''), 'error');
  } catch (err) {
    window.showToast(
      window.tr('alert.network') + (err && err.message ? err.message : err),
      'error',
    );
  } finally {
    btn.innerText = window.tr('button.update_db');
    btn.disabled = false;
    document.getElementById('global-loader').style.display = 'none';
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (submitFormAdmin/submitEditFullLoker/simpanUpdateDbJob)
// + render/admin.js (aksiAdmin/hapusLoker/bukaEditFullLoker/bukaModalEditDbJob).
registerSeamAliases({
  aksiAdmin,
  hapusLoker,
  submitFormAdmin,
  bukaEditFullLoker,
  submitEditFullLoker,
  bukaModalEditDbJob,
  simpanUpdateDbJob,
});
