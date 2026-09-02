import bcrypt from 'bcryptjs';
import { normalizeWa, pick, supabaseJson, supabaseUpsert } from './db/client';
import { mapCandidate } from './db/candidates';
import { attachBerkasBio } from './db/berkas';
import { requireAdmin } from './actions-auth';
import { findCandidateByWa, nextCandidateId } from './candidate-helpers';
import { stripRaw } from './actions-public';
import { cacheClear } from './cache';
import * as fcm from './fcm-server';
// actions-mail.js — Mail inbox (database_asj_form): review/approve/reject/
// delete/tandai dibaca + sinkronisasi kandidat. MODUL BARU (Fase 1.1c

import {
  findForms,
  findFormsByWa,
  mapForm,
  resolveForm,
  upsertFormRow,
} from './db/forms';

// FIX #6 (audit 2026-09-02): Frontend sekarang mengirim id baris (primary
// key), bukan rowIndex (offset). Eliminates non-deterministic mutations saat
// timestamp collate. Legacy rowIndex didukung sebagai fallback.
async function handleFormStatus(formIdOrRowIndex, status, reason) {
  try {
    const { form: f, error: resolveErr } = await resolveForm(formIdOrRowIndex);
    if (!f) return { success: false, error: resolveErr || 'Form tidak ditemukan.' };
    // FIX #17 (audit 2026-09-02): cacheClear() SETELAH validasi berhasil,
    // bukan sebelum — permintaan invalid/gagal tidak memaksa semua client
    // ke full-table-scan.
    cacheClear();
    const body = { status };
    // @ts-expect-error JS→TS migration
    if (reason !== null && reason !== undefined) body.keterangan = reason;
    await supabaseJson('PATCH', 'database_asj_form', {
      query: { id: 'eq.' + f.id },
      body,
      headers: { Prefer: 'return=minimal' },
    });
    // Kandidat masuk list DB JOB HANYA setelah approve (LULUS); Gagal
    // mengeluarkannya. Sebelum approve, kandidat hanya ada di mail.
    try {
      await syncCandidateDariForm(f, status);
    } catch (e) {
      console.error('[form-status] sync candidate:', e && e.message ? e.message : e);
    }
    // === FCM NOTIFICATION: kirim push ke kandidat saat status berubah ===
    const waNotify = normalizeWa(String(f.no_wa || f.wa || ''));
    if (waNotify && (status === 'GAGAL' || status === 'REVIEW ADMIN' || status === 'LULUS')) {
      try {
        const jobCode = String(f.code_job || '');
        const reasonText = reason || '';
        let title = '';
        let body = '';
        if (status === 'GAGAL') {
          title = 'Dokumen ' + jobCode + ' perlu revisi';
          body = reasonText || 'Lamaran ditolak. Silakan cek dashboard untuk detail.';
        } else if (status === 'REVIEW ADMIN') {
          title = 'Dokumen ' + jobCode + ' sedang direview';
          body = 'Admin sedang meninjau dokumen Anda.';
        } else if (status === 'LULUS') {
          title = 'Lamaran ' + jobCode + ' disetujui! 🎉';
          body = 'Selamat! Lamaran Anda telah disetujui. Cek dashboard untuk langkah selanjutnya.';
        }
        if (title) {
          const { rows: tokens } = await supabaseJson('GET', 'fcm_tokens', {
            query: { select: 'token', wa: 'eq.' + waNotify, limit: 10 },
          });
          if (Array.isArray(tokens) && tokens.length > 0) {
            const tokenList = tokens.map((t) => t.token).filter(Boolean);
            if (tokenList.length > 0) {
              await fcm.sendMulticast(tokenList, title, body, '/');
            }
          }
        }
      } catch (eFcm) {
        console.error(
          '[form-status] FCM notification:',
          eFcm && eFcm.message ? eFcm.message : eFcm,
        );
      }
    }
    // PATCH-IN-PLACE: kembalikan baris mail hasil update + baris kandidat yang
    // berubah (LULUS → dibuat/diperbarui, GAGAL → status GAGAL & lepas job)
    // supaya frontend tidak perlu tarik ulang semua data (getAppData) hanya
    // untuk satu aksi — tabel aktif langsung di-render dari respons ini.
    f.status = status;
    if (reason !== null && reason !== undefined) f.keterangan = reason;
    let candidate = null;
    const wa = normalizeWa(String(f.no_wa || f.wa || ''));
    if (wa) {
      try {
        const row = await findCandidateByWa(wa);
        if (row && row.id !== undefined) {
          candidate = stripRaw([mapCandidate(row)])[0] || null;
          if (candidate) {
            try {
              await attachBerkasBio([candidate]);
            } catch (e2) {
              /* best-effort */
            }
          }
        }
      } catch (e3) {
        /* best-effort: frontend tetap dapat baris mail */
      }
    }
    // FIX #6: rowIndex diabaikan sekarang — frontend patching by id, bukan index.
    return { success: true, form: mapForm(f, 0), candidate };
  } catch (e) {
    return { success: false, error: 'Gagal proses form: ' + e.message };
  }
}

