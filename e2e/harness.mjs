// =============================================================
// e2e/harness.mjs — scaffolding BERSAMA skrip E2E (Playwright)
// -------------------------------------------------------------
// Dulu tiap skrip (login/upload/biodata/share) mengimplementasikan
// ulang failures/check/waitFor/launch — sekarang satu tempat.
// Skrip tinggal import { check, waitFor, launchBrowser, finish }.
// Default waitFor 15s; skrip yang butuh default lain bisa bungkus:
//   const waitFor = (c, t, i) => harnessWaitFor(c, t ?? 40000, i);
// =============================================================
import { chromium } from 'playwright';

export const BASE = process.env.BASE_URL || 'http://localhost:3000';

export let failures = 0;
export function check(name, cond, extra = '') {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ❌ ${name} ${extra}`);
    failures++;
  }
}

// Tunggu sampai condition() true (polling) — pengganti expect().toBeVisible
export async function waitFor(condition, timeoutMs = 15000, intervalMs = 300) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export function launchBrowser() {
  return chromium.launch();
}

export function finish() {
  console.log(`\n${failures === 0 ? '🎉 SEMUA LULUS' : `💥 ${failures} GAGAL`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
