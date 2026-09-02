import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function query(table, wa) {
  const url = `${supabaseUrl}/rest/v1/${table}?no_wa=eq.${wa}&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  return res.json();
}

async function check() {
  const wa = '6282130442661';
  console.log(`Checking data for WA: ${wa}`);

  const cand = await query('database_candidate', wa);
  console.log('=== database_candidate ===');
  console.log(
    cand.map((c) => ({
      id: c.id,
      no_wa: c.no_wa,
      nama: c.nama_lengkap,
      folder: c.folder,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })),
  );

  const mdc = await query('master_database_candidate', wa);
  console.log('=== master_database_candidate ===');
  mdc.forEach((r) => {
    console.log(`- ${r.no_wa} | ${r.nama_lengkap} | Updated: ${r.updated_at}`);
    try {
      const json = JSON.parse(r.ai_data_json);
      console.log(
        `  ai_data_json preview: Wawancara = ${JSON.stringify(json?.wawancara)}, Bidang = ${JSON.stringify(json?.alasan_bidang)}`,
      );
    } catch (e) {
      console.log('  ai_data_json invalid format');
    }
  });

  const form = await query('database_asj_form', wa);
  console.log('=== database_asj_form (Mail/Lamaran) ===');
  console.log(
    form.map((f) => ({
      no_wa: f.no_wa,
      nama: f.nama,
      code_job: f.code_job,
      status_lulus: f.status_lulus,
    })),
  );

  // check duplicates
  const suffix = wa.slice(-8);
  const dupUrl = `${supabaseUrl}/rest/v1/database_candidate?no_wa=ilike.%25${suffix}%25&select=no_wa,nama_lengkap,created_at,updated_at`;
  const dupRes = await fetch(dupUrl, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  console.log('=== Duplicates ===');
  console.log(await dupRes.json());
}
check();
