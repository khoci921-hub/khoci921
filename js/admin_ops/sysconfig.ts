import { DROPDOWNS, currentAdminName } from '../init/state.ts';
import { registerSeamAliases } from '../core/bridge.ts';
// js/admin_ops/{schedule,candidates,sysconfig,loading,migration,drive}.js.
// ==========================================
// SYS CONFIG — pengaturan dropdown/pipeline dari web + simpan pengumuman
// ==========================================

// === LOGIKA PENGATURAN SYS CONFIG ===

// Konfigurasi kategori apa saja yang boleh diedit dari web — dipisah rapi:
// tahapan pipeline kandidat, status lamaran, status loker publik, dll.
export const CONFIG_CATEGORIES = [
  {
    key: 'tahapan',
    label: 'Tahapan Seleksi (Pipeline)',
    color: 'purple',
    hint: 'Urutan: CHECK KAIWA → MENDAN → MENSETSU → LOLOS USER → MCU PARPOR → TTD KONTRAK → PROSES COE → VISA → FLIGHT',
    order: 1,
  },
  {
    key: 'statusLamaran',
    label: 'Status Lamaran',
    color: 'emerald',
    hint: 'MENUNGGU, REVIEW ADMIN, GAGAL, LULUS',
    order: 2,
  },
  {
    key: 'statusLoker',
    label: 'Status Loker Publik',
    color: 'red',
    hint: 'OPEN, URGENT, CLOSE',
    order: 3,
  },
  { key: 'kategori', label: 'Kategori / Bidang Pekerjaan', color: 'sky', hint: '', order: 4 },
  { key: 'lokasi', label: 'Lokasi Penempatan', color: 'emerald', hint: '', order: 5 },
  { key: 'syarat', label: 'Syarat & Ketentuan Kandidat', color: 'amber', hint: '', order: 6 },
  { key: 'tsk', label: 'Daftar Pengurus (TSK)', color: 'rose', hint: '', order: 7 },
].sort(function (a, b) {
  return a.order - b.order;
});

export function renderSysConfig() {
  var container = document.getElementById('config-container');
  if (!container) return;
  var html = '';

  CONFIG_CATEGORIES.forEach((cat) => {
    let items = DROPDOWNS[cat.key] || [];
    let chipHtml = '';

    if (items.length === 0) {
      chipHtml = '<span class="text-[10px] text-slate-500 italic">Belum ada data.</span>';
    } else {
      // Tahapan pipeline ditampilkan BERNOMOR (1, 2, 3...) supaya urutan
      // progres kandidat terlihat jelas di pengaturan. Label tampil sesuai
      // bahasa terpilih (trOption); nilai asli tetap disimpan/dibandingkan.
      items.forEach((item, index) => {
        let num =
          cat.key === 'tahapan'
            ? '<span class="mr-1 text-slate-500 font-black">' + (index + 1) + '.</span>'
            : '';
        chipHtml += `<span class="inline-flex items-center px-3 py-1 bg-${cat.color}-900/30 text-${cat.color}-300 border border-${cat.color}-500/30 rounded-full text-[10px] font-bold shadow-sm whitespace-nowrap">
                        ${num}${window.esc(window.trOption(item))}
                        <button onclick="pindahConfigItem('${cat.key}', ${index}, -1)" aria-label="${window.tr('ui.move_up')}" title="${window.tr('ui.move_up')}" class="ml-1.5 w-4 h-4 inline-flex items-center justify-center rounded-full bg-black/40 border border-${cat.color}-500/30 text-${cat.color}-300 ${index === 0 ? 'opacity-30 pointer-events-none' : `hover:bg-${cat.color}-600 hover:text-white`} transition-colors"><i class="fas fa-chevron-up" style="font-size: 7px;"></i></button>
                        <button onclick="pindahConfigItem('${cat.key}', ${index}, 1)" aria-label="${window.tr('ui.move_down')}" title="${window.tr('ui.move_down')}" class="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full bg-black/40 border border-${cat.color}-500/30 text-${cat.color}-300 ${index === items.length - 1 ? 'opacity-30 pointer-events-none' : `hover:bg-${cat.color}-600 hover:text-white`} transition-colors"><i class="fas fa-chevron-down" style="font-size: 7px;"></i></button>
                        <button onclick="hapusConfigItem('${cat.key}', ${index})" aria-label="${window.tr('table.delete')}" title="${window.tr('table.delete')}" class="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full bg-black/40 border border-${cat.color}-500/50 text-${cat.color}-300 hover:bg-rose-600 hover:text-white hover:border-rose-500 transition-colors"><i class="fas fa-times" style="font-size: 8px;"></i></button>
                    </span>`;
      });
    }

    html += `
            <div class="bg-black/40 border border-slate-700 p-4 rounded-xl flex flex-col h-full shadow-inner">
                <h3 class="text-xs font-bold text-${cat.color}-400 mb-1 uppercase tracking-wider"><i class="fas fa-cube mr-1"></i> ${cat.label}</h3>
                ${cat.hint ? '<p class="text-[9px] text-slate-500 mb-3 leading-relaxed">' + cat.hint + '</p>' : '<div class="mb-3"></div>'}
                <div class="flex flex-wrap gap-2 mb-4 flex-1 items-start content-start">
                    ${chipHtml}
                </div>
                <div class="flex gap-2 mt-auto">
                    <input type="text" id="input-cfg-${cat.key}" placeholder="${window.tr('ui.add_new')}${window.CURRENT_LANG === 'jp' ? '（ID|日本語）' : ' (ID|JP)'}" class="flex-1 bg-slate-800 border border-slate-600 rounded text-xs px-3 py-1.5 text-white outline-none focus:border-${cat.color}-500">
                    <button onclick="tambahConfigItem('${cat.key}')" aria-label="${window.tr('button.add')}" class="bg-${cat.color}-600 hover:bg-${cat.color}-500 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-md"><i class="fas fa-plus"></i></button>
                </div>
            </div>`;
  });
  container.innerHTML = html;
}

