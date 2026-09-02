import { config } from 'dotenv';
config({ path: '.env.local' });

import { sendPushNotification } from '../netlify/functions/_lib/fcm-server.ts';
import { supabaseJson } from '../netlify/functions/_lib/db/client.ts';

async function main() {
  const result = await supabaseJson('GET', 'fcm_tokens', {
    query: { select: 'token,wa,created_at', limit: 2000 },
  });
  const rows = Array.isArray(result) ? result : result.rows || [];
  const adminTokens = rows.filter((r: any) => r.wa === 'KHOCI');

  // Sort descending by created_at
  adminTokens.sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (adminTokens.length === 0) {
    console.error('Gagal mendapatkan token KHOCI');
    return;
  }

  let sent = false;
  for (const row of adminTokens) {
    const token = row.token;
    console.log('Mencoba token:', token.substring(0, 20) + '...');
    const res = await sendPushNotification(
      token,
      'Test ASJ Badge',
      'Notifikasi test badge dan ikon PWA',
      '/admin.html',
    );
    if (res) {
      console.log('{ acceptedByFcm: true } - Berhasil kirim ke token ini!');
      sent = true;
      // Jangan break, kirim ke semua token yang masih hidup
    } else {
      console.log('Gagal (mungkin token sudah mati / unregistered). Lanjut ke token berikutnya...');
    }
  }

  if (!sent) {
    console.log(
      'Semua token KHOCI gagal (unregistered). Silakan buka ASJ Portal lagi untuk generate token baru.',
    );
  }
  process.exit(0);
}

main();
