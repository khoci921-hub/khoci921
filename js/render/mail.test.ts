// ==========================================
// TESTS: js/render/mail.js — renderFormInbox jalur f.docs (regresi hoisting)
// ==========================================
// Bug 2026-08-17: `var esc = function...` dideklarasi SETELAH pemakaian
// `esc(dc.nama)` di dalam forEach(f.docs) — hoisting membuat esc = undefined
// → TypeError "f is not a function" (Error Render) saat ada lamaran dengan
// dokumen tambahan. Fix: deklarasi dipindah ke atas. Test ini memaksa jalur
// f.docs non-kosong berjalan dan memverifikasi output ter-escape + tidak throw.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// esc() definisi SAMA dengan api-client.js (satu-satunya sumber).
function esc(x) {
  return String(x === null || x === undefined ? '' : x)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

describe('renderFormInbox — jalur dokumen tambahan (f.docs)', () => {
  let mail;
  let state;
  let tb;

  beforeAll(async () => {
    // bridge.js/api-client.js/i18n.js mengeksekusi window.* di module scope
    // → stub global SEBELUM dynamic import.
    const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const win = {
      localStorage: ls,
      addEventListener: () => {},
      esc,
      escJs: (x) => esc(x),
    };
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('document', {
      getElementById: () => tb,
      addEventListener: () => {},
    });
    tb = { innerHTML: '', style: {} };
    mail = await import('./mail.js');
    state = await import('../init/state.js');
  });

  beforeEach(() => {
    tb.innerHTML = '';
    // isi ulang state publik yang dibaca renderFormInbox. Export state.js
    // adalah live binding readonly — tulis lewat window accessor (bridgeState)
    // yang mendelegasikan ke binding modul yang sama.
    const arr = state.ALL_FORM;
    arr.length = 0;
    window.mailFilterStatus = 'ALL';
    window.mailSearchText = '';
  });

  it('TIDAK throw saat ada lamaran dengan f.docs non-kosong (jalur bug)', () => {
    const f = {
      rowIndex: 0,
      nama: 'Ahmad <b>Santoso</b>',
      wa: '6281234567890',
      code: 'JOB-001',
      status: 'MENUNGGU',
      docs: [
        { nama: 'KTP.png', url: 'https://cdn.example.com/ktp.png' },
        { nama: 'CV <script>', url: 'https://cdn.example.com/cv.pdf' },
      ],
    };
    state.ALL_FORM.push(f);
    expect(() => mail.renderFormInbox()).not.toThrow();
  });

  it('nama dokumen tambahan di-escape (payload HTML tidak terekseskusi)', () => {
    state.ALL_FORM.push({
      rowIndex: 0,
      nama: 'Budi',
      wa: '6281234567891',
      code: 'JOB-002',
      status: 'MENUNGGU',
      docs: [{ nama: '<img src=x onerror=alert(1)>', url: 'https://cdn.example.com/x.pdf' }],
    });
    mail.renderFormInbox();
    expect(tb.innerHTML).not.toContain('<img src=x');
    expect(tb.innerHTML).toContain('&lt;img src=x');
  });

  it('baris tanpa docs tetap dirender normal', () => {
    state.ALL_FORM.push({
      rowIndex: 0,
      nama: 'Citra',
      wa: '6281234567892',
      code: 'JOB-003',
      status: 'LULUS',
    });
    expect(() => mail.renderFormInbox()).not.toThrow();
    expect(tb.innerHTML).toContain('Citra');
  });
});
