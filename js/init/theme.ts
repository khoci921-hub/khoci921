import { ASSETS, CURRENT_THEME } from './state.ts';
import { renderPublicFilterUI, renderPublicFiltered } from '../render/public.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// ==========================================
// TEMA — konfigurasi theme (TOKYO/SAKURA/INTER_VIP), partikel sakura,
// banner/footer default, dan aplikasi theme ke halaman
// ==========================================

// Hanya 2 theme publik: DARK (Tokyo) & LIGHT (Sakura). INTER_VIP khusus
// admin KHOCI (easter egg internal), tidak muncul sebagai tombol.
// Sakura = gradien pink REDUP (kustom muted, bukan rose-100 yang pekat)
// supaya tidak menyilaukan dan teks tetap kontras.
export var THEMES = {
  SAKURA: {
    bg: 'bg-gradient-to-b from-[#bda8ae] via-[#cbb4bb] to-[#cbb4bb] text-stone-900',
    border: 'border-rose-400/60',
    head: 'bg-pink-800 text-white',
  },
  TOKYO: {
    bg: 'bg-slate-950 text-slate-100',
    border: 'border-slate-800',
    head: 'bg-slate-800 text-slate-200',
  },
  INTER_VIP: {
    bg: 'bg-slate-950 text-blue-50',
    border: 'border-blue-700',
    head: 'bg-blue-900 text-yellow-400',
  },
};

// Aset banner/footer DEFAULT (host Supabase Storage) — dipakai saat backend
// belum kirim ASSETS (mis. data gagal dimuat / preview tanpa backend), supaya
// banner & footer SELALU tampil dan tidak menunggu data.
export var DEFAULT_ASSETS = {
  BANNER: {
    TOKYO:
      'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/tokyo_banner.jpg',
    SAKURA:
      'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/sakra_banner.webp',
  },
  FOOTER: {
    TOKYO:
      'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/tokyo_footer.jpg',
    SAKURA:
      'https://gdwvffmevwtwnzrapjwy.supabase.co/storage/v1/object/public/asj-files/assets/sakura_footer.webp',
  },
};

