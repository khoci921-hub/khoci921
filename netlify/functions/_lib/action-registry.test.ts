// ==========================================
// TESTS: action-registry — kontrak action backend.
// Registry (action-registry.js) adalah SATU-SATUNYA sumber kebenaran nama
// action. Test ini menjaga:
//   1. setiap handler terdaftar benar-benar fungsi;
//   2. grup rate limit hanya berisi action yang terdaftar;
//   3. SETIAP action yang dipanggil frontend (callAPI('x', ...)) ada di
//      registry — typo nama action gagal di sini, bukan di runtime produksi.
//   4. [REGRESSION 2026-08-22] Backend requireAdmin actions ada di frontend ADMIN_ACTIONS.
// ==========================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ACTION_HANDLERS, LOGIN_ACTIONS, AI_ACTIONS, FONNTE_ACTIONS } from './action-registry';

const ROOT = process.cwd();
const CALL_RE = /callAPI\(\s*['"]([^'"]+)['"]/g;

function walkJs(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const abs = join(dir, f);
    if (f.endsWith('.ts') && !f.includes('.test.')) out.push(abs);
    else if (!f.includes('.')) walkJs(abs, out);
  }
  return out;
}

// Semua literal action yang dipanggil frontend via callAPI.
function frontendActions() {
  const files = [
    ...walkJs(join(ROOT, 'js')),
    join(ROOT, 'api-client.ts'),
    join(ROOT, 'partials/modals-shared.html'),
  ];
  const found = new Set();
  for (const f of files) {
    if (!existsSync(f)) continue;
    const src = readFileSync(f, 'utf8');
    CALL_RE.lastIndex = 0;
    let m;
    while ((m = CALL_RE.exec(src)) !== null) found.add(m[1]);
  }
  return [...found].sort();
}

