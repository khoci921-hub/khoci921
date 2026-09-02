// ==========================================
// HELPERS CV RIREKISHO (pure logic — tanpa DOM)
// ==========================================
// Dipisah dari renderCVAjaib (10_cv_rirekisho.js) supaya bisa di-unit-test
// tanpa jsdom/global.
//
// ESM (Fase 3 langkah 12): export murni untuk vitest. Pemakai classic/bundel
// (10b_cv_builders.js & 10_cv_rirekisho.js memanggil via window.*) — alias
// window.*-nya diregistrasikan TERPUSAT lewat registerSeamAliases di
// js/main.js (Fase 3.5 Langkah 6), bukan per-simbol di file ini, supaya
// modul tetap murni (unit-test node tanpa window).

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o || {})[k], obj);
}

export function isGood(val) {
  return (
    val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-'
  );
}

// Pencari data dengan prioritas: (a) objek utama d (nested + flat), (b) ai
// (AIDATAJSON), lalu '-'. Dibuat lewat factory supaya test bisa injeksi d & ai.
export function makeV(d, ai) {
  ai = ai || {};
  const getAi = (path) => {
    let val = getPath(ai, path);
    return val && String(val).trim() !== '' ? String(val).trim() : null;
  };
  return function v(...keys) {
    for (let k of keys) {
      if (k.includes('.')) {
        let val = getPath(d, k);
        if (isGood(val)) return String(val).trim();
        let aiVal = getAi(k);
        if (aiVal) return aiVal;
      } else {
        // coba langsung (lowercase di d), lalu uppercase, lalu ai
        if (d[k] !== undefined && isGood(d[k])) return String(d[k]).trim();
        let cleanKey = String(k)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');
        if (d[cleanKey] !== undefined && isGood(d[cleanKey])) return String(d[cleanKey]).trim();
        let aiVal = getAi(k);
        if (aiVal) return aiVal;
      }
    }
    return '-';
  };
}

// Normalisasi sumber array riwayat: boleh array langsung atau string JSON
// (AIDATAJSON). Bukan array → [] (aman untuk null/undefined/'-'/objek).
export function asArr(src) {
  if (Array.isArray(src)) return src;
  if (typeof src === 'string' && src.trim() && src !== '-') {
    try {
      const p = JSON.parse(src);
      return Array.isArray(p) ? p : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Gabungkan dua sumber array riwayat (kolom master + isi CV AI) jadi union
// dengan dedupe per kunci — SATU sumber tidak boleh menutupi yang lain.
// Kolom master sering hanya menyimpan baris pertama (mis. keluarga_1)
// padahal isi CV AI punya 3-4 anggota → tanpa merge preview CV tampak
// "dikit". Algoritma disamakan dengan mergeRiwayatArrays backend
// (netlify/functions/_lib/actions-extra.js). keyOf menentukan kunci dedupe
// per tipe (pendidikan/pekerjaan/keluarga); entri tanpa kunci valid dibuang.
export function mergeArrRiwayat(srcA, srcB, keyOf) {
  const seen = new Set();
  const out = [];
  const lists = [].concat(asArr(srcA), asArr(srcB));
  for (const e of lists) {
    if (!e || typeof e !== 'object') continue;
    const k = keyOf ? keyOf(e) : JSON.stringify(e);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

// Format Tahun & Bulan ala Jepang (2012年7月)
// Regex dulu supaya akurat (tanpa pergeseran timezone):
//   "2012"               -> 2012年
//   "2012-07"/"2012/7"   -> 2012年7月
//   "2001-06-30T17:00:00.000Z" -> 2001年6月
export function fmtMonthYearJp(str) {
  if (!str || str === '-') return '';
  let s = String(str).trim();
  if (/^\d{4}$/.test(s)) return s + '年';
  let m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) return m[1] + '年' + parseInt(m[2], 10) + '月';
  let dt = new Date(s);
  // @ts-expect-error JS→TS migration
  if (isNaN(dt)) return s;
  return dt.getFullYear() + '年' + (dt.getMonth() + 1) + '月';
}

export const helpers_cv = { getPath, isGood, makeV, fmtMonthYearJp, asArr, mergeArrRiwayat };

// BRIDGE ESM → classic (bundel): alias window.* (getPath/isGood/makeV/
// fmtMonthYearJp/mergeArrRiwayat) diregistrasikan dari js/main.js via
// registerSeamAliases (Fase 3.5 Langkah 6) — file ini tetap murni.
