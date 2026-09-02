import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function queryByName(table, name) {
  const url = `${supabaseUrl}/rest/v1/${table}?nama_lengkap=ilike.%25${name}%25&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  return res.json();
}

async function check() {
  const name = 'prayitno';
  console.log(`Checking data for Name: ${name}`);

  const cand = await queryByName('database_candidate', name);
  console.log('=== database_candidate ===');
  console.log(cand.map((c) => ({ wa: c.no_wa, nama: c.nama_lengkap })));

  const mdcUrl = `${supabaseUrl}/rest/v1/master_database_candidate?nama_lengkap=ilike.%25${name}%25&select=*`;
  const mdcRes = await fetch(mdcUrl, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const mdc = await mdcRes.json();
  console.log('=== master_database_candidate ===');
  console.log(mdc.map((c) => ({ wa: c.no_wa, nama: c.nama_lengkap })));
}
check();
