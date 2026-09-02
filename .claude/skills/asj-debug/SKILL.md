---
name: asj-debug
description: >
  Debug frontend and backend issues in ASJ Portal. USE FOR: fixing broken
  filters, modals, handlers, backend actions, auth issues, data sync problems,
  understanding code flow, investigating runtime errors. Starts with code
  reading (free), escalates to browser inspection only when code artifacts
  don't explain the issue. DO NOT USE FOR: running builds/tests (use asj-build),
  writing E2E tests (use asj-e2e).
metadata:
  version: '1.0.0'
---

# ASJ Debug Skill

Most debugging is a code-reading problem, not a browser problem. Start
by reading source files and logs — only open a browser when you genuinely
need to see the current live state.

## Debugging frontend issues

### Missing handler / ReferenceError

1. Check if the function is called from HTML inline handler
   (`onclick`, `onkeyup`, `onblur`, etc.)
2. Check if it's registered in `registerSeamAliases()` in
   `js/core/bridge.js` or in the module's own seam registration
3. Check `NETLIFY_FUNCTIONS` map in `api-client.js` if it calls backend
4. Verify with: `grep -r "functionName" js/` and
   `grep -r "functionName" *.html partials/`

### Filter not working

1. Check if filter function exists and is registered
2. Check debounce timer (minimum 250ms per AGENTS.md §7)
3. Check if data is loaded (`ALL_CANDIDATES`, `ALL_JOBS`, etc.)
4. Check `.toLowerCase()` guards for NULL fields

### Modal not opening

1. Check if modal HTML exists in `partials/modals-shared.html`
2. Check if open function is registered in seam
3. Check `adaModalTerbuka()` guard
4. Check console for ReferenceError

### ESM / import issues

1. Check `js/core/bridge.js` for alias registration
2. Check `AGENTS_REFERENCE.md` §ESM & Bridge for conventions
3. Run `bunx eslint --rule 'no-undef: error' <file>`

## Debugging backend issues

### Action not found ("Aksi tidak dikenal")

1. Check if action is in `dispatchAction` switch in `handlers.js`
2. Check if it's in `NETLIFY_FUNCTIONS` map in `api-client.js`
3. Check if it's in `ADMIN_ACTIONS` or `LOGIN_ACTIONS` for auth

### Auth / session issues

1. Check `session.js` for HMAC token generation
2. Check `ADMIN_NUMBERS` / `ASJ_ADMINS` env format
3. Check `refreshAdminSession` / `refreshKandidatSession` flow

### Data not syncing

1. Check `syncBiodataKeMail` calls in action handlers
2. Check `MASTER_FIELD_LABEL` for readable labels
3. Check Supabase data directly via preview curl

### Upload issues

1. Check Cloudinary preset `asjportal` is valid
2. Check `uploadToCloudinary()` in `js/cloudinary.js`
3. Check `resolveFileUrl()` in `netlify/functions/_lib/storage.js`

## Reading logs and artifacts

```bash
# Preview server logs
freebuff-preview logs

# Check build output
ls -la assets/app-*.js

# Check SW version
grep "VERSION" sw.js

# Test backend action directly
curl -s -X POST http://localhost:3000/.netlify/functions/app \
  -H 'Content-Type: application/json' \
  -d '{"action":"loginKandidat","payload":["6281234567890","1234"]}'
```

## When to escalate to browser

Only after reading code and logs doesn't explain the issue:

- Live page structure changed and code doesn't reflect current DOM
- Timing/race condition needs live observation
- Visual layout issue not apparent from code

## Key files reference

| Issue             | File to check                                      |
| ----------------- | -------------------------------------------------- |
| Handler missing   | `js/core/bridge.js` (seam aliases)                 |
| Backend action    | `netlify/functions/_lib/handlers.js`               |
| Frontend API call | `api-client.js` (NETLIFY_FUNCTIONS map)            |
| Auth              | `netlify/functions/_lib/session.js`                |
| WA format         | `js/04_auth.js` (normalizeWaInput, isValidWaInput) |
| i18n              | `i18n/` directory                                  |
| Build             | `scripts/build-*.mjs`                              |
