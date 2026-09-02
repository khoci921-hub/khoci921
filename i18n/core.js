// i18n/core.js — LOGIKA i18n (Fase 4): CURRENT_LANG, komposisi LANG, tr(),
// trOption(), renderLanguageLight, toggleFormLanguage.
// Data bahasa: id dipanggil static (default ~60KB), jp dipanggil dynamic
// (lazy-load via assets/jp-locale.js ~60KB hanya saat user switch ke JP).
// alias window.* lain ada di i18n.js (agregat) — satu-satunya pengecualian:
// accessor window.CURRENT_LANG DI SINI karena ia harus men-assign binding
// modul CURRENT_LANG.
import { id } from './locales/id/index.js';
export var CURRENT_LANG = localStorage.getItem('asj_lang') || 'id';
// Accessor window.CURRENT_LANG — pemakai luar (01_public.setLanguage,
// pages/share.js) menulis `window.CURRENT_LANG = lang`; accessor men-delegate
// ke binding modul supaya tr()/trOption() tidak pernah basi (Fase 3 langkah
// 12). Ditaruh DI SINI karena hanya binding lokal yang bisa di-assign.
Object.defineProperty(window, 'CURRENT_LANG', {
  configurable: true,
  get: () => CURRENT_LANG,
  set: (v) => {
    CURRENT_LANG = v;
  },
});
// LANG dimulai dengan id saja. JP ditambahkan secara dinamis
// setelah fetch aset jp-locale.js selesai (lihat ensureJpLocale()).
export const LANG = { id };

// Cache data JP setelah pertama kali dimuat (tidak perlu fetch ulang).
let _jpLoaded = false;
let _jpLoading = null;

/**
 * Pastikan data JP locale sudah dimuat. Return true jika sudah siap.
 * Dipanggil oleh toggleFormLanguage() sebelum switch ke JP.
 */