// Approve (LULUS) → buat/perbarui database_candidate dengan id_loker_pilihan =
// code_job supaya kandidat muncul di list DB JOB. Reject (GAGAL) → status GAGAL
// + lepas dari job. Data diambil dari baris mail (form lamaran).
async function syncCandidateDariForm(f, status) {
  const wa = normalizeWa(String(f.no_wa || f.wa || ''));
  const codeJob = String(f.code_job || '');
  if (!wa) return;
  const row = await findCandidateByWa(wa);
  if (status === 'LULUS') {
    const now = new Date().toISOString();
    const base: Record<string, any> = {
      nama_lengkap: String(f.nama_lengkap || ''),
      gender: String(f.gender || ''),
      usia: String(f.usia || ''),
      tb: String(f.tb || ''),
      bb: String(f.bb || ''),
      pas_photo: f.pas_photo || '',
      jft: f.jft || '',
      ssw: f.ssw || '',
      file_cv: f.file_cv || '',
      status_kandidat: 'LULUS',
      updated_at: now,
    };
    if (codeJob) base.id_loker_pilihan = codeJob;
    if (row && row.id !== undefined) {
      for (const k of Object.keys(base)) if (base[k] === undefined) delete base[k];
      await supabaseJson('PATCH', 'database_candidate', {
        query: { id: 'eq.' + row.id },
        body: base,
        headers: { Prefer: 'return=minimal' },
      });
    } else if (codeJob) {
      // Belum ada baris kandidat → buat dari data mail (password default = 4
      // digit terakhir WA, sama seperti alur daftar).
      base.id_kandidat = await nextCandidateId();
      base.no_wa = wa;
      base.password_kandidat = bcrypt.hashSync(wa.slice(-4), 10);
      base.password_diubah = false;
      base.tahapan_seleksi = 'LIST';
      base.tanggal_daftar = now;
      base.created_at = now;
      base.updated_at = now;
      // Upsert anti-duplikat: WA sudah punya baris (race GET-then-POST /
      // varian format WA) -> update baris lama, bukan error 409 ke user.
      await supabaseUpsert('database_candidate', base, ['no_wa'], {
        headers: { Prefer: 'return=minimal' },
      });
    }
  } else if (status === 'GAGAL' && row && row.id !== undefined) {
    const upd = { status_kandidat: 'GAGAL', updated_at: new Date().toISOString() };
    if (codeJob && String(pick(row, ['id_loker_pilihan', 'id_loker']) || '') === codeJob) {
      // @ts-expect-error JS→TS migration
      upd.id_loker_pilihan = null;
    }
    await supabaseJson('PATCH', 'database_candidate', {
      query: { id: 'eq.' + row.id },
      body: upd,
      headers: { Prefer: 'return=minimal' },
    });
  }
}

async function handleReviewForm(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  return handleFormStatus((payload || [])[0], 'REVIEW ADMIN', undefined);
}

