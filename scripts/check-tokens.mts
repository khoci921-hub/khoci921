import 'dotenv/config';
import { supabaseJson } from '../netlify/functions/_lib/db/client.ts';
async function run() {
  const result = await supabaseJson('GET', 'fcm_tokens', {
    query: { select: 'token,wa,created_at', limit: 2000 },
  });
  const rows = Array.isArray(result) ? result : result.rows || [];
  const adminTokens = rows.filter((r) => r.wa === 'KHOCI');
  console.log(JSON.stringify(adminTokens, null, 2));
  process.exit(0);
}
run();
