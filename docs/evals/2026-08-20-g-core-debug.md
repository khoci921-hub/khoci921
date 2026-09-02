# G Backend Core Debug Report — 2026-08-20

## G1. `handlers.js` — Backend Dispatcher

### Temuan:

| #   | Finding                                                                     | Severity | Fix                                                                   |
| --- | --------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| 1   | **No error boundary** — `dispatchAction()` doesn't try/catch handler errors | MEDIUM   | ✅ Add try/catch returning {success:false}                            |
| 2   | **Hardcoded Indonesian** — rate limit error message                         | LOW      | ⏭ Skip (API response, not user-facing; frontend calls it `res.error`) |
| 3   | **Hardcoded Indonesian** — `NOT_IMPLEMENTED` message                        | LOW      | ⏭ Skip (internal diagnostic, not user-facing)                         |

### Clean items:

- Rate limit: proper lockout support ✅
- `sessionIdentity()`: null-safe ✅
- `rateLimitChecks()`: all action groups covered ✅

---

## G2. `action-registry.js` — Action Registry

**Status: CLEAN** — Well-organized table dispatch, rate limit groups correct, no issues.

---

## G3. `session.js` — HMAC Session

**Status: CLEAN** — HMAC-SHA256, timingSafeEqual, no expiration. Fallback secret appropriate for dev only.

---

## G4. `rate-limit.js` — Rate Limiter

**Status: CLEAN** — In-memory buckets, pruning, lockout support. No issues.

---

## G5. `cache.js` — TTL Cache

**Status: CLEAN** — In-memory with TTL, eviction. No issues.

---

## G6. `env.js` — Environment Variables

**Status: CLEAN** — Whitelist-based, lazy file load, alias support. No issues.