async function handleApproveForm(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  return handleFormStatus((payload || [])[0], 'LULUS', undefined);
}

async function handleRejectForm(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  const [, , reason] = payload || [];
  return handleFormStatus((payload || [])[0], 'GAGAL', reason || 'Lamaran ditolak');
}

// FIX #6 (audit 2026-09-02): Mengirim id, bukan rowIndex.
async function handleDeleteForm(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  try {
    const { form: f, error: resolveErr } = await resolveForm((payload || [])[0]);
    if (!f) return { success: false, error: resolveErr || 'Form tidak ditemukan.' };
    // FIX #17: cacheClear SETELAH validasi berhasil.
    cacheClear();
    await supabaseJson('DELETE', 'database_asj_form', {
      query: { id: 'eq.' + f.id },
      headers: { Prefer: 'return=minimal' },
    });
    return { success: true, formId: String(f.id) };
  } catch (e) {
    return { success: false, error: 'Gagal menghapus form. Silakan coba lagi.' };
  }
}

// Tandai Dibaca — baris status UPDATE (kandidat ubah data setelah lamaran
// pernah diproses admin) kembali ke status aslinya. Status lama disimpan di
// feedback_berkas sebagai "[[PREV:LULUS]] ..." saat UPDATE diset; tanpa
// marker (data lama) → kembali ke antrean MENUNGGU.
// FIX #6 (audit 2026-09-02): Mengirim id, bukan rowIndex.
async function handleTandaiDibacaForm(payload, sessionToken) {
  const guard = requireAdmin(sessionToken);
  if (guard.error) return guard.error;
  try {
    const { form: f, error: resolveErr } = await resolveForm((payload || [])[0]);
    if (!f) return { success: false, error: resolveErr || 'Form tidak ditemukan.' };
    const fb = String(f.feedback_berkas || '');
    const m = fb.match(/\[\[PREV:([^\]]+)\]\]/);
    const prevStatus = m ? m[1].trim() : 'MENUNGGU';
    const newFb = fb.replace(/\[\[PREV:[^\]]+\]\]\s*/, '').trim();
    await supabaseJson('PATCH', 'database_asj_form', {
      query: { id: 'eq.' + f.id },
      body: { status: prevStatus, feedback_berkas: newFb, updated_at: new Date().toISOString() },
      headers: { Prefer: 'return=minimal' },
    });
    f.status = prevStatus;
    f.feedback_berkas = newFb;
    // FIX #6: rowIndex diabaikan — frontend patching by id.
    return { success: true, form: mapForm(f, 0) };
  } catch (e) {
    return { success: false, error: 'Gagal tandai dibaca: ' + e.message };
  }
}

// ---------------------------------------------------------------------------
// Mail sync — status UPDATE + ringkasan aktivitas (feedback_berkas)
// ---------------------------------------------------------------------------
// Status lamaran (database_asj_form.status):
//   MENUNGGU = lamaran baru / belum diproses admin
//   UPDATE   = kandidat MENGUBAH data (biodata/berkas) setelah barisnya sudah
//              pernah diproses admin — progres LULUS/GAGAL tidak di-reset,
//              admin cukup melihat badge UPDATE + ringkasan apa yang berubah.
const MAIL_PENDING_STATUS = ['MENUNGGU', 'MAIL', 'BARU', 'PENDING'];

function mailStatusUntukUpdate(currentStatus) {
  const cur = String(currentStatus || '').toUpperCase();
  if (!cur || MAIL_PENDING_STATUS.includes(cur)) return 'MENUNGGU';
  return 'UPDATE';
}

// Catat aktivitas terakhir (maks 3 entri) di feedback_berkas, mis.:
//   "[BIODATA] email & alamat diubah · [UPLOAD KTP] · [UPLOAD CV]"
function appendFeedback(prev, entry) {
  const items = String(prev || '')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  items.unshift(String(entry || '').trim());
  return items.slice(0, 3).join(' · ');
}