export async function ensureJpLocale() {
  if (_jpLoaded) return true;
  if (_jpLoading) return _jpLoading;
  _jpLoading = (async () => {
    try {
      // Coba fetch aset JP locale dari assets/jp-locale.js.
      // File ini di-generate oleh scripts/build-i18n-jp.mts dan berisi
      // window.__ASJ_JP_LOCALE__ = { ...merged domains... };
      if (!window.__ASJ_JP_LOCALE__) {
        const resp = await fetch('/assets/jp-locale.js', { cache: 'no-cache' });
        if (!resp.ok) throw new Error('Failed to fetch JP locale: ' + resp.status);
        const text = await resp.text();
        // eval() diperlukan karena file berisi window.__ASJ_JP_LOCALE__ = {...}
        // (bukan modul ESM). Aman karena file ini di-generate oleh build script
        // kita sendiri, bukan input user.
        // eslint-disable-next-line no-eval
        (0, eval)(text);
      }
      if (window.__ASJ_JP_LOCALE__) {
        LANG.jp = window.__ASJ_JP_LOCALE__;
        _jpLoaded = true;
        return true;
      }
    } catch (e) {
      console.warn('[i18n] Failed to load JP locale:', e);
    }
    return false;
  })();
  const result = await _jpLoading;
  _jpLoading = null;
  return result;
}
export const OPTION_TRANSLATIONS = {
  // Tahapan pipeline (list_tahapan)
  'CHECK KAIWA': { id: 'CHECK KAIWA', jp: 'チェック会話' },
  MENDAN: { id: 'MENDAN', jp: '面談' },
  MENSETSU: { id: 'MENSETSU', jp: '面接' },
  'LOLOS USER': { id: 'LOLOS USER', jp: 'ユーザー合格' },
  'MCU PARPOR': { id: 'MCU PARPOR', jp: '健康診断' },
  'TTD KONTRAK': { id: 'TTD KONTRAK', jp: '契約署名' },
  'PROSES COE': { id: 'PROSES COE', jp: 'COE申請' },
  VISA: { id: 'VISA', jp: 'ビザ' },
  FLIGHT: { id: 'FLIGHT', jp: 'フライト' },
  LIST: { id: 'LIST', jp: 'リスト' },
  // Status lamaran (list_status_lamaran)
  MENUNGGU: { id: 'MENUNGGU', jp: '待機中' },
  UPDATE: { id: 'UPDATE', jp: '更新済' },
  UMUM: { id: 'UPDATE', jp: '更新済' },
  'REVIEW ADMIN': { id: 'REVIEW ADMIN', jp: '管理者確認中' },
  GAGAL: { id: 'GAGAL', jp: '不合格' },
  LULUS: { id: 'LULUS', jp: '合格' },
  // Status loker (list_status_loker)
  '✅ OPEN': { id: '✅ OPEN', jp: '✅ 募集中' },
  '⚡ URGENT': { id: '⚡ URGENT', jp: '⚡ 急募' },
  '❌ CLOSE': { id: '❌ CLOSE', jp: '❌ 締切' },
  CANCEL: { id: 'CANCEL', jp: 'キャンセル' },
  // Kategori / bidang pekerjaan (list_kategori)
  '🍱 P. MAKANAN': { id: '🍱 P. MAKANAN', jp: '🍱 食品加工' },
  '🌾 PERTANIAN': { id: '🌾 PERTANIAN', jp: '🌾 農業' },
  '🏨 PERHOTELAN': { id: '🏨 PERHOTELAN', jp: '🏨 ホテル' },
  '🏭 MANUFAKTUR': { id: '🏭 MANUFAKTUR', jp: '🏭 製造業' },
  '🐄 PETERNAKAN': { id: '🐄 PETERNAKAN', jp: '🐄 畜産' },
  '👷 KONSTRUKSI': { id: '👷 KONSTRUKSI', jp: '👷 建設' },
  '🧹 B.CLEANING': { id: '🧹 B.CLEANING', jp: '🧹 ビルクリーニング' },
  '🚛 DRIVER': { id: '🚛 DRIVER', jp: '🚛 ドライバー' },
  '👵 KAIGO': { id: '👵 KAIGO', jp: '👵 介護' },
  '🚘 OTOMOTIF': { id: '🚘 OTOMOTIF', jp: '🚘 自動車' },
  '🐟 AKUAKULTUR': { id: '🐟 AKUAKULTUR', jp: '🐟 養殖' },
  '🚢 PEMBUATAN KAPAL': { id: '🚢 PEMBUATAN KAPAL', jp: '🚢 造船' },
  '✈️ PENERBANGAN': { id: '✈️ PENERBANGAN', jp: '✈️ 航空' },
  '🍽️ RESTORAN': { id: '🍽️ RESTORAN', jp: '🍽️ 外食' },
  // Gender (list_gender) — plus varian umum yang sering dipakai di config
  'LAKI-LAKI': { id: 'LAKI-LAKI', jp: '男性' },
  PEREMPUAN: { id: 'PEREMPUAN', jp: '女性' },
  PRIA: { id: 'PRIA', jp: '男性' },
  WANITA: { id: 'WANITA', jp: '女性' },
  'LAKI LAKI': { id: 'LAKI LAKI', jp: '男性' },
  MALE: { id: 'MALE', jp: '男性' },
  FEMALE: { id: 'FEMALE', jp: '女性' },
  // Syarat (list_syarat)
  'JFT A2': { id: 'JFT A2', jp: 'JFT A2' },
  SSW: { id: 'SSW', jp: '特定技能' },
  'EX-JAPAN': { id: 'EX-JAPAN', jp: '日本経験者' },
  'SIM A': { id: 'SIM A', jp: '普通免許A' },
  'SIM BI': { id: 'SIM BI', jp: '普通免許BI' },
  'SIM BII': { id: 'SIM BII', jp: '普通免許BII' },
  // Status form inbox (status_form)
  'DIBACA ERP': { id: 'DIBACA ERP', jp: 'ERP閲覧済' },
  APPROVED: { id: 'APPROVED', jp: '承認済' },
  REJECTED: { id: 'REJECTED', jp: '却下' },
  SYNCED: { id: 'SYNCED', jp: '同期済' },
  ARCHIVE: { id: 'ARCHIVE', jp: 'アーカイブ' },
  // Lokasi (list_lokasi) — area + prefektur umum
  '🗾 Seluruh Jepang': { id: '🗾 Seluruh Jepang', jp: '🗾 日本全国' },
  '❄️ Hokkaido Area': { id: '❄️ Hokkaido Area', jp: '❄️ 北海道エリア' },
  '🍎 Tohoku Area': { id: '🍎 Tohoku Area', jp: '🍎 東北エリア' },
  '🗼 Kanto Area': { id: '🗼 Kanto Area', jp: '🗼 関東エリア' },
  '🗻 Chubu Area': { id: '🗻 Chubu Area', jp: '🗻 中部エリア' },
  '🏯 Kansai Area': { id: '🏯 Kansai Area', jp: '🏯 関西エリア' },
  '⛩️ Chugoku Area': { id: '⛩️ Chugoku Area', jp: '⛩️ 中国エリア' },
  '🍜 Shikoku Area': { id: '🍜 Shikoku Area', jp: '🍜 四国エリア' },
  '🌋 Kyushu Area': { id: '🌋 Kyushu Area', jp: '🌋 九州エリア' },
  '🌺 Okinawa Area': { id: '🌺 Okinawa Area', jp: '🌺 沖縄エリア' },
  '❄️ Hokkaido': { id: '❄️ Hokkaido', jp: '❄️ 北海道' },
  '🍎 Aomori': { id: '🍎 Aomori', jp: '🍎 青森' },
  '🍜 Iwate': { id: '🍜 Iwate', jp: '🍜 岩手' },
  '🎋 Miyagi': { id: '🎋 Miyagi', jp: '🎋 宮城' },
  '👹 Akita': { id: '👹 Akita', jp: '👹 秋田' },
  '🍒 Yamagata': { id: '🍒 Yamagata', jp: '🍒 山形' },
  '🍑 Fukushima': { id: '🍑 Fukushima', jp: '🍑 福島' },
  '🌾 Ibaraki': { id: '🌾 Ibaraki', jp: '🌾 茨城' },
  '🍓 Tochigi': { id: '🍓 Tochigi', jp: '🍓 栃木' },
  '♨️ Gunma': { id: '♨️ Gunma', jp: '♨️ 群馬' },
  '🍘 Saitama': { id: '🍘 Saitama', jp: '🍘 埼玉' },
  '🥜 Chiba': { id: '🥜 Chiba', jp: '🥜 千葉' },
  '🗼 Tokyo': { id: '🗼 Tokyo', jp: '🗼 東京' },
  '🚢 Kanagawa': { id: '🚢 Kanagawa', jp: '🚢 神奈川' },
  '🍚 Niigata': { id: '🍚 Niigata', jp: '🍚 新潟' },
  '🦑 Toyama': { id: '🦑 Toyama', jp: '🦑 富山' },
  '🦀 Ishikawa': { id: '🦀 Ishikawa', jp: '🦀 石川' },
  '🦖 Fukui': { id: '🦖 Fukui', jp: '🦖 福井' },
  '🍇 Yamanashi': { id: '🍇 Yamanashi', jp: '🍇 山梨' },
  '🏔️ Nagano': { id: '🏔️ Nagano', jp: '🏔️ 長野' },
  '🏘️ Gifu': { id: '🏘️ Gifu', jp: '🏘️ 岐阜' },
  '🍵 Shizuoka': { id: '🍵 Shizuoka', jp: '🍵 静岡' },
  '🏙️ Aichi': { id: '🏙️ Aichi', jp: '🏙️ 愛知' },
  '🦞 Mie': { id: '🦞 Mie', jp: '🦞 三重' },
  '🌊 Shiga': { id: '🌊 Shiga', jp: '🌊 滋賀' },
  '⛩️ Kyoto': { id: '⛩️ Kyoto', jp: '⛩️ 京都' },
  '🌆 Osaka': { id: '🌆 Osaka', jp: '🌆 大阪' },
  '🥩 Hyogo': { id: '🥩 Hyogo', jp: '🥩 兵庫' },
  '🦌 Nara': { id: '🦌 Nara', jp: '🦌 奈良' },
  '🍊 Wakayama': { id: '🍊 Wakayama', jp: '🍊 和歌山' },
  '🐪 Tottori': { id: '🐪 Tottori', jp: '🐪 鳥取' },
  '⛩️ Shimane': { id: '⛩️ Shimane', jp: '⛩️ 島根' },
  '🍑 Okayama': { id: '🍑 Okayama', jp: '🍑 岡山' },
  '🍁 Hiroshima': { id: '🍁 Hiroshima', jp: '🍁 広島' },
  '🐡 Yamaguchi': { id: '🐡 Yamaguchi', jp: '🐡 山口' },
  '💃 Tokushima': { id: '💃 Tokushima', jp: '💃 徳島' },
  '🍜 Kagawa': { id: '🍜 Kagawa', jp: '🍜 香川' },
  '🍊 Ehime': { id: '🍊 Ehime', jp: '🍊 愛媛' },
  '🐟 Kochi': { id: '🐟 Kochi', jp: '🐟 高知' },
  '🍜 Fukuoka': { id: '🍜 Fukuoka', jp: '🍜 福岡' },
  '🏺 Saga': { id: '🏺 Saga', jp: '🏺 佐賀' },
  '⛪ Nagasaki': { id: '⛪ Nagasaki', jp: '⛪ 長崎' },
  '🌿 Kumamoto': { id: '🌿 Kumamoto', jp: '🌿 熊本' },
  '♨️ Oita': { id: '♨️ Oita', jp: '♨️ 大分' },
  '🥭 Miyazaki': { id: '🥭 Miyazaki', jp: '🥭 宮崎' },
  '🌋 Kagoshima': { id: '🌋 Kagoshima', jp: '🌋 鹿児島' },
  '🌺 Okinawa': { id: '🌺 Okinawa', jp: '🌺 沖縄' },
};
export function trOption(value) {
  if (value === null || value === undefined) return '';
  var s = String(value);
  var bar = s.indexOf('|');
  if (bar > -1) {
    var id = s.slice(0, bar).trim();
    var jp = s.slice(bar + 1).trim();
    return CURRENT_LANG === 'jp' && jp ? jp : id || s;
  }
  var t = OPTION_TRANSLATIONS[s.trim()];
  if (!t) {
    // Toleran: nilai config sering beda format (huruf besar/kecil, emoji
    // prefix seperti "👨 Pria", spasi ganda) — coba beberapa varian supaya
    // dropdown kota/gender tetap dapat versi JP.
    var upper = s.trim().toUpperCase();
    t = OPTION_TRANSLATIONS[upper];
    if (!t) {
      // Buang karakter non-huruf/angka di awal (emoji, spasi, dsb).
      var stripped = s
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .trim()
        .toUpperCase();
      if (stripped && stripped !== upper) t = OPTION_TRANSLATIONS[stripped];
    }
  }
  if (t) return CURRENT_LANG === 'jp' ? t.jp : t.id;
  return s;
}
// Bagian ID dari nilai (untuk simpan/banding): "ID|JP" -> ID; lainnya -> asli.
export function trOptionId(value) {
  if (value === null || value === undefined) return '';
  var s = String(value);
  var bar = s.indexOf('|');
  return bar > -1 ? s.slice(0, bar).trim() : s.trim();
}