// SATU tombol theme: menampilkan theme aktif (Dark/Light), ditekan = ganti
// otomatis ke theme lainnya. Gaya pill mirip tombol ID-JP.
export function renderThemeToggle() {
  var btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  var light = CURRENT_THEME === 'SAKURA';
  btn.className =
    'px-3 py-2 rounded-full text-[10px] font-bold transition-colors shadow-lg flex items-center gap-1.5 border ' +
    (light
      ? 'bg-slate-100 text-stone-900 border-stone-300 shadow-xl scale-105'
      : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/25 hover:border-white/40');
  btn.innerHTML = light
    ? '<i class="fas fa-sun"></i> <span>Light</span>'
    : '<i class="fas fa-moon"></i> <span>Dark</span>';
  btn.title = light ? 'Ganti ke tema Dark (Tokyo)' : 'Ganti ke tema Light (Sakura)';
  // Label "Tema" di bar kontrol ikut menyesuaikan warna (terang/gelap).
  // Di light pakai stone-600 (lebih gelap) supaya kontras cukup di bar putih.
  var lab = document.getElementById('ctrl-label-tema');
  if (lab)
    lab.className =
      'text-[10px] font-bold mr-1 uppercase tracking-widest ' +
      (light ? 'text-stone-600' : 'text-slate-400');
}

// Tekan 1 tombol = ganti theme (Dark ↔ Light), pilihan disimpan di
// localStorage supaya diingat saat pengunjung buka halaman lagi.
export function toggleTheme() {
  applyTheme(CURRENT_THEME === 'TOKYO' ? 'SAKURA' : 'TOKYO');
}

// ========== THEME PER USER ==========
// Pilihan theme disimpan PER IDENTITAS, bukan satu key global — admin,
// kandidat, dan pengunjung punya theme sendiri-sendiri:
//   - admin login   → 'asj_theme_admin'
//   - kandidat login → 'asj_theme_<wa>'
//   - selainnya     → 'asj_theme' (pengunjung/guest)
export function getThemeKey() {
  try {
    if (localStorage.getItem('asj_admin_login') === 'sukses') return 'asj_theme_admin';
    var wa = localStorage.getItem('asj_kandidat_wa');
    if (localStorage.getItem('asj_kandidat_login') === 'sukses' && wa) {
      return 'asj_theme_' + wa;
    }
  } catch (e) {
    /* localStorage tidak tersedia */
  }
  return 'asj_theme';
}

// Baca theme tersimpan untuk identitas aktif. Migrasi sekali: kalau key
// per-user belum ada (pertama kali login setelah fitur ini), pakai nilai
// key global lama supaya pilihan yang sudah ada tidak hilang.
export function getSavedTheme() {
  try {
    var key = getThemeKey();
    var v = localStorage.getItem(key);
    if (v) return v;
    if (key !== 'asj_theme') return localStorage.getItem('asj_theme');
  } catch (e) {
    /* localStorage tidak tersedia */
  }
  return null;
}

// ========== PARTIKEL SAKURA (hanya theme Light) ==========
// Kelopak sakura berjatuhan halus: kecil, tembus pandang, dan
// pointer-events-none sehingga tidak mengganggu baca maupun klik.
// Tiga lapisan biar hidup: jauh (kecil + blur, pelan), normal, dan hero
// (besar, lebih pekat, cepat) — plus dua jalur jatuh yang berbeda.
var SAKURA_PETALS_CREATED = false;
export function buatPartikelSakura() {
  var box = document.getElementById('sakura-particles');
  if (!box || SAKURA_PETALS_CREATED) return;
  SAKURA_PETALS_CREATED = true;
  var N = 30; // lebih banyak: 30 kelopak (dari 16)
  for (var i = 0; i < N; i++) {
    var p = document.createElement('div');
    p.className = 'sakura-petal';
    var isHero = i % 9 === 0; // setiap ke-9 = hero (besar, jelas, cepat)
    var isFar = i % 7 === 0; // setiap ke-7 = lapisan jauh (kecil + blur)
    var size = isFar
      ? 5 + Math.random() * 4 // 5-9px
      : isHero
        ? 16 + Math.random() * 8 // 16-24px
        : 8 + Math.random() * 9; // 8-17px
    p.style.width = size + 'px';
    p.style.height = size * (0.8 + Math.random() * 0.3) + 'px'; // rasio bervariasi
    p.style.left = Math.random() * 100 + '%';
    p.style.opacity = (isHero ? 0.5 + Math.random() * 0.25 : 0.15 + Math.random() * 0.35).toFixed(
      2,
    );
    p.style.animationDuration = (isHero ? 7 + Math.random() * 5 : 6 + Math.random() * 13) + 's';
    // Delay negatif: kelopak sudah "di tengah jalan" sejak halaman dibuka
    p.style.animationDelay = -Math.random() * 24 + 's';
    // Variasi jalur jatuh: sakuraFall (standar) / sakuraFall2 (ayunan lebar)
    p.style.animationName = Math.random() < 0.45 ? 'sakuraFall2' : 'sakuraFall';
    p.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
    // Lapisan jauh sedikit blur (efek kedalaman), memperkuat ilusi 3D
    if (isFar) p.style.filter = 'blur(' + (0.4 + Math.random() * 0.8).toFixed(1) + 'px)';
    box.appendChild(p);
  }
}
export function setSakuraParticles(visible) {
  var box = document.getElementById('sakura-particles');
  if (!box) return;
  if (visible) {
    buatPartikelSakura();
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
}

export function applyInterMilanVibe() {
  applyTheme('INTER_VIP');
  var bannerInter = 'https://i.imgflip.com/53px0j.gif';
  var footerInter = 'https://i.imgflip.com/53px0j.gif';
  window.setBg('asj-header', bannerInter);
  window.setBg('asj-footer', footerInter);
}

export function applyTheme(theme) {
  window.CURRENT_THEME = theme;
  var cfg = THEMES[theme];
  if (!cfg) return;
  var light = theme === 'SAKURA';
  var bodyEl = document.getElementById('asj-body');
  if (bodyEl)
    bodyEl.className =
      'min-h-screen flow-root transition-colors duration-300 ' +
      cfg.bg +
      (light ? ' theme-light' : ' theme-dark');
  var wrap = document.getElementById('public-table-wrap');
  // Theme Light (SAKURA): kartu tabel jadi TERANG (putih) — baris tabel
  // ikut dirender terang oleh window.renderPublicFiltered (teks gelap, badge terang).
  if (wrap)
    wrap.className =
      'overflow-x-auto rounded-xl border shadow-xl transition-colors ' +
      (light ? 'bg-white border-rose-300/60 shadow-rose-200/30' : cfg.border);
  var head = document.getElementById('public-table-head');
  if (head)
    head.className =
      'text-xs uppercase tracking-wider font-bold border-b transition-colors ' +
      cfg.head +
      ' ' +
      cfg.border;
  // Pemisah baris tabel ikut terang di SAKURA (bukan divide-white).
  var tbody = document.getElementById('public-table-body');
  if (tbody)
    tbody.className =
      'divide-y transition-colors duration-300 ' + (light ? 'divide-rose-100' : 'divide-white/5');
  // Bar kontrol Tema & Filter menyesuaikan terang/gelap (Sakura = light).
  var bar = document.getElementById('public-ctrl-bar');
  if (bar) {
    bar.className =
      'flex flex-wrap justify-between items-center p-4 rounded-xl border shadow-lg mb-6 gap-4 transition-colors ' +
      (light ? 'bg-white border-rose-200/80' : 'bg-slate-900 border-slate-700/60');
    bar.querySelectorAll('span.text-slate-400').forEach(function (s) {
      s.className = s.className.replace(
        'text-slate-400',
        light ? 'text-stone-600' : 'text-slate-400',
      );
    });
  }
  // Tab navigasi Loker/Layanan (pill) ikut theme: solid, tanpa blur.
  var tabWrap = document.getElementById('tab-pub-wrap');
  if (tabWrap)
    tabWrap.className =
      'inline-flex rounded-full p-1 shadow-2xl border transition-colors ' +
      (light ? 'bg-white border-rose-200' : 'bg-slate-900 border-slate-700');
  // Overlay gelap di header & footer: di theme light tetap cukup pekat di
  // bagian bawah (tempat teks putih) supaya TERBACA, tapi bagian atas
  // dibiarkan lebih terang agar gambar sakura terlihat.
  var overlay = document.getElementById('asj-header-overlay');
  // SAKURA: header jadi banner gelap sedang (scrim 60%) supaya tagline,
  // judul putih, dan tombol putih tetap TERBACA di atas gambar sakura
  // yang terang — gambar sakura masih samar terlihat di balik scrim.
  if (overlay)
    overlay.className =
      'absolute inset-0 transition-colors duration-700 ' +
      (light
        ? 'bg-gradient-to-t from-black/90 via-black/60 to-black/60'
        : 'bg-gradient-to-t from-black/95 via-black/40 to-transparent');
  // Tagline header: putih di SAKURA (pink-300 tak bisa 4.5:1 di atas
  // gambar terang walau di-scrim), pink tetap di TOKYO (gelap).
  var tagline = document.getElementById('header-tagline');
  if (tagline)
    tagline.className =
      'text-xs md:text-sm font-bold tracking-[4px] mb-1 ' +
      (light ? 'text-white' : 'text-pink-300');
  var fOverlay = document.getElementById('asj-footer-overlay');
  if (fOverlay)
    fOverlay.className =
      'absolute inset-0 transition-colors duration-700 ' + (light ? 'bg-black/70' : 'bg-black/85');
  // Animasi transisi ganti theme: fade singkat konten publik supaya
  // pergantian terasa halus, tidak melompat.
  var pub = document.getElementById('page-public');
  if (pub && !pub.classList.contains('hidden')) {
    pub.classList.remove('animate-fade-in');
    void pub.offsetWidth; // paksa reflow agar animasi jalan lagi
    pub.classList.add('animate-fade-in');
  }
  // Partikel sakura hanya tampil di theme Light (Sakura).
  setSakuraParticles(theme === 'SAKURA');
  // Banner & Footer: pakai aset backend kalau tersedia, fallback ke default
  // supaya selalu tampil & sinkron dengan theme walau backend gagal/lambat.
  window.setBg(
    'asj-header',
    (ASSETS.BANNER && ASSETS.BANNER[theme]) || DEFAULT_ASSETS.BANNER[theme],
  );
  window.setBg(
    'asj-footer',
    (ASSETS.FOOTER && ASSETS.FOOTER[theme]) || DEFAULT_ASSETS.FOOTER[theme],
  );
  // Simpan pilihan theme — per identitas aktif (admin/kandidat/guest),
  // lihat getThemeKey di atas.
  try {
    localStorage.setItem(getThemeKey(), theme);
  } catch (e) {}
  renderThemeToggle();
  if (typeof renderPublicFilterUI === 'function') renderPublicFilterUI();
  if (typeof renderPublicFiltered === 'function') renderPublicFiltered();
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (index/admin toggleTheme, engine/init.js
// window.applyTheme & window.applyInterMilanVibe, 04_auth.js
// window.applyInterMilanVibe). THEMES = data eksplisit (objek konfigurasi,
// tidak pernah di-reassign) → allowNonFunction.
registerSeamAliases(
  {
    toggleTheme,
    applyInterMilanVibe,
    applyTheme,
    getThemeKey,
    getSavedTheme,
    THEMES,
  },
  { allowNonFunction: true, source: 'js/init/theme.js' },
);
