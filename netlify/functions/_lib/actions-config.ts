import { supabaseJson } from './db/client';
import { findSettings } from './db/misc';
import { requireRole } from './actions-auth';
// actions-config.js — konfigurasi sistem (sys_config) + preset rincian biaya.
// perilaku TIDAK berubah.

const CONFIG_TYPE_MAP = {
  kategori: 'list_kategori',
  gender: 'list_gender',
  tahapan: 'list_tahapan',
  tsk: 'tsk',
  lokasi: 'list_lokasi',
  syarat: 'list_syarat',
  lokasiZoom: 'lokasi__link_zoom',
  statusLoker: 'list_status_loker',
  statusForm: 'status_form',
  statusLamaran: 'list_status_lamaran',
  broadcast: 'broadcast',
  pengumuman: 'broadcast',
};

async function handleUpdateSysConfig(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const key = String((payload && payload[0]) || '');
  const arr = (payload && payload[1]) || [];
  if (!key) return { success: false, error: 'Key konfigurasi tidak valid.' };
  const type = CONFIG_TYPE_MAP[key] || key;
  const items = Array.isArray(arr) ? arr.map((x) => String(x)) : [String(arr)];
  try {
    const settings = await findSettings();
    const rows = Array.isArray(settings.rows) ? settings.rows : [];
    const toDelete = rows.filter((r) => String(r.config_type || '') === type).map((r) => r.id);
    for (const id of toDelete) {
      await supabaseJson('DELETE', 'sys_config', {
        query: { id: 'eq.' + id },
        headers: { Prefer: 'return=minimal' },
      });
    }
    for (const item of items) {
      if (!item) continue;
      await supabaseJson('POST', 'sys_config', {
        body: {
          config_type: type,
          config_value: item,
          is_active: true,
          created_at: new Date().toISOString(),
        },
        headers: { Prefer: 'return=minimal' },
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal simpan konfigurasi: ' + e.message };
  }
}

// ---------------------------------------------------------------------------
// Rincian biaya presets (rincian_presets)
// ---------------------------------------------------------------------------
async function handleGetRincianPresets() {
  try {
    const rows = await supabaseJson('GET', 'rincian_presets', {
      query: { select: '*', limit: 500 },
    });
    const presets = { include: [], exclude: [], benefit: [], persyaratan: [] };
    for (const r of Array.isArray(rows) ? rows : []) {
      const cat = String(r.kategori || '').toLowerCase();
      if (presets[cat]) presets[cat].push({ id: r.id, item: String(r.item || '') });
    }
    return { success: true, presets };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleSaveRincianPreset(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const d = (payload && payload[0]) || {};
  const cat = String(d.kategori || '');
  const items = Array.isArray(d.item) ? d.item.map((x) => String(x)) : [String(d.item || '')];
  if (!cat || !items[0]) return { success: false, error: 'Kategori dan item wajib diisi.' };
  try {
    let lastId = null;
    for (const item of items) {
      if (!item) continue;
      const rows = await supabaseJson('POST', 'rincian_presets', {
        body: { kategori: cat, item, created_at: new Date().toISOString() },
        headers: { Prefer: 'return=representation' },
      });
      if (Array.isArray(rows) && rows[0]) lastId = rows[0].id;
    }
    return { success: true, id: lastId };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleDeleteRincianPreset(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const id = String((payload && payload[0] && payload[0].id) || '');
  if (!id) return { success: false, error: 'ID preset tidak ditemukan.' };
  try {
    await supabaseJson('DELETE', 'rincian_presets', {
      query: { id: 'eq.' + id },
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleRunMigration(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  try {
    const rows = await supabaseJson('GET', 'meta_rev', {
      query: { select: '*', limit: 10 },
    });
    const cur =
      (Array.isArray(rows) ? rows : []).find((r) => String(r.domain || '') === 'migration') || null;
    await supabaseJson('POST', 'meta_rev', {
      body: {
        domain: 'migration',
        rev: cur ? Number(cur.rev || 0) + 1 : 1,
        updated_at: new Date().toISOString(),
      },
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true, results: [{ id: 'migration', status: 'OK' }], pendingSql: [] };
  } catch (e) {
    return { success: false, error: e.message, results: [], pendingSql: [] };
  }
}

export {
  handleUpdateSysConfig,
  handleGetRincianPresets,
  handleSaveRincianPreset,
  handleDeleteRincianPreset,
  handleRunMigration,
};
