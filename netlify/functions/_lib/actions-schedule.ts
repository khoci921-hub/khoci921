import { supabaseJson, toText } from './db/client';
import { requireRole } from './actions-auth';
import { cacheClearKey } from './cache';
import * as fcm from './fcm-server';
// actions-schedule.js — jadwal (database_schedule) & tugas (database_tugas).
// (2.549 baris), perilaku TIDAK berubah.

async function handleSimpanJadwalBaru(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const d = (payload && payload[0]) || {};
  if (!d.nama) return { success: false, error: 'Nama agenda wajib diisi.' };
  const idJadwal = 'JDW' + Date.now();
  try {
    await supabaseJson('POST', 'database_schedule', {
      body: {
        id_jadwal: idJadwal,
        nama_agenda: String(d.nama),
        id_loker_terkait: String(d.loker || '-'),
        tanggal_waktu: String(d.waktu || ''),
        lokasi_link: String(d.link || d.lokasi || '-'),
        daftar_kandidat: String(d.kandidat || '-'),
        tsk: String(d.tsk || ''),
        status_jadwal: 'AKTIF',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      headers: { Prefer: 'return=minimal' },
    });
    // FIX #31/#35: Hapus cache schedules saja (bukan semua cache).
    cacheClearKey('schedules');
    // PATCH-IN-PLACE: kembalikan baris jadwal baru (bentuk loadSchedules) supaya
    // frontend cukup push ke memori + render tabel tanpa tarik ulang getAppData.
    return {
      success: true,
      schedule: {
        idJadwal,
        namaAgenda: String(d.nama),
        idLoker: String(d.loker || '-'),
        waktu: String(d.waktu || ''),
        link: String(d.link || d.lokasi || '-'),
        kandidat: String(d.kandidat || '-'),
        tsk: String(d.tsk || ''),
      },
    };
  } catch (e) {
    return { success: false, error: 'Gagal simpan jadwal: ' + e.message };
  }
}

async function handleHapusJadwal(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const id = String((payload && payload[0]) || '');
  if (!id) return { success: false, error: 'ID jadwal tidak ditemukan.' };
  try {
    // FIX: jadwal legacy (sebelum rebuild) hanya punya kolom `id`, tanpa
    // `id_jadwal` — DELETE dengan filter id_jadwal yang tidak cocok diam-diam
    // menghapus 0 baris (kenapa dulu "gak bisa hapus jadwal"). Cari barisnya
    // dulu (id_jadwal ATAU id), lalu hapus berdasarkan primary key `id`.
    const rows = await supabaseJson('GET', 'database_schedule', {
      query: { select: '*', limit: 500 },
    });
    const row = (Array.isArray(rows) ? rows : []).find(
      (r) => String(r.id_jadwal || '') === id || String(r.id || '') === id,
    );
    if (!row || row.id === undefined || row.id === null) {
      return { success: false, error: 'Jadwal tidak ditemukan.' };
    }
    await supabaseJson('DELETE', 'database_schedule', {
      query: { id: 'eq.' + row.id },
      headers: { Prefer: 'return=minimal' },
    });
    // FIX #31/#35: Hapus cache schedules saja.
    cacheClearKey('schedules');
    return { success: true, id };
  } catch (e) {
    return { success: false, error: 'Gagal hapus jadwal: ' + e.message };
  }
}

async function handleTambahTugasBaru(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const nama = String((payload && payload[0]) || '').trim();
  const admin = String((payload && payload[1]) || '');
  if (!nama) return { success: false, error: 'Nama tugas wajib diisi.' };
  const idTugas = 'TGS' + Date.now();
  const waktuDibuat = new Date().toISOString();
  try {
    await supabaseJson('POST', 'database_tugas', {
      body: {
        id_tugas: idTugas,
        nama_tugas: nama,
        dibuat_oleh: admin,
        waktu_dibuat: waktuDibuat,
        status: 'BARU',
        created_at: waktuDibuat,
        updated_at: waktuDibuat,
      },
      headers: { Prefer: 'return=minimal' },
    });
    // FIX #31/#35: Hapus cache tugas saja.
    cacheClearKey('tugas');
    return {
      success: true,
      tugas: { id: idTugas, task: nama, status: 'BARU', dibuatOleh: admin, waktuDibuat },
    };
  } catch (e) {
    return { success: false, error: 'Gagal tambah tugas: ' + e.message };
  }
}

async function handleSetTugasStatus(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const id = String((payload && payload[0]) || '');
  const st = String((payload && payload[1]) || '');
  if (!id || !st) return { success: false, error: 'Data tidak lengkap.' };
  try {
    // FIX sama seperti hapus jadwal: tugas legacy hanya punya `id`, bukan
    // `id_tugas` — cari barisnya dulu, update berdasarkan primary key `id`.
    const rows = await supabaseJson('GET', 'database_tugas', {
      query: { select: '*', limit: 500 },
    });
    const row = (Array.isArray(rows) ? rows : []).find(
      (r) => String(r.id_tugas || '') === id || String(r.id || '') === id,
    );
    if (!row || row.id === undefined || row.id === null) {
      return { success: false, error: 'Tugas tidak ditemukan.' };
    }
    const body = { status: st, updated_at: new Date().toISOString() };
    // @ts-expect-error JS→TS migration
    if (st === 'SELESAI') body.waktu_selesai = new Date().toISOString();
    await supabaseJson('PATCH', 'database_tugas', {
      query: { id: 'eq.' + row.id },
      body,
      headers: { Prefer: 'return=minimal' },
    });
    // FIX #31/#35: Hapus cache tugas saja.
    cacheClearKey('tugas');
    return {
      success: true,
      tugas: {
        id: String(row.id_tugas || row.id || ''),
        task: toText(row.nama_tugas || ''),
        status: st,
        dibuatOleh: toText(row.dibuat_oleh || ''),
        waktuDibuat: toText(row.waktu_dibuat || ''),
      },
    };
  } catch (e) {
    return { success: false, error: 'Gagal update status tugas: ' + e.message };
  }
}

async function handleHapusTugas(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const id = String((payload && payload[0]) || '');
  if (!id) return { success: false, error: 'ID tugas tidak ditemukan.' };
  try {
    const rows = await supabaseJson('GET', 'database_tugas', {
      query: { select: '*', limit: 500 },
    });
    const row = (Array.isArray(rows) ? rows : []).find(
      (r) => String(r.id_tugas || '') === id || String(r.id || '') === id,
    );
    if (!row || row.id === undefined || row.id === null) {
      return { success: false, error: 'Tugas tidak ditemukan.' };
    }
    await supabaseJson('DELETE', 'database_tugas', {
      query: { id: 'eq.' + row.id },
      headers: { Prefer: 'return=minimal' },
    });
    // FIX #31/#35: Hapus cache tugas saja.
    cacheClearKey('tugas');
    return { success: true, id };
  } catch (e) {
    return { success: false, error: 'Gagal hapus tugas: ' + e.message };
  }
}

// === CHECK & SEND AGENDA REMINDERS ===
// Cek jadwal aktif yang akan dimulai dalam 1 jam ke depan, kirim FCM push
// ke kandidat yang terdaftar. Dipanggil saat kandidat login (frontend).
// Dedup: gunakan field `reminder_sent` di database_schedule untuk cegah
// kirim ulang (set true setelah berhasil kirim).
// === CHECK & SEND AGENDA REMINDERS (MULTI-LEVEL) ===
// Cek jadwal aktif dalam 3 window: H-7 (6-8 hari), H-1 (20-28 jam), H-0 (≤60 menit).
// Kirim FCM push ke kandidat yang terdaftar. Dipanggil saat kandidat login.
// Dedup: field reminder_h7_sent, reminder_h1_sent, reminder_sent.
async function handleCheckAndSendAgendaReminders(payload, sessionToken) {
  let sent = 0;
  let errors = 0;
  try {
    const now = Date.now();
    const { rows: schedules } = await supabaseJson('GET', 'database_schedule', {
      query: {
        select: '*',
        status_jadwal: 'eq.AKTIF',
        limit: 100,
      },
    });
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return { success: true, sent: 0, checked: 0 };
    }

    // Helper: parse waktu jadwal → timestamp
    const parseTime = (waktu) => {
      if (!waktu) return 0;
      try {
        if (waktu.includes('/')) {
          const [datePart, timePart] = waktu.split(' ');
          const [dd, mm, yyyy] = datePart.split('/');
          const [hh, mi] = (timePart || '00:00').split(':');
          return new Date(
            Number(yyyy),
            Number(mm) - 1,
            Number(dd),
            Number(hh),
            Number(mi),
          ).getTime();
        }
        return new Date(waktu).getTime();
      } catch {
        return 0;
      }
    };

    // Helper: parse daftar kandidat → WA list
    const parseWaList = (raw) => {
      return String(raw || '')
        .split(/[\n,;]+/)
        .map((x) => {
          const d = x.replace(/\D/g, '');
          if (d.startsWith('628') && d.length >= 13) return d;
          if (d.startsWith('08') && d.length >= 10) return '62' + d.slice(1);
          return '';
        })
        .filter(Boolean);
    };

    // Helper: kirim FCM ke list WA
    const sendToWaList = async (waList, title, body) => {
      for (const wa of waList) {
        try {
          const { rows: tokens } = await supabaseJson('GET', 'fcm_tokens', {
            query: { select: 'token', wa: 'eq.' + wa, limit: 5 },
          });
          if (Array.isArray(tokens) && tokens.length > 0) {
            const tokenList = tokens.map((t) => t.token).filter(Boolean);
            if (tokenList.length > 0) {
              await fcm.sendMulticast(tokenList, title, body, '/');
              sent++;
            }
          }
        } catch {
          errors++;
        }
      }
    };

    // Window definitions
    const WINDOWS = [
      {
        key: 'h7',
        field: 'reminder_h7_sent',
        minMs: 6 * 86400000,
        maxMs: 8 * 86400000,
        label: '7 hari',
      },
      {
        key: 'h1',
        field: 'reminder_h1_sent',
        minMs: 20 * 3600000,
        maxMs: 28 * 3600000,
        label: 'besok',
      },
      { key: 'h0', field: 'reminder_sent', minMs: 0, maxMs: 60 * 60000, label: 'mulai' },
    ];

    for (const s of schedules) {
      const schedTime = parseTime(s.tanggal_waktu);
      if (!schedTime || isNaN(schedTime)) continue;

      const diffMs = schedTime - now;
      const agenda = s.nama_agenda || 'Jadwal';
      const lokasi = s.lokasi_link || '';
      const waList = parseWaList(s.daftar_kandidat);
      if (waList.length === 0) continue;

      for (const w of WINDOWS) {
        // Skip jika sudah dikirim
        if (s[w.field] === true || s[w.field] === 'true') continue;
        // Skip jika di luar window
        if (diffMs < w.minMs || diffMs > w.maxMs) continue;

        let title, body;
        if (w.key === 'h0') {
          const mins = Math.round(diffMs / 60000);
          title = '⏰ ' + agenda;
          body =
            agenda +
            (mins > 0 ? ' dalam ' + mins + ' menit' : ' dimulai sekarang') +
            (lokasi ? ' di ' + lokasi : '');
        } else if (w.key === 'h1') {
          title = '📅 Jadwal besok: ' + agenda;
          body = agenda + ' dijadwalkan besok' + (lokasi ? ' di ' + lokasi : '');
        } else {
          title = '📅 Jadwal 7 hari lagi: ' + agenda;
          body = agenda + ' dijadwalkan 7 hari lagi' + (lokasi ? ' di ' + lokasi : '');
        }

        await sendToWaList(waList, title, body);

        // Tandai sudah dikirim
        try {
          const schedId = s.id || s.id_jadwal;
          if (schedId) {
            await supabaseJson('PATCH', 'database_schedule', {
              query: { id: 'eq.' + schedId },
              body: { [w.field]: true, updated_at: new Date().toISOString() },
              headers: { Prefer: 'return=minimal' },
            });
          }
        } catch {}
      }
    }
    return { success: true, sent, errors, checked: schedules.length };
  } catch (e) {
    return { success: false, error: e.message || 'Gagal check reminders' };
  }
}

export {
  handleSimpanJadwalBaru,
  handleHapusJadwal,
  handleTambahTugasBaru,
  handleSetTugasStatus,
  handleHapusTugas,
  handleCheckAndSendAgendaReminders,
};
