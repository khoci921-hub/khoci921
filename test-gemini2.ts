import 'dotenv/config';
import { geminiGenerate, parseJsonLoose } from './netlify/functions/_lib/ai/providers.ts';
async function run() {
  const items = '1. Islam\n2. Belum ada rencana khusus';
  const NL = '\n';
  const prompt =
    'Terjemahkan Bahasa Indonesia ke Bahasa Jepang untuk CV kerja.' +
    NL +
    'Kembalikan JSON: ' +
    String.fromCharCode(123) +
    '"0":"jp0","1":"jp1",...' +
    String.fromCharCode(125) +
    ' tanpa teks lain.' +
    NL +
    NL +
    items;
  try {
    const res = await geminiGenerate(prompt, []);
    console.log('RESULT:', res);
    console.log('PARSED:', parseJsonLoose(res.reply));
  } catch (e) {
    console.error('ERROR:', e);
  }
}
run();
