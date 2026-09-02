// =============================================================================
// check-i18n.mjs — Guard duplikat key LINTAS FILE (Fase 4)
// -----------------------------------------------------------------------------
// Setelah i18n/locales/{id,jp}.js dipecah per domain (i18n/locales/{id,jp}/),
// index.js menggabungkan lewat spread (`...domain`). Kalau satu domain
// didefinisikan di 2+ file fragment, spread akan DIAM-DIAM menimpa — skrip
// ini mencegahnya, plus memastikan struktur id ↔ jp sejajar:
//   1. tiap file fragment mengekspor PERSIS 1 konstanta objek;
//   2. objek itu berisi PERSIS 1 domain top-level;
//   3. tidak ada domain yang muncul di 2+ file (duplikat lintas file);
//   4. index.js memuat SEMUA domain fragment (tidak ada fragment terlupa);
//   5. set domain id == set domain jp (paritas struktur).
// Paritas LEAF key id↔jp tetap diuji runtime oleh i18n.test.js (vitest).
//
// Jalankan: bun run check:i18n  (ikut dalam `bun run lint`)
// =============================================================================
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const LOC = join(process.cwd(), 'i18n', 'locales');

async function loadLang(lang) {
  const dir = join(LOC, lang);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort();
  const domains = new Map(); // domain -> file fragment

  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const names = Object.keys(mod);
    if (names.length !== 1) {
      throw new Error(
        `${lang}/${f}: harus mengekspor PERSIS 1 konstanta objek (dapat: ${names.join(', ') || 'tidak ada'})`,
      );
    }
    const obj = mod[names[0]];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error(`${lang}/${f}: export "${names[0]}" harus object literal`);
    }
    const keys = Object.keys(obj);
    if (keys.length !== 1) {
      throw new Error(
        `${lang}/${f}: objek "${names[0]}" harus berisi PERSIS 1 domain top-level (dapat: ${keys.join(', ')})`,
      );
    }
    const domain = keys[0];
    if (domains.has(domain)) {
      throw new Error(
        `DUPLIKAT lintas file: domain "${domain}" ada di ${domains.get(domain)} DAN ${f} — spread-merge di index.js akan menimpa diam-diam!`,
      );
    }
    domains.set(domain, f);
  }

  // index.js: gabungan harus memuat semua domain fragment (dan tidak lebih).
  const idxMod = await import(pathToFileURL(join(dir, 'index.js')).href);
  const merged = idxMod[lang];
  if (!merged || typeof merged !== 'object') {
    throw new Error(`${lang}/index.js: export "${lang}" harus object`);
  }
  const missing = [...domains.keys()].filter((d) => !(d in merged));
  if (missing.length) {
    throw new Error(
      `${lang}/index.js: domain tidak di-import (hilang dari gabungan): ${missing.join(', ')}`,
    );
  }
  const extra = Object.keys(merged).filter((d) => !domains.has(d));
  if (extra.length) {
    throw new Error(`${lang}/index.js: domain ekstra tanpa file fragment: ${extra.join(', ')}`);
  }
  return { files, domains };
}

async function main() {
  const id = await loadLang('id');
  const jp = await loadLang('jp');
  const idDomains = [...id.domains.keys()].sort().join(',');
  const jpDomains = [...jp.domains.keys()].sort().join(',');
  if (idDomains !== jpDomains) {
    throw new Error(`Set domain id ≠ jp:\n  id: ${idDomains}\n  jp: ${jpDomains}`);
  }
  console.log(
    `[check-i18n] OK — id ${id.files.length} file / jp ${jp.files.length} file, ` +
      `${id.domains.size} domain, nol duplikat lintas file, paritas id↔jp ✓`,
  );
}

main().catch((e) => {
  console.error('[check-i18n] ✖ ' + e.message);
  process.exit(1);
});