// Biodata diubah → tandai baris mail kandidat (SEMUA lamarannya) dengan
// status UPDATE (kalau sudah pernah diproses admin) + ringkasan apa yang
// berubah, supaya admin tidak bingung "email baru, tapi apa yang di-update?".
async function syncBiodataKeMail(wa, nama, labels) {
  const want = normalizeWa(wa);
  // Jalur cepat: tarik hanya lamaran WA ini, bukan scan 500 baris inbox.
  let rows = await findFormsByWa(wa);
  if (rows === undefined) rows = await findForms();
  const mine = rows.filter((r) => normalizeWa(String(r.no_wa || r.wa || '')) === want);
  if (!mine.length) return;
  for (const r of mine) {
    if (r.id === undefined || r.id === null) continue;
    // [[PREV:xxx]] menyimpan status sebelum UPDATE supaya tombol "Tandai
    // Dibaca" bisa mengembalikannya (LULUS/GAGAL/REVIEW tidak hilang).
    const isUpdate = mailStatusUntukUpdate(r.status) === 'UPDATE';
    const entry =
      (isUpdate ? '[[PREV:' + String(r.status || '').toUpperCase() + ']] ' : '') +
      '[BIODATA] ' +
      (labels.length ? labels.join(', ') : 'data diperbarui');
    const body = {
      timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      feedback_berkas: appendFeedback(r.feedback_berkas, entry),
    };
    // @ts-expect-error JS→TS migration
    if (isUpdate) body.status = 'UPDATE';
    await supabaseJson('PATCH', 'database_asj_form', {
      query: { id: 'eq.' + r.id },
      body,
      headers: { Prefer: 'return=minimal' },
    });
  }

  // D. Kirim Push Notification ke Admin setiap kali biodata diupdate
  if (labels && labels.length > 0) {
    try {
      const { notifyAdmins } = await import('./fcm-helpers');
      const notifyTitle = 'Biodata Lengkap (CV) Diperbarui';
      const notifyBody = `Kandidat ${nama} (${wa}) memperbarui data: ${labels.join(', ')}.`;
      await notifyAdmins(notifyTitle, notifyBody, '/admin.html');
    } catch (e) {
      // Abaikan error push notif
    }
  }
}

