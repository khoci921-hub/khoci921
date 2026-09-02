// =============================================================
// Regression test XSS (REVIEW.md S1) — escape helper + render sink.
// -------------------------------------------------------------
// Memverifikasi bahwa data user-supplied (status/tahapan/kategori/
// lokasi/kode/syarat) yang dirender ke innerHTML SELALU lewat esc()
// / escJs(), supaya payload HTML/JS tidak bisa dieksekusi di panel
// admin maupun halaman publik (stored XSS).
//
// Bagian 1: helper global esc()/escJs() (definisi nyata di api-client.js).
// Bagian 2: render sink di js/05_render.js — memastikan pola render
//   tabel (mail, kandidat, db-job, loker publik) membungkus nilai
//   user-supplied dengan esc(...), bukan interpolasi langsung.
// =============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Definisi helper SAMA dengan api-client.js (satu-satunya sumber).
// Dipisah ke fungsi supaya bisa diuji langsung tanpa memuat global script.
function esc(x) {
  return String(x === null || x === undefined ? '' : x)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escJs(x) {
  return String(x === null || x === undefined ? '' : x)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\r\n\u2028\u2029]/g, ' ');
}

// Fase 2: js/05_render.js dipecah menjadi 5 modul per domain — gabungkan
// semuanya supaya assertion sink render di bawah tetap mencakup seluruh
// jalur render (mail, kandidat, admin, loker publik).
const RENDER_FILES = [
  'render/mail.ts',
  'render/candidate.ts',
  'render/admin.ts',
  'render/public.ts',
  'render/share.ts',
];
const renderSrc = RENDER_FILES.map((f) =>
  readFileSync(new URL('./' + f, import.meta.url), 'utf8'),
).join('\n');

// Simulasi parser HTML: entity diubah kembali ke karakter asli (parser
// HTML melakukan ini sebelum nilai atribut sampai ke engine JS).
function htmlDecode(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Uji lapisan JS: hasil escJs() diletakkan di dalam literal single-quoted
// (`'...'`) sebagaimana onclick="fn('...')". Harus PARSE sebagai satu
// string — payload tidak boleh menutup literal / memulai kode baru.
function parseAsJsStringLiteral(raw) {
  const js = htmlDecode(raw);
  const token = "'" + js + "'";
  try {
    return { value: Function('return ' + token)(), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
}

const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '"><script>alert(1)</script>',
  `' onmouseover='alert(1)'`,
  '<svg/onload=alert(1)>',
  '"; alert(1); //',
  'a<br>b',
  `\\' onerror=alert(1)`,
];

describe('esc() — teks & atribut HTML', () => {
  it('menetralkan payload HTML (tag/script/event handler)', () => {
    for (const p of PAYLOADS) {
      const out = esc(p);
      // Semua karakter pembentuk markup di-entity → tidak ada tag/atribut baru.
      expect(out).not.toContain('<');
      expect(out).not.toContain('>');
      expect(out).not.toContain('"');
      expect(out).not.toContain("'");
    }
  });

  it('payload menjadi teks (entity) di innerHTML, bukan elemen', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(esc('"><script>alert(1)</script>')).toBe(
      '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('tidak merusak data normal (nama/WA/teks biasa)', () => {
    expect(esc('Ahmad & Putra <3')).toBe('Ahmad &amp; Putra &lt;3');
    expect(esc('0812-3456')).toBe('0812-3456');
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('escJs() — nilai di dalam string JS onclick', () => {
  it('semua payload tetap BERADA DI DALAM literal string JS (parse sebagai satu string)', () => {
    for (const p of PAYLOADS) {
      const out = escJs(p);
      // Lapisan HTML: tidak ada kutip ganda mentah (atribut utuh) dan
      // tidak ada < > mentah (tidak ada tag baru).
      expect(out).not.toContain('"');
      expect(out).not.toContain('<');
      expect(out).not.toContain('>');
      // Lapisan JS: hasilnya harus parse sebagai satu string literal.
      const { value, error } = parseAsJsStringLiteral(out);
      expect(error).toBeNull();
      expect(typeof value).toBe('string');
    }
  });

  it('payload yang memakai \\ + kutip tidak bisa menutup literal', () => {
    const out = escJs(`\\' onerror=alert(1)`);
    const { value, error } = parseAsJsStringLiteral(out);
    expect(error).toBeNull();
    expect(value).toContain("' onerror=alert(1)");
  });

  it('membuang karakter pemisah baris JS (CR/LF/U+2028/U+2029)', () => {
    expect(escJs('a\nb')).toBe('a b');
    expect(escJs('a\rb')).toBe('a b');
    expect(escJs('a\u2028b')).toBe('a b');
    expect(escJs('a\u2029b')).toBe('a b');
  });
});

describe('Sink render js/render/* (S1 coverage)', () => {
  // Setiap nilai user-supplied yang dirender ke innerHTML tabel harus
  // dibungkus esc(...) / escJs(...). Kalau pola "mentah" di bawah muncul,
  // artinya ada regresi escape di jalur render tersebut.

  // Catatan Fase 3 (ESM): render/*.js kini modul ES — pemanggilan lintas file
  // memakai window.* eksplisit (`window.esc(window.trOption(...))`); mail.js
  // punya esc LOKAL sendiri di renderFormInbox (`esc(window.trOption(...))`).
  it('tabel mail (kategori & status) di-escape', () => {
    expect(renderSrc).toContain("esc(window.trOption(f.kategori || '-'))");
    expect(renderSrc).toContain('esc(window.trOption(displayStatus))');
  });

  it('tabel kandidat (tahapan & status) di-escape', () => {
    expect(renderSrc).toContain('window.esc(window.trOption(c.tahapan))');
    expect(renderSrc).toContain('window.esc(window.trOption(c.status))');
  });

  it('tabel db-job (kategori & lokasi) di-escape', () => {
    expect(renderSrc).toContain('window.esc(window.trOption(db.kategori))');
    expect(renderSrc).toContain('window.esc(window.trOption(db.lokasi))');
  });

  it('tabel loker publik (code, lokasi, syarat) di-escape', () => {
    expect(renderSrc).toContain('window.esc(j.code)');
    expect(renderSrc).toContain('window.esc(window.trOption(j.lokasi))');
    expect(renderSrc).toContain('return window.esc(window.trOption(s.trim()));');
  });

  it('badge status/tahapan (badgeTahapanDb) di-escape di sumber', () => {
    expect(renderSrc).toContain('var label = window.esc(window.trOption(t));');
  });

  it('argumen onclick selalu lewat escJs (tidak ada data mentah di onclick)', () => {
    // Contoh pola MENTAH yang tidak boleh ada: onclick="fn(' + c.wa + ')".
    const badPatterns = [
      /onclick="[^"]*'\s*\+\s*(j\.code|c\.wa|c\.nama|f\.wa|db\.code)\s*\+/,
      /onclick="[^"]*\$\{(c\.wa|c\.nama|j\.code)\}/,
    ];
    for (const re of badPatterns) expect(renderSrc).not.toMatch(re);
  });
});
