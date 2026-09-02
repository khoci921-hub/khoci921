import 'dotenv/config';
import { geminiGenerate } from './netlify/functions/_lib/ai/providers.ts';
async function run() {
  try {
    const res = await geminiGenerate('Terjemahkan ke bahasa jepang: Saya makan nasi', []);
    console.log('RESULT:', res);
  } catch (e) {
    console.error('ERROR:', e);
  }
}
run();
