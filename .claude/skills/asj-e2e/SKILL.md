---
name: asj-e2e
description: >
  E2E testing for ASJ Portal using Playwright. USE FOR: writing new E2E tests,
  debugging E2E failures, running E2E suite, checking live site behavior via
  browser. Requires preview server running on port 3000. DO NOT USE FOR:
  unit tests (use bun run test), building (use asj-build), or general
  debugging (use asj-debug).
metadata:
  version: '1.0.0'
---

# ASJ E2E Testing Skill

E2E tests use Playwright (Node.js) against the running preview server.
Tests are in `e2e/` directory. Always start the preview server first.

## Prerequisites

```bash
# Start preview server (must be running before E2E)
node serve-static.mjs &
# Wait for "Server listening on port 3000"
```

## Running E2E tests

```bash
# All E2E tests
BASE_URL="http://localhost:3000" node e2e/upload-check.mjs
BASE_URL="http://localhost:3000" node e2e/biodata-check.mjs
BASE_URL="http://localhost:3000" node e2e/login-check.mjs

# Quick smoke check
BASE_URL="http://localhost:3000" node e2e/share-view.mjs
```

## Existing E2E tests

| Test                | What it checks                        |
| ------------------- | ------------------------------------- |
| `login-check.mjs`   | Login flow: public → kandidat → admin |
| `upload-check.mjs`  | File upload: KTP/KK via Cloudinary    |
| `biodata-check.mjs` | Biodata save + sync to DB             |
| `share-view.mjs`    | Public share page renders correctly   |

## Writing new E2E tests

Follow the pattern in existing tests:

```javascript
// e2e/my-test.mjs
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Navigate
    await page.goto(`${BASE_URL}/`);

    // 2. Interact
    await page.click('selector');

    // 3. Assert
    const result = await page.textContent('.selector');
    console.assert(result.includes('expected'), ' assertion failed');

    console.log('✅ Test passed');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runTest();
```

## Key selectors reference

| Element          | Selector               |
| ---------------- | ---------------------- |
| Admin login form | `#admin-pin-input`     |
| Kandidat login   | `#login-wa`            |
| Search kandidat  | `#search-kandidat`     |
| Filter table     | `#filter-db-job`       |
| Mail inbox tab   | `[data-tab="mail"]`    |
| Pelamar tab      | `[data-tab="pelamar"]` |
| Modal container  | `.modal-overlay`       |

## Debugging E2E failures

1. Run with `headless: false` to see browser:
   ```javascript
   const browser = await chromium.launch({ headless: false });
   ```
2. Add `await page.screenshot({ path: 'debug.png' });` to capture state
3. Check `page.on('console', msg => console.log(msg.text()))` for JS errors
4. Check `page.on('pageerror', err => console.error(err))` for page errors

## CI integration

E2E tests can be added to `.github/workflows/ci-check.yml`:

```yaml
- name: E2E tests
  run: |
    node serve-static.mjs &
    sleep 3
    BASE_URL="http://localhost:3000" node e2e/login-check.mjs
```

## When NOT to use this skill

If the task is "run the unit tests" → use `asj-build` (`bun run test`)
If the task is "fix this bug in the code" → use `asj-debug`
If the task is "build the project" → use `asj-build`