export function tambahConfigItem(key) {
  let input = document.getElementById('input-cfg-' + key);
  if (!input) return;
  let val = input.value.trim();
  if (!val) return;

  if (!DROPDOWNS[key]) DROPDOWNS[key] = [];
  // Cek duplikat berdasarkan ID (bagian sebelum '|') — jadi "CHECK KAIWA"
  // dan "CHECK KAIWA|チェック会話" dianggap sama (tidak dobel).
  let valId = window.trOptionId(val);
  let ada = DROPDOWNS[key].some(function (ex) {
    return window.trOptionId(ex) === valId;
  });
  if (ada) {
    window.showToast(window.tr('ui.toast_item_exists'), 'error');
    return;
  }

  DROPDOWNS[key].push(val);
  input.value = '';
  renderSysConfig(); // Render lokal dulu agar UI cepat berubah
  simpanConfigKeServer(key, DROPDOWNS[key]);
}

export function hapusConfigItem(key, index) {
  if (!confirm(window.tr('form.txt_hapus_confirm'))) return;
  DROPDOWNS[key].splice(index, 1);
  renderSysConfig(); // Render lokal
  simpanConfigKeServer(key, DROPDOWNS[key]);
}

// Pindahkan posisi chip (urutan dropdown penting, mis. pipeline tahapan
// yang bernomor). -1 = naik, +1 = turun; simpan langsung ke server.
export function pindahConfigItem(key, index, delta) {
  var arr = DROPDOWNS[key];
  if (!Array.isArray(arr) || arr.length < 2) return;
  var target = index + delta;
  if (target < 0 || target >= arr.length) return;
  var tmp = arr[index];
  arr[index] = arr[target];
  arr[target] = tmp;
  renderSysConfig(); // Render lokal
  simpanConfigKeServer(key, DROPDOWNS[key]);
}

export async function simpanConfigKeServer(key, arrayData) {
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = 'flex';

  try {
    const res = await window.callAPI('updateSysConfig', [key, arrayData, currentAdminName]);
    if (!res.success)
      window.showToast(window.tr('ui.toast_save_server_failed') + res.error, 'error');
  } catch (err) {
    window.showToast(window.tr('ui.toast_network_error'), 'error');
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// === FUNGSI SIMPAN PENGUMUMAN BERJALAN ===
export async function simpanPengumuman() {
  let teks = document.getElementById('input-pengumuman').value;
  let btn = document.querySelector('button[data-action="simpanPengumuman"]');
  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> ' + window.tr('ui.saving') + '';
    btn.disabled = true;
  }

  try {
    const res = await window.callAPI('updateSysConfig', ['pengumuman', [teks], currentAdminName]);
    if (res.success) {
      window.showToast(window.tr('ui.toast_marquee_updated'), 'success');
      // Update langsung di layar Admin
      if (teks.trim()) {
        document.getElementById('marquee-text').innerText = teks;
        document.getElementById('global-announcement').classList.remove('hidden');
      } else {
        document.getElementById('global-announcement').classList.add('hidden');
      }
    } else {
      window.showToast(window.tr('ui.toast_failed_prefix') + res.error, 'error');
    }
  } catch (err) {
    window.showToast(window.tr('ui.toast_network_error'), 'error');
  } finally {
    if (btn) {
      btn.innerHTML = '<i class="fas fa-save mr-1"></i> ' + window.tr('ui.save_publish') + '';
      btn.disabled = false;
    }
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (render/admin.js & i18n.js window.renderSysConfig,
// 01_public.js renderSysConfig, admin/index simpanPengumuman, tombol chip
// tambahConfigItem/hapusConfigItem/pindahConfigItem).
registerSeamAliases({
  renderSysConfig,
  tambahConfigItem,
  hapusConfigItem,
  pindahConfigItem,
  simpanPengumuman,
});