export function tr(path) {
  try {
    let obj = LANG[CURRENT_LANG];
    for (const p of String(path).split('.')) {
      obj = obj[p];
      if (obj === undefined) return path;
    }
    return obj;
  } catch (e) {
    return path;
  }
}

// Render data-lang / data-lang-placeholder / data-lang-title untuk halaman
// mandiri (tanpa header lang-current & tanpa re-render tabel admin).
export function renderLanguageLight() {
  document.querySelectorAll('[data-lang]').forEach((el) => {
    const key = el.dataset.lang;
    const text = tr(key);
    if (text !== key) {
      // Pertahankan penanda versi (asj-ver-badge) yang ditempel pwa.js ke
      // [data-lang="footer.copyright"] — innerHTML pengganti bahasa akan
      // menghapusnya (chip versi hilang dari footer, 2026-08-18).
      const badge = el.querySelector('.asj-ver-badge');
      el.innerHTML = text;
      if (badge) el.appendChild(badge);
    }
  });
  document.querySelectorAll('[data-lang-placeholder]').forEach((el) => {
    const key = el.dataset.langPlaceholder;
    const text = tr(key);
    if (text !== key) el.placeholder = text;
  });
  document.querySelectorAll('[data-lang-title]').forEach((el) => {
    const key = el.dataset.langTitle;
    const text = tr(key);
    if (text !== key) el.title = text;
  });
  document.querySelectorAll('[data-lang-aria]').forEach((el) => {
    const key = el.dataset.langAria;
    const text = tr(key);
    if (text !== key) el.setAttribute('aria-label', text);
  });
}

