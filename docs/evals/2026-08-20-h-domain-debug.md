# H Backend Domain Actions Debug Report — 2026-08-20

## Critical Finding

### H1. `actions-public.js` — `requireAdmin` NOT IMPORTED (BUG)

**File:** `netlify/functions/_lib/actions-public.js` line 484
**Impact:** `handleGetMonthlyReport()` will throw `ReferenceError: requireAdmin is not defined` at runtime when admin clicks monthly report.
**Severity:** HIGH — crash on admin action
**Fix:** Add `const { requireAdmin } = require('./actions-auth');` to imports

### Other files verified:

- H2 `actions-auth.js`: `requireAdmin` exported correctly ✅
- H3 `actions-candidate.js`: imports `requireAdmin` ✅
- H4 `actions-mail.js`: imports `requireAdmin` ✅
- H5 `actions-upload.js`: imports `requireRole`, `isOwnerOrAdmin` ✅
- H7 `actions-master.js`: imports `requireRole` ✅
- H8 `actions-schedule.js`: imports `requireRole` ✅
- H9 `actions-wa.js`: imports `requireRole` ✅
- H10 `actions-config.js`: imports `requireRole` ✅
- H13 `actions-diagnostics.js`: imports `requireAdmin` ✅

## Low-priority findings (all backend domain files):

- Hardcoded Indonesian error messages in catch blocks — backend API responses, not user-facing UI text
- Silent catch blocks for non-critical operations (mail sync, FCM) — intentional
