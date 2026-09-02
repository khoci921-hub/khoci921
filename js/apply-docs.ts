import { registerSeamAliases } from './core/bridge.ts';
// apply-docs.js — Logika MURNI model dokumen upload di apply-full.html.
//
// Dipisah dari HTML supaya mudah di-unit-test dan mencegah regresi diam-diam:
// dulu kartu upload JFT/SSW TIDAK PERNAH tampil walau loker mewajibkannya
// (logika onload cuma menambah class 'hidden', tidak pernah menghapus).
//
// ESM (Fase 3 langkah 13): modul ES — `applyDocsPlan` di-export + alias
// window.* utk apply_full.js (window.applyDocsPlan) & pemakai classic.
//
// Aturan model dokumen:
//   - req datang dari generateFormBridge (?req=) = dokumen_share loker
//     (mis. 'CV,JFT,SSW' default, atau 'CV,JFT,SSW,SIM A,KTP' custom).
//   - 'ALL' (Semua file folder) = semua chip dokumen wajib upload.
//   - Token dinormalisasi: uppercase, trim, buang duplikat, "SIM A" satu token.
export function applyDocsPlan(reqStr) {
  var arr = String(reqStr || '')
    .split(',')
    .map(function (s) {
      return s.trim().toUpperCase();
    })
    .filter(Boolean);
  // 'ALL' (Semua file folder) di model loker = semua chip dokumen wajib upload.
  if (arr.indexOf('ALL') !== -1) {
    arr = [
      'CV',
      'JFT',
      'SSW',
      'SIM A',
      'KTP',
      'KK',
      'AKTE',
      'IJAZAH',
      'IJAZAH SD',
      'IJAZAH SMP',
      'IJAZAH SMA',
      'UNIVERSITAS',
    ];
  }
  // Buang duplikat (pertahankan urutan pertama).
  var uniq = [];
  arr.forEach(function (d) {
    if (uniq.indexOf(d) === -1) uniq.push(d);
  });
  return {
    showCv: uniq.indexOf('CV') !== -1,
    showJft: uniq.indexOf('JFT') !== -1,
    showSsw: uniq.indexOf('SSW') !== -1,
    // Dokumen lain (SIM A, KTP, dll) dirender sebagai kartu upload ekstra.
    extras: uniq.filter(function (x) {
      return ['CV', 'JFT', 'SSW', 'ALL'].indexOf(x) === -1 && x !== '';
    }),
  };
}

// BRIDGE ESM → classic/bundel: apply_full.js memanggil via window.* (terdaftar di bridge).
registerSeamAliases({ applyDocsPlan });
