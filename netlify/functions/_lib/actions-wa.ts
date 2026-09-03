import { normalizeWa, supabaseJson } from './db/client';
import { splitPesanVariants } from '../../../shared/wa-text.ts';
import { env } from './env';
import { requireRole } from './actions-auth';
import { cacheClearKey } from './cache';
// actions-wa.js — template WA (wa_templates) + pengiriman WhatsApp via Fonnte.
// perilaku TIDAK berubah.

async function handleSimpanWaTemplate(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const id = String((payload && payload[0]) || '');
  const nama = String((payload && payload[1]) || '').trim();
  const isi = String((payload && payload[2]) || '');
  if (!nama) return { success: false, error: 'Nama template wajib diisi.' };
  try {
    if (id && id !== '') {
      await supabaseJson('PATCH', 'wa_templates', {
        query: { id: 'eq.' + id },
        body: { nama, isi, updated_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      await supabaseJson('POST', 'wa_templates', {
        body: {
          id: 'WA' + Date.now(),
          nama,
          isi,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        headers: { Prefer: 'return=minimal' },
      });
    }
    // FIX #31/#35: Hapus cache wa-templates saja.
    cacheClearKey('wa-templates');
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal simpan template: ' + e.message };
  }
}

async function handleHapusWaTemplate(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const id = String((payload && payload[0]) || '');
  if (!id) return { success: false, error: 'ID template tidak ditemukan.' };
  try {
    await supabaseJson('DELETE', 'wa_templates', {
      query: { id: 'eq.' + id },
      headers: { Prefer: 'return=minimal' },
    });
    // FIX #31/#35: Hapus cache wa-templates saja.
    cacheClearKey('wa-templates');
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Gagal hapus template: ' + e.message };
  }
}

async function fonnteSend(target, message) {
  const token = env('FONNTE_TOKEN') || env('FONNTE_API_KEY');
  if (!token) throw new Error('FONNTE_TOKEN belum dikonfigurasi');
  const params = new URLSearchParams();
  params.set('target', String(target));
  params.set('message', String(message));
  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Fonnte HTTP ' + res.status + ' ' + text.slice(0, 200));
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Normalisasi NOMOR KIRIM (bukan gate identitas kandidat):
//   - 0xx → 62xx dan 8xx-domestik pendek (≤11 digit) → 62+…  (normalizeWa)
//   - 62… → sudah baku, biarkan.
//   - Lainnya (nomor INTERNASIONAL dari daftar undangan grup kelas:
//     81…, 65…, 44…, dst) → dipakai apa adanya. Kritis: 8-led panjang
//     (mis. 818042045600 = +81 80-4204-5600) TIDAK boleh di-62-kan karena
//     terlihat seperti 8xx domestik — batas ≤11 digit membedakannya.
function waKirim(x) {
  const d = String(x || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0') || (d.startsWith('8') && d.length <= 11)) return normalizeWa(d);
  return d;
}

async function handleKirimSatuPesanFonnte(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const wa = String((payload && payload[0]) || '');
  const message = String((payload && payload[1]) || '');
  if (!wa || !message) return { success: false, error: 'Nomor WA dan pesan wajib diisi.' };
  try {
    const result = await fonnteSend(waKirim(wa), message);
    return { success: true, result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Ganti placeholder template WA ke nilai per-kandidat. Terima SEMUA format
// yang pernah dipakai UI/admin: `{nama}`/`{job}`/`{link}` (server lama) DAN
// `<<NAMA>>`/`<<JOB>>`/`<<LINK>>` (WA Pintar frontend) DAN
// `{job_code}`/`{link_grup}` (matchmaking esign). Tanpa ini template yang
// disimpan admin dengan `<<NAMA>>` terkirim mentah ke kandidat.
// Parsing varian `---` (splitPesanVariants) di shared/wa-text.ts — satu
// sumber kebenaran frontend↔backend (candidates.ts alias parseVarianPesan).
function applyTemplatePlaceholders(text, nama, jobCode, linkGrup) {
  return String(text || '')
    .replace(/\{nama\}/g, nama)
    .replace(/<<NAMA>>/gi, nama)
    .replace(/\{job_code\}/g, jobCode)
    .replace(/\{job\}/g, jobCode)
    .replace(/<<JOB>>/gi, jobCode)
    .replace(/\{link_grup\}/g, linkGrup)
    .replace(/\{link\}/g, linkGrup)
    .replace(/<<LINK>>/gi, linkGrup);
}

// Pilih & isi pesan untuk penerima ke-`index`. `variants` (customMessage yang
// dipisah baris `---`) dikirim BERGILIRAN — `index % variants.length` → tiap
// penerima dapat pesan berbeda (anti-ban pesan identik massal); kalau jumlah
// varian = jumlah penerima dengan urutan sama, tiap orang mendapat pesan yang
// ditulis khusus untuknya (cocok untuk 34 pesan ortu berbeda). Placeholder
// {nama}/{job_code}/{link_grup} (dan gaya lama <<NAMA>>/<<JOB>>/<<LINK>>)
// tetap di-replace per penerima. Fallback: template wa_templates, lalu pesan
// default. Fungsi murni — di-unit-test (actions-wa.test.js).
function buildPesanTawaranMassal(variants, templateIsi, nama, jobCode, linkGrup, index) {
  if (variants.length) {
    return applyTemplatePlaceholders(variants[index % variants.length], nama, jobCode, linkGrup);
  }
  if (templateIsi) {
    return applyTemplatePlaceholders(templateIsi, nama, jobCode, linkGrup);
  }
  return (
    'Halo ' +
    nama +
    '! Anda terpilih untuk Lowongan ' +
    jobCode +
    '. Silakan bergabung ke grup resmi kami: ' +
    linkGrup
  );
}

// kirimTawaranMassal([{candidates, jobCode, linkGrup, interval, customMessage}])
// ⚠️ 2026-09-03: UI kini memakai jalur per-nomor handleKirimSatuTawaran
// (kirimBertahap di js/admin_ops/candidates.js). Versi massal ini menidurkan
// `interval` detik ANTAR pesan DI DALAM SATU invokasi fungsi Netlify — fungsi
// sinkron Netlify dibunuh platform setelah ~10 dtk (default; maks 26 dtk),
// jadi dengan jeda 10 dtk hanya pesan pertama yang terkirim lalu berhenti
// (bug: WA Pintar cuma kirim 1x). Dipertahankan utk kompatibilitas pemanggil
// lama; perilaku TIDAK berubah.
async function handleKirimTawaranMassal(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const d = (payload && payload[0]) || {};
  const cands = Array.isArray(d.candidates) ? d.candidates : [];
  if (cands.length === 0) return { success: false, error: 'Tidak ada kandidat.' };
  const jobCode = String(d.jobCode || '');
  const linkGrup = String(d.linkGrup || '');
  const interval = Math.max(Number(d.interval) || 5, 1);
  const results = [];
  // customMessage boleh berisi BANYAK VARIAN pesan, dipisah baris `---`.
  const variants = splitPesanVariants(d.customMessage);
  try {
    let templateIsi = null;
    try {
      const rows = await supabaseJson('GET', 'wa_templates', {
        query: { select: '*', limit: 100 },
      });
      const tpl = (Array.isArray(rows) ? rows : []).find(
        (r) =>
          String(r.nama || '')
            .toLowerCase()
            .includes('grup') ||
          String(r.nama || '')
            .toLowerCase()
            .includes('undang'),
      );
      if (tpl) templateIsi = String(tpl.isi || '');
    } catch (e) {
      /* template opsional */
    }
    for (let i = 0; i < cands.length; i += 1) {
      const c = cands[i];
      const wa = waKirim(c.wa);
      const nama = String(c.nama || 'Kandidat');
      const message = buildPesanTawaranMassal(variants, templateIsi, nama, jobCode, linkGrup, i);
      try {
        await fonnteSend(wa, message);
        results.push({ wa: c.wa, nama, success: true });
      } catch (e) {
        results.push({ wa: c.wa, nama, success: false, error: e.message });
      }
      if (interval > 0) await new Promise((r) => setTimeout(r, interval * 1000));
    }
    return { success: true, results };
  } catch (e) {
    return { success: false, error: e.message, results };
  }
}

// Satu pesan = SATU panggilan (dipakai loop bertahap frontend —
// kirimBertahap di js/admin_ops/candidates.js). Handler stateless & cepat:
// tanpa jeda, tanpa baca DB — seluruh konteks (termasuk templateIsi fallback
// yang di-resolve frontend dari ALL_WA_TEMPLATES) dikirim per pemanggilan,
// selesai <2 dtk sehingga tidak pernah kena timeout platform Netlify.
// Pacing antar nomor (jeda acak anti-ban) dijalankan BROWSER, bukan di sini.
async function handleKirimSatuTawaran(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const d = (payload && payload[0]) || {};
  const wa = waKirim(d.wa);
  if (!wa) return { success: false, error: 'Nomor WA tidak valid.' };
  const nama = String(d.nama || 'Kandidat');
  const index = Math.max(Number(d.index) || 0, 0);
  const jobCode = String(d.jobCode || '');
  const linkGrup = String(d.linkGrup || '');
  const customMessage = String(d.customMessage || '');
  // templateIsi (fallback saat customMessage kosong) dikirim frontend dari
  // ALL_WA_TEMPLATES — aturan pemilihan sama dengan versi massal: template
  // wa_templates yang namanya mengandung grup/undang.
  const templateIsi = String(d.templateIsi || '') || null;
  const variants = splitPesanVariants(customMessage);
  const message = buildPesanTawaranMassal(variants, templateIsi, nama, jobCode, linkGrup, index);
  try {
    const result = await fonnteSend(wa, message);
    return { success: true, wa, nama, result };
  } catch (e) {
    return { success: false, wa, nama, error: e.message };
  }
}

export {
  handleSimpanWaTemplate,
  handleHapusWaTemplate,
  handleKirimSatuPesanFonnte,
  handleKirimSatuTawaran,
  handleKirimTawaranMassal,
  buildPesanTawaranMassal,
  splitPesanVariants,
  waKirim,
};
