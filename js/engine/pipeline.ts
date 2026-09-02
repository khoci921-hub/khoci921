import { DROPDOWNS } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// ==========================================
// PIPELINE TAHAPAN — konfigurasi pipeline & matematika progres kandidat
// ==========================================

// Pipeline tahapan kandidat DINAMIS dari system config (list_tahapan):
// CHECK KAIWA → MENDAN → MENSETSU → LOLOS USER → MCU PARPOR → TTD KONTRAK
// → PROSES COE → VISA → FLIGHT. Fallback ke daftar lama kalau config kosong.
export function tahapanPipeline() {
  if (DROPDOWNS && Array.isArray(DROPDOWNS.tahapan) && DROPDOWNS.tahapan.length)
    return DROPDOWNS.tahapan;
  return [
    'CHECK KAIWA',
    'MENDAN',
    'MENSETSU',
    'LOLOS USER',
    'MCU PARPOR',
    'TTD KONTRAK',
    'PROSES COE',
    'VISA',
    'FLIGHT',
  ];
}

// Cocokkan tahapan kandidat ke salah satu langkah pipeline (case-insensitive,
// prefix match). Return -1 kalau tidak ketemu (mis. status loker publik).
export function tahapanMatchIdx(thpRaw) {
  if (!thpRaw || thpRaw === '-') return -1;
  let thp = String(thpRaw).toUpperCase().trim();
  let pipe = tahapanPipeline();
  for (let i = 0; i < pipe.length; i++) {
    let p = String(pipe[i]).toUpperCase().trim();
    if (p && (thp.indexOf(p) >= 0 || p.indexOf(thp) >= 0)) return i;
  }
  return -1;
}

export function getTahapanProgress(thpRaw) {
  if (!thpRaw || thpRaw === '-') return { percent: 10, color: 'from-slate-600 to-slate-400' };
  let thp = String(thpRaw).toUpperCase();
  if (/TOLAK|REJECT|GAGAL/i.test(thp)) return { percent: 100, color: 'from-red-600 to-rose-400' };
  let idx = tahapanMatchIdx(thpRaw);
  let pipe = tahapanPipeline();
  if (idx >= 0) {
    // Langkah terakhir (FLIGHT) = 100%, sisanya proporsional.
    let pct = Math.round(((idx + 1) / pipe.length) * 100);
    if (pct > 96) pct = 100;
    return {
      percent: pct,
      color:
        idx >= pipe.length - 2
          ? 'from-emerald-600 to-teal-400'
          : idx >= 4
            ? 'from-amber-600 to-yellow-400'
            : 'from-sky-600 to-blue-400',
    };
  }
  if (/TTD|KONTRAK|VISA|COE|KTKLN|SISKOP|FLIGHT|BERANGKAT|TERBANG|TIKET|E-ID/i.test(thp))
    return { percent: 100, color: 'from-emerald-600 to-teal-400' };
  if (/NAITEI|APPROVE|LULUS|PEMBERKASAN|MCU|MEDICAL|MEDIKAL|PARPOR|PASPOR/i.test(thp))
    return { percent: 75, color: 'from-amber-600 to-yellow-400' };
  if (/WAWANCARA|INTERVIEW|SELEKSI|MATCH|MENDAN|MENSETSU/i.test(thp))
    return { percent: 50, color: 'from-sky-600 to-blue-400' };
  return { percent: 25, color: 'from-slate-600 to-slate-400' }; // PENDAFTARAN
}

// Posisi tahapan kandidat dalam pipeline. -1 = proses dihentikan (gagal)
// atau status tidak dikenali (menunggu/review admin).
export function tahapanStepIndex(thpRaw) {
  if (!thpRaw || thpRaw === '-') return -1;
  let thp = String(thpRaw).toUpperCase();
  if (/TOLAK|REJECT|GAGAL/i.test(thp)) return -1;
  let idx = tahapanMatchIdx(thpRaw);
  if (idx >= 0) return idx;
  if (/TTD|KONTRAK|VISA|COE|KTKLN|SISKOP|FLIGHT|BERANGKAT|TERBANG|TIKET|E-ID/i.test(thp))
    return tahapanPipeline().length - 1;
  if (/NAITEI|APPROVE|LULUS|PEMBERKASAN|MCU|MEDICAL|MEDIKAL|PARPOR|PASPOR/i.test(thp)) return 4; // MCU PARPOR
  if (/WAWANCARA|INTERVIEW|SELEKSI|MATCH|MENDAN|MENSETSU/i.test(thp)) return 1;
  return -1; // MENUNGGU / REVIEW ADMIN dll → belum masuk pipeline
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file
// (render/admin.js, api/*.js, HTML onclick, dll).
registerSeamAliases({
  tahapanPipeline,
  getTahapanProgress,
  tahapanStepIndex,
});
