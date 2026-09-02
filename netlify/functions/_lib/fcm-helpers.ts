import { supabaseJson } from './db/client.ts';
import * as fcm from './fcm-server.ts';

// ===========================================================================
// fcm-helpers.ts — Shared helper untuk notifikasi FCM push
// Dipakai oleh actions-upload.ts, actions-schedule.ts, dll.
// ===========================================================================

/**
 * Ambil semua token admin dari fcm_tokens.
 * Admin = token yang WA-nya BUKAN format kandidat (628xxxxxxxxxx).
 * Termasuk: test tokens, tokens dengan WA "ADMIN", atau WA kosong.
 */
export async function getAdminTokens(): Promise<string[]> {
  try {
    const rows = (await supabaseJson('GET', 'fcm_tokens', {
      query: { select: 'token,wa', limit: 200 },
    })) as any[];
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((t) => {
        const wa = String(t.wa || '');
        // Kandidat WA: 628xxxxxxxxxx (12-14 digit)
        // Admin WA: selain format itu
        return !wa || !/^628\d{9,11}$/.test(wa);
      })
      .map((t) => t.token)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Ambil semua token kandidat berdasarkan WA (bisa multiple device).
 */
export async function getKandidatTokens(wa: string): Promise<string[]> {
  try {
    const rows = (await supabaseJson('GET', 'fcm_tokens', {
      query: { select: 'token', wa: 'eq.' + wa, limit: 20 },
    })) as any[];
    if (!Array.isArray(rows)) return [];
    return rows.map((t) => t.token).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Kirim notifikasi ke semua admin — fire-and-forget.
 * Error diam-diam (tidak membatalkan operasi pemanggil).
 */
export async function notifyAdmins(title: string, body: string, url = '/'): Promise<void> {
  try {
    const tokens = await getAdminTokens();
    if (tokens.length === 0) return;
    await fcm.sendMulticast(tokens, title, body, url);
  } catch {
    // best-effort — notif gagal jangan ganggu flow utama
  }
}

/**
 * Kirim notifikasi ke kandidat tertentu (semua device) — fire-and-forget.
 */
export async function notifyKandidat(
  wa: string,
  title: string,
  body: string,
  url = '/',
): Promise<void> {
  try {
    const tokens = await getKandidatTokens(wa);
    if (tokens.length === 0) return;
    await fcm.sendMulticast(tokens, title, body, url);
  } catch {
    // best-effort
  }
}
