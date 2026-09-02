import { env } from '../env.ts';
// ai/providers.js — lapisan PROVIDER AI (Gemini) + helper parsing output AI.

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------
// Timeout per-model (ms): model yang menggantung tidak boleh menghabiskan
// budget fungsi Netlify (limit sinkron ±10 dtk) — kalau model pertama lambat/
// hang, langsung fallback ke model berikutnya.
const MODEL_TIMEOUT_MS = 7000;

// Model saat ini (Agt 2026): gemini-1.5-flash & 2.0-flash sudah dihapus Google (404),
// gemini-2.5-flash & 2.5-pro sudah tidak tersedia untuk key baru (404),
// gemini-flash-latest sering 503 "high demand" (lambat), gemini-3.5-flash
// respons 7-29 dtk (sering kena timeout Netlify 502). Pakai model LITE yang
// stabil & cepat (~0,6-1,3 dtk, dibuktikan 2026-08-16 vs Netlify lama
// asjportal.netlify.app yang respons ~1 dtk): gemini-3.5-flash-lite (pin,
// lolos SEMUA tes, paling stabil) dulu, lalu alias flash-lite-latest (ikut
// model terbaru; sesekali 503), terakhir flash penuh sebagai jaring pengaman.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];

// Gemini API menolak request yang berakhiran giliran model ("Requests ending
// with a model turn are not supported") — buang giliran model di akhir history
// sebelum dikirim (bisa terjadi kalau history frontend terakumulasi asinkron).
function trimTrailingModelTurn(contents) {
  const out = contents.slice();
  while (out.length > 1 && out[out.length - 1].role === 'model') out.pop();
  return out;
}

async function fetchGemini(model, key, contents) {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      model +
      ':generateContent?key=' +
      key,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    throw new Error('Gemini HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120));
  }
  const j = await res.json();
  return j &&
    j.candidates &&
    j.candidates[0] &&
    j.candidates[0].content &&
    j.candidates[0].content.parts
    ? j.candidates[0].content.parts.map((p) => p.text || '').join('')
    : '';
}

async function geminiGenerate(systemPrompt, history) {
  const key = env('GEMINI_API_KEY');
  if (!key) {
    return {
      reply:
        'Maaf, asisten AI belum dikonfigurasi (GEMINI_API_KEY belum diisi). Data kamu tetap aman tersimpan ya!',
    };
  }
  const contents = [{ role: 'user', parts: [{ text: systemPrompt }] }];
  for (const h of Array.isArray(history) ? history : []) {
    const role = h && h.role === 'assistant' ? 'model' : 'user';
    if (h && h.content) contents.push({ role, parts: [{ text: String(h.content) }] });
  }
  const body = trimTrailingModelTurn(contents);
  let lastErr = null;
  for (const model of MODELS) {
    try {
      const text = await fetchGemini(model, key, body);
      if (text) return { reply: text };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Gemini tidak tersedia');
}

async function geminiParseFile(systemPrompt, file) {
  const key = env('GEMINI_API_KEY');
  if (!key) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi');
  }
  const contents = [
    {
      role: 'user',
      parts: [{ inlineData: { mimeType: file.mimeType, data: file.data } }, { text: systemPrompt }],
    },
  ];
  let lastErr = null;
  for (const model of MODELS) {
    try {
      const text = await fetchGemini(model, key, contents);
      if (text) return text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Gemini tidak tersedia');
}

function parseJsonLoose(text) {
  let t = String(text || '').trim();
  t = t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch (e2) {
        /* fallthrough */
      }
    }
    throw e;
  }
}

export { geminiGenerate, geminiParseFile, parseJsonLoose };