// ---------------------------------------------------------------------------
// MAIL = UPLOAD-DRIVEN (kebijakan). Hanya perubahan dokumen/upload yang masuk
// mail inbox (database_asj_form). Update data lain (status kandidat, CV mini,
// CV AI, auto approve) TIDAK menyentuh mail.
// ---------------------------------------------------------------------------
// Sinkronkan/muat baris mail kandidat dengan satu upload dokumen terbaru.
// - Target baris: CV = dokumen PER LOKER → hanya baris lamaran itu (fallback
//   WA saja); dokumen lain (KTP/KK/foto/JFT/SSW/dll) = dokumen KANDIDAT →
//   SEMUA lamaran WA ikut ter-update (dulu hanya baris pertama).
// - Status: lamaran masih MENUNGGU → tetap MENUNGGU; yang sudah pernah
//   diproses admin (LULUS/GAGAL/REVIEW) → UPDATE (progres TIDAK di-reset,
//   admin melihat badge UPDATE "kandidat ubah data").
// - Keterangan = daftar dokumen "NAMA:URL;..." (mail menampilkan SEMUA
//   dokumen + preview); feedback_berkas = catatan aktivitas terakhir
//   ("[UPLOAD KTP]") supaya admin tahu apa yang baru di-upload.
async function syncFormMailDariUpload(wa, nama, docLabel, url, jobCode) {
  const want = normalizeWa(wa);
  // Jalur cepat: tarik hanya lamaran WA ini, bukan scan 500 baris inbox.
  let rows = await findFormsByWa(wa);
  if (rows === undefined) {
    rows = await supabaseJson('GET', 'database_asj_form', {
      query: { select: '*', limit: 500 },
    });
  }
  const all = Array.isArray(rows) ? rows : [];
  const label = String(docLabel || 'DOKUMEN')
    .trim()
    .toUpperCase();
  const code = String(jobCode || '').trim();

  let targets = [];
  if (label === 'CV' || label === 'CV_REVISI') {
    if (code) {
      targets = all.filter(
        (r) =>
          normalizeWa(String(r.no_wa || r.wa || '')) === want &&
          String(r.code_job || '').trim() === code,
      );
    }
    if (!targets.length) {
      targets = all.filter((r) => normalizeWa(String(r.no_wa || r.wa || '')) === want);
    }
  } else {
    targets = all.filter((r) => normalizeWa(String(r.no_wa || r.wa || '')) === want);
  }
  if (!targets.length) targets = [null];

  for (const existing of targets) {
    // Baca dokumen lama dari keterangan baris ini, lalu gabung dengan yang baru.
    const docs: Record<string, any> = {};
    const raw = String((existing && existing.keterangan) || '');
    raw.split(';').forEach((chunk) => {
      const i = chunk.indexOf(':');
      if (i > 0) docs[chunk.slice(0, i).trim().toUpperCase()] = chunk.slice(i + 1).trim();
    });
    docs[label] = String(url || '');
    // [[PREV:xxx]] = status sebelum UPDATE (dipulihkan tombol Tandai Dibaca).
    const nextStatus = mailStatusUntukUpdate(existing && existing.status);
    const entry =
      (nextStatus === 'UPDATE' && existing && existing.status
        ? '[[PREV:' + String(existing.status).toUpperCase() + ']] '
        : '') +
      '[UPLOAD ' +
      label +
      ']';
    const keterangan = Object.entries(docs)
      .filter(([, v]) => v)
      .map(([k, v]) => k + ':' + v)
      .join(';');
    const body = {
      timestamp: new Date().toISOString(),
      code_job: String((existing && existing.code_job) || code || ''),
      nama_lengkap: String(nama || (existing && existing.nama_lengkap) || 'KANDIDAT').toUpperCase(),
      no_wa: want,
      keterangan,
      status: nextStatus,
      feedback_berkas: appendFeedback(existing && existing.feedback_berkas, entry),
      updated_at: new Date().toISOString(),
    };
    // Kolom utama kalau jenis dokumennya dikenali (foto/CV/JFT/SSW).
    // @ts-expect-error JS→TS migration
    if (label === 'PAS_PHOTO' || label === 'PHOTO') body.pas_photo = String(url || '');
    // @ts-expect-error JS→TS migration
    if (label === 'CV' || label === 'CV_REVISI') body.file_cv = String(url || '');
    // @ts-expect-error JS→TS migration
    if (label === 'JFT') body.jft = String(url || '');
    // @ts-expect-error JS→TS migration
    if (label === 'SSW') body.ssw = String(url || '');
    if (existing && existing.id !== undefined) {
      await supabaseJson('PATCH', 'database_asj_form', {
        query: { id: 'eq.' + existing.id },
        body,
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      // Upsert anti-duplikat (no_wa, code_job) — upload paralel (mis. KTP+KK
      // lewat Promise.allSettled) tidak bikin baris mail dobel untuk WA yang
      // belum punya lamaran.
      await upsertFormRow(body);
    }

    // D. Kirim Push Notification ke Admin setiap kali dokumen diupload
    if (label && targets.length > 0) {
      try {
        const { notifyAdmins } = await import('./fcm-helpers');
        const notifyTitle = 'Dokumen Baru Diupload';
        const notifyBody = nama + ' (' + want + ') mengupload ' + label + '. Silakan review di Mail.';
        await notifyAdmins(notifyTitle, notifyBody, '/admin.html#mail');
      } catch (e) {
        // Abaikan error push notif — jangan gagalkan upload
      }
    }
  }
}

export {
  handleReviewForm,
  handleApproveForm,
  handleRejectForm,
  handleDeleteForm,
  handleTandaiDibacaForm,
  mailStatusUntukUpdate,
  appendFeedback,
  syncBiodataKeMail,
  syncFormMailDariUpload,
};
