import { ALL_JOBS, currentKandidatName, currentKandidatWa } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// ==========================================
// AKSI LAMAR LOKER — submit lamaran via form bridge + salin info loker
// ==========================================

export function lamarJob(jc, b, req) {
  // Guard: kalau tahapan job sudah berjalan (seleksi/pendokumenan), tolak
  // lamaran baru walau tombol sempat terklik (mis. halaman lama di-cache).
  var job = (ALL_JOBS || []).find(function (x) {
    return x.code === jc;
  });
  if (job && window.jobTutupUntukLamar(job)) {
    window.showToast(window.tr('ui.toast_job_closed_process'), 'error');
    return;
  }
  window.bukaFormBridge(
    'generateFormBridge',
    [jc, b, currentKandidatWa, currentKandidatName, req],
    window.tr('ui.toast_apply_form_url_missing'),
  );
}

export function copyInfoLoker(c) {
  var j = ALL_JOBS.find((x) => x.code === c);
  if (!j) return;
  var txt =
    '*INFO LOKER ASJ*  Posisi: ' +
    j.pekerjaan +
    '  Lokasi: ' +
    j.lokasi +
    '  Gender: ' +
    j.gender +
    '  *Syarat:*  ' +
    j.syarat +
    '  *Ket:*  ' +
    j.keterangan +
    '  Daftar via portal resmi.';
  window.salinTeksDecode(encodeURIComponent(txt));
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (render/public.js + 01_public.js lamarJob).
registerSeamAliases({
  lamarJob,
});