describe('ACTION_HANDLERS — isi registry', () => {
  it('semua nilai adalah fungsi (handler terdaftar benar)', () => {
    for (const [name, h] of Object.entries(ACTION_HANDLERS)) {
      expect(typeof h, `handler '${name}' harus fungsi`).toBe('function');
    }
  });

  it('tidak kosong dan tidak ada nama duplikat', () => {
    const names = Object.keys(ACTION_HANDLERS);
    expect(names.length).toBeGreaterThan(50);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('grup rate limit ⊆ registry', () => {
  for (const [label, set] of [
    ['LOGIN', LOGIN_ACTIONS],
    ['AI', AI_ACTIONS],
    ['FONNTE', FONNTE_ACTIONS],
  ]) {
    it(`${label}_ACTIONS hanya berisi action terdaftar`, () => {
      for (const a of set) {
        expect(ACTION_HANDLERS[a], `'${a}' harus ada di ACTION_HANDLERS`).toBeDefined();
      }
    });
  }
});

// Kunci-kunci literal di peta NETLIFY_FUNCTIONS (api-client.js) — routing
// action → nama function Netlify. Dari sumber karena peta ini PRIVATE.
function netlifyFunctionRoutes() {
  const src = readFileSync(join(ROOT, 'api-client.ts'), 'utf8');
  const block = src.match(/const NETLIFY_FUNCTIONS = \{([\s\S]*?)\n\};/);
  if (!block) return [];
  const keys = [];
  const re = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/gm;
  let m;
  while ((m = re.exec(block[1])) !== null) keys.push(m[1]);
  return keys;
}

describe('kontrak frontend → registry', () => {
  const front = frontendActions();
  it('menemukan action yang dipanggil frontend (sanity)', () => {
    expect(front.length).toBeGreaterThan(30);
  });

  it('setiap callAPI frontend ADA di registry backend', () => {
    // @ts-expect-error JS→TS migration
    const missing = front.filter((a) => !(a in ACTION_HANDLERS));
    expect(
      missing,
      'action dipanggil frontend tapi tidak terdaftar: ' + missing.join(', '),
    ).toEqual([]);
  });

  it('setiap callAPI frontend ADA di peta routing NETLIFY_FUNCTIONS', () => {
    const routes = new Set(netlifyFunctionRoutes());
    const missing = front.filter((a) => !routes.has(a));
    expect(
      missing,
      'action dipanggil frontend tapi tidak punya route NETLIFY_FUNCTIONS: ' + missing.join(', '),
    ).toEqual([]);
  });
});

// ─── REGRESSION: getMonthlyReport bug (2026-08-22) ──────────────────────
// Backend action yang pakai requireAdmin / requireRole(session, 'admin')
// WAJIB ada di ADMIN_ACTIONS (frontend) supaya session token dikirim.
// Kalau tidak, callAPI tanpa sessionToken → backend reject "Sesi tidak valid".

/** Parse ADMIN_ACTIONS from api-client.ts source (file-based, no TS import). */
function parseAdminActionsFromClient(): Set<string> {
  const src = readFileSync(join(ROOT, 'api-client.ts'), 'utf8');
  const block = src.match(/const ADMIN_ACTIONS = new Set\(\[([\s\S]*?)\]\);/);
  if (!block) return new Set();
  const names = new Set<string>();
  const re = /'([A-Za-z]+)'/g;
  let m;
  while ((m = re.exec(block[1])) !== null) names.add(m[1]);
  return names;
}

/**
 * Scan backend actions-*.ts for handler functions that use requireAdmin.
 * Simple approach: find "export async function handle..." lines,
 * then check if the next 80 lines contain requireAdmin/requireRole.
 */
function backendAdminActions(): string[] {
  const actionsDir = join(ROOT, 'netlify', 'functions', '_lib');
  const adminGuarded = new Set<string>();
  const files = readdirSync(actionsDir).filter(
    (f) => f.startsWith('actions-') && f.endsWith('.ts') && !f.includes('.test.'),
  );
  for (const f of files) {
    const src = readFileSync(join(actionsDir, f), 'utf8');
    // Find all handler function declarations
    const handlerRe = /(?:export\s+)?(?:async\s+)?function\s+(handle\w+)/g;
    let m;
    while ((m = handlerRe.exec(src)) !== null) {
      const handlerName = m[1];
      // Extract function body: from opening { to closing } at depth 0
      const afterFn = src.slice(m.index + m[0].length);
      const openIdx = afterFn.indexOf('{');
      if (openIdx < 0) continue;
      let depth = 0;
      let bodyEnd = -1;
      for (let i = openIdx; i < afterFn.length && i < openIdx + 5000; i++) {
        if (afterFn[i] === '{') depth++;
        if (afterFn[i] === '}') depth--;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
      const body = bodyEnd > 0 ? afterFn.slice(0, bodyEnd) : afterFn.slice(0, 3000);
      if (body.includes('requireAdmin') || body.includes("requireRole(sessionToken, 'admin')")) {
        const actionName = handlerName.startsWith('handle')
          ? handlerName.slice(6, 7).toLowerCase() + handlerName.slice(7)
          : handlerName;
        adminGuarded.add(actionName);
      }
    }
  }
  return [...adminGuarded];
}

describe('ADMIN_ACTIONS ⊇ backend admin-gated actions', () => {
  it('every backend requireAdmin action is in frontend ADMIN_ACTIONS', () => {
    const frontendAdmin = parseAdminActionsFromClient();
    expect(frontendAdmin.size).toBeGreaterThan(30); // sanity
    const backendAdmin = backendAdminActions();
    expect(backendAdmin.length).toBeGreaterThan(5); // sanity — there are many admin actions
    const missing = backendAdmin.filter((a) => !frontendAdmin.has(a));
    expect(
      missing,
      'Backend action requires admin session but frontend ADMIN_ACTIONS is missing: ' +
        missing.join(', ') +
        '. Without these, callAPI will NOT send sessionToken → backend rejects "Sesi tidak valid".',
    ).toEqual([]);
  });

  it('ADMIN_ACTIONS only contains actions that exist in ACTION_HANDLERS', () => {
    const frontendAdmin = parseAdminActionsFromClient();
    for (const a of frontendAdmin) {
      expect(
        ACTION_HANDLERS[a],
        `'${a}' is in ADMIN_ACTIONS but not in ACTION_HANDLERS — typo or removed handler?`,
      ).toBeDefined();
    }
  });
});