// Tombol ganti bahasa untuk halaman mandiri (ID ↔ JP).
// Async karena JP locale perlu di-load saat pertama kali switch.
export async function toggleFormLanguage() {
  const nextLang = CURRENT_LANG === 'id' ? 'jp' : 'id';

  // Jika switch ke JP, pastikan data sudah dimuat dulu.
  if (nextLang === 'jp') {
    await ensureJpLocale();
  }

  CURRENT_LANG = nextLang;
  window.CURRENT_LANG = CURRENT_LANG;
  try {
    localStorage.setItem('asj_lang', CURRENT_LANG);
  } catch (e) {}
  if (typeof renderLanguageLight === 'function') renderLanguageLight();
  if (typeof window.renderLanguage === 'function') window.renderLanguage();
  if (typeof window.renderSysConfig === 'function' && document.getElementById('config-container'))
    window.renderSysConfig();
  if (typeof window.rePopulateDropdowns === 'function') window.rePopulateDropdowns();
}

// Preload JP locale saat IDLE jika user pernah pakai JP sebelumnya.
// Tidak ganggu first-paint karena pakai requestIdleCallback.
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => {
    if (localStorage.getItem('asj_lang') === 'jp') {
      ensureJpLocale();
    }
  });
} else if (localStorage.getItem('asj_lang') === 'jp') {
  // Fallback untuk browser tanpa requestIdleCallback
  setTimeout(() => ensureJpLocale(), 2000);
}
