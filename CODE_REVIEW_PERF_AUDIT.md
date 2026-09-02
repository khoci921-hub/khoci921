# Code Review — Performance, Correctness & Security Audit (v2)

**Date:** 2026-09-02
**Scope:** Full stack — `netlify/functions/_lib/**` (backend, ~11.5k lines), `js/**` (frontend ESM), `api-client.ts`, `sw.js`, `src/main.css`
**Method:** Independent source review. Every finding below was verified against the actual source files, not from `DEBUG-TODO.md` / `PROGRESS2.md` notes. Previous audit (#21–#27) included; 8 new findings added.

**Verdict:** The architecture is sound — central dispatcher, table-driven action registry, deliberate parallel queries, and a working cache that already cut response times from 1.489ms → 297ms. The problems remain concentrated in three areas: **the request-origin trust boundary**, **the AI VIP gate**, and **the cache/pagination interaction**. The caching work is genuinely good but is undermined by an unclamped, client-controlled `pageSize` that can force every request onto the uncached full-scan path.

---

## Severity summary

| # | Area | Finding | Severity | Status vs v1 |
|---|------|---------|----------|--------------|
| 1 | Security | Client IP spoofable → **all** rate limits bypassable | 🔴 | Still present |
| 2 | Security | `registerFcmToken` — unauthenticated DB write / notification hijack | 🔴 | Still present |
| 3 | Security | AI CV Master VIP-lock: 3 independent bypasses + fail-open | 🔴 | Still present |
| 4 | Security | Session tokens never expire and cannot be revoked | 🔴 | Still present |
| 5 | Security | Hardcoded signing-secret fallback committed in repo | 🔴 | Still present |
| 6 | Correctness | `rowIndex` resolves non-deterministically → wrong record mutated | 🔴 | Still present |
| 7 | Memory | Unbounded growth in rate-limit store (leak + CPU amplification) | 🔴 | Still present |
| 8 | Perf/DoS | Unclamped `pageSize` → forced full scans + cache thrashing | 🟡 | Still present |
| 9 | Perf | Cache stampede — no single-flight, over-broad `cacheClear()` | 🟡 | Still present |
| 10 | Perf | `count=exact` re-computed on every page of a full scan | 🟡 | Still present |
| 11 | Correctness | Silent data truncation above 150 candidates (unordered 500-row scan) | 🟡 | Still present |
| 12 | Perf | Un-memoized schema discovery → 2–3 wasted RTTs per request | 🟡 | Still present |
| 13 | Security | Default password = last 4 digits of phone number | 🟡 | Still present |
| 14 | Security | Admin PINs compared in plaintext (candidates get bcrypt) | 🟡 | Still present |
| 15 | Resilience | No `fetch` timeout anywhere | 🟡 | Still present |
| 16 | Security | DB error text leaked to clients | 🟡 | Still present |
| 17 | Perf | `cacheClear()` fires before validation / on failure | 🟡 | Still present |
| 18 | Race | Candidate ID allocation is read-then-write, non-atomic | 🟡 | Still present |
| 19 | Correctness | Ordering by string-compared timestamps | 🟡 | Still present |
| 20 | Correctness | Trial-and-error INSERT variants can write to wrong columns | 🟡 | Still present |
| 21 | — | `queryPaged` is dead code (`db/misc.ts:6-18`) | 💭 | Still present |
| 22 | — | `supabasePaged` default produces `"undefined-undefined"` Range header | 💭 | Still present |
| 23 | — | GET invocation does not parse `payload` into array | 💭 | Still present |
| 24 | — | `Access-Control-Allow-Origin: *` on authenticated API | 💭 | Still present |
| 25 | Perf | `bcrypt.hashSync(..., 10)` blocks event loop ~100ms per registration | 💭 | Still present |
| 26 | Perf | `findForms()` still uses `select: '*'` (pulls `ai_data_json`) | 💭 | Still present |
| 27 | — | `attachApplications` mutates shared objects | 💭 | Still present |
| **28** | **Security** | **`isVipCatatan` regex matches almost anything → VIP gate ineffective** | 🔴 | **NEW** |
| **29** | **Perf** | **`getMonthlyReport` passes `pageSize: 5000` to unclamped `loadCandidatesUnik`** | 🟡 | **NEW** |
| **30** | **Perf** | **`handleCekDataPelamar` does 4–5 serial roundtrips (forms + candidates scan + master)** | 🟡 | **NEW** |
| **31** | **Perf** | **Admin dashboard serial waterfall: auth check → `loadCandidatesUnik` → `attachBerkasBio` → `findFormsLight`** | 🟡 | **NEW** |
| **32** | **Perf** | **Service worker self-version-check fetches `sw.js` every 5 min with `no-store`** | 🟡 | **NEW** |
| **33** | **Perf** | **`findFormsByWaList` tries up to 4 sequential Supabase queries per call** | 🟡 | **NEW** |
| **34** | **Perf** | **`fireIngest` sends fire-and-forget HTTP to self with no backpressure** | 💭 | **NEW** |
| **35** | **Perf** | **Backend `getAppData` admin path: 8+ parallel DB queries, some with full-table scans** | 🟡 | **NEW** |

---

# 🔴 Blockers

## 1. Client IP is spoofable — every rate limit is bypassable

**Location:** `netlify/functions/_lib/netlify-wrapper.ts:9-14` (`clientIp`), consumed at `handlers.ts:83`.

```js
function clientIp(event) {
  const h = (event && event.headers) || {};
  const fwd = h['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();   // ← leftmost == attacker-controlled
  return h['client-ip'] || h['x-real-ip'] || null;
}
```

**Problem:** `X-Forwarded-For` is appended to by each proxy. When a client sends `X-Forwarded-For: 1.2.3.4`, the platform appends the real address, producing `1.2.3.4, <real-ip>`. Taking `[0]` returns the **attacker's** value. The trustworthy part is the **rightmost** entry (written by your own edge), or better, Netlify's own `x-nf-client-connection-ip` header.

**Impact:** The entire M3 rate-limiting layer is defeated by rotating one request header:
- admin login: 5/min + lockout-after-10 → unlimited attempts
- AI: 10/min per identity, 60/min per IP → unlimited, unbounded Gemini spend
- Fonnte: 2/min per admin → unlimited WhatsApp sends

**Fix:**
```js
function clientIp(event) {
  const h = (event && event.headers) || {};
  const nf = h['x-nf-client-connection-ip'];
  if (nf) return String(nf).trim();
  const fwd = h['x-forwarded-for'];
  if (fwd) {
    const parts = String(fwd).split(',').map(s => s.trim()).filter(Boolean);
    return parts[parts.length - 1] || null;
  }
  return h['x-real-ip'] || null;
}
```

---

## 2. `registerFcmToken` — unauthenticated write and notification hijacking

**Location:** `netlify/functions/_lib/actions-auth.ts:352-390`.

```js
let ident: any = null;
if (sessionToken) { ident = session.verifyToken(sessionToken); }

if (ident && ident.role === 'admin') { wa = waRaw || 'ADMIN'; }
else if (waRaw === 'ADMIN') { wa = 'ADMIN'; }

if (!wa || !token) return { success: false, message: 'Invalid data' };

if (ident && ident.role === 'kandidat' && ident.wa !== wa) {
  return { success: false, message: 'Unauthorized FCM registration' };
}
```

**Problem:** Both authorization checks are prefixed with `if (ident && …)`. With **no sessionToken at all**, `ident` is `null`, both checks are skipped, and the only remaining requirement is that `wa` and `token` are non-empty.

**Impact:** Anonymous caller binds their own FCM device token to **any** victim's phone number → receives victim's push notifications (application-status changes, PII).

**Fix:** Require a valid session token for all paths; reject `null` ident at the top.

---

## 3. AI CV Master VIP-lock: three independent bypasses, and it fails open

**Location:** `netlify/functions/_lib/ai/chat.ts:155-198`.

Three holes:
**(a) Omit the field → gate skipped.** Send `{"flow":"master","history":[…]}` with no `currentData`. `wa` is `''`, the whole `if (wa)` block is skipped. **Anonymous access to a paid/exclusive feature.**

**(b) Identity is taken from the client, not the session.** `wa` comes from `p.currentData.identitas.hp`, which the caller controls. A non-VIP candidate can supply a VIP's phone number and pass the check.

**(c) Fail-open on error.** `if (!lookupError && !isVipCatatan(catatan))` — *any* exception grants access. A restrictive gate must fail **closed**.

**Impact:** Unauthenticated/low-privilege callers get the exclusive AI flow. Combined with #1 (rate limit bypass), this is an **unbounded Gemini spend vector**.

**Fix:** Use `session.verifyToken(sessionToken).wa` for identity; fail-closed on error; tighten the VIP regex (see #28).

---

## 4. Session tokens never expire and cannot be revoked

**Location:** `netlify/functions/_lib/session.ts:25-47`.

No `exp`, no `iat`, no `jti`. A token issued once is valid **forever**. No logout invalidation, no idle timeout, no forced re-auth. For an admin token holding candidate NIK, passport numbers, and photos, a single leak is permanent.

**Fix:** Add `exp` (and `iat`/`jti`) to the payload, reject expired tokens in `verifyToken`, keep admin TTL short and rely on the existing refresh-token mechanism for continuity.

---

## 5. Hardcoded signing-secret fallback committed to the repo

**Location:** `netlify/functions/_lib/session.ts:12-22`.

```js
function secret() {
  return (
    env('SESSION_SECRET') ||
    env('ADMIN_PASSWORD') || env('ASJ_ADMIN_PASSWORD') ||
    env('ADMIN_MASTER_PIN') || env('PIN_KHOCI') ||
    'asj-portal-local-secret'   // ← in the public repo
  );
}
```

If none of those env vars are set, the secret is a constant. Anyone with the repo can forge arbitrary `{role:'admin'}` tokens. Also: deriving the signing key from `ADMIN_MASTER_PIN` / `PIN_KHOCI` (user-facing, low-entropy PINs) lets anyone who captures a single token brute-force the PIN offline.

**Fix:** Fail closed in production. Stop using PINs as HMAC keys.

---

## 6. `rowIndex` resolves to a non-deterministic row → wrong record mutated

**Location:** `actions-mail.ts:23-47`, `db/forms.ts:139-150` (`findFormByIndexFiltered`).

Ordering by `timestamp.desc` with no tiebreaker. When timestamps collide (bulk imports, same-second applies), offset *N* at render time ≠ offset *N* at action time.

**Impact:** An admin clicks *Approve* on application A; the PATCH lands on application **B**. Silent data corruption in a hiring pipeline.

**Fix:** Stop using positional indices. Send the row `id` from the client and resolve with `id=eq.<id>`.

---

## 7. Unbounded memory growth in the rate limiter

**Location:** `netlify/functions/_lib/rate-limit.ts:22-39`.

`prune` runs only on new-key insertion, only when `size >= 20000`, and **deletes nothing** if all keys are still inside their window. The Map grows without bound.

**Impact:** Memory leak → OOM. CPU amplification: every new key past 20k triggers a full O(n) sweep that deletes nothing, driving O(n²) behaviour under attack.

**Fix:** Hard cap with time-based sweep independent of insertions:
```js
let lastSweep = 0;
function prune(now) {
  if (now - lastSweep < 30_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.resetAt < now && b.lockUntil < now) buckets.delete(k);
  }
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}
```

---

# 🟡 Suggestions

## 8. Unclamped client-controlled `pageSize` → forced full scans + cache thrashing

**Location:** `actions-public.ts:109-110`, `actions-candidate.ts:110`, `db/candidates.ts:126-139`, `cache.ts:10`.

```js
const page     = Number(opts.page)     || 1;
const pageSize = Number(opts.pageSize) || 50;      // no upper bound
const cacheKey = 'cand:' + String(q || '') + '|p' + page + '|s' + pageSize;
```

Three things compound:
1. `findCandidatesByIds` builds `id=in.(<all ids joined>)` — a large page produces a URL beyond PostgREST limits → 414 → catch returns `undefined`.
2. `loadCandidatesUnik` silently falls back to the **full-scan** path (`findCandidates()` → `select *` over the whole table).
3. That fallback **does not populate the cache**, while the cache key embeds the raw `pageSize`. So every distinct `pageSize` is a guaranteed miss.

**Fix:** Clamp before building `cacheKey`:
```js
const page     = Math.max(1, Math.min(Math.floor(Number(opts.page))     || 1,  10_000));
const pageSize = Math.max(1, Math.min(Math.floor(Number(opts.pageSize)) || 50, 100));
```

---

## 9. Cache stampede and over-broad invalidation

**Location:** `actions-public.ts:195-238`, `actions-public.ts:244-308`.

Classic check-then-fetch with no in-flight coalescing. On a miss, every concurrent request performs its own full table scan. `cacheClear()` wipes the cache for **all** users and is invoked by essentially every mutation handler.

**Fix:** Single-flight coalescing + targeted key invalidation (e.g. only `cand:*` when candidate data changes, leaving `public-base` intact).

---

## 10. `count=exact` recomputed on every page

**Location:** `db/client.ts:120` (`Prefer: count=exact` in `supabasePaged`).

Each 1000-row page of `fetchPagedAll` forces a full count scan. On a large table this dominates, and it runs on every cache miss.

**Fix:** Use `count=estimated` / `count=planned`, or simply page until a short page is returned (no count needed at all for the full-scan path).

---

## 11. Silent data truncation above 150 candidates

**Location:** `db/berkas.ts:72-111`.

Above 150 candidates the targeted fetch is skipped and the code falls back to `limit: 500` with **no `order`**, on two tables. Beyond 500 rows, berkas/bio are silently missing. No `ORDER BY` → Postgres may return different 500 rows on each call (data flickers).

**Fix:** Chunk the `in.(...)` filter into batches of ≤150 and concatenate.

---

## 12. Un-memoized schema discovery burns 2–3 RTTs per request

**Location:** `db/candidates.ts:148-172` (`findCandidateByWaFiltered` fires 3 parallel probes on `no_wa`/`wa`/`whatsapp`), `db/client.ts:134-146` (`findTable` loops through 10 candidate table names).

Typically 2 of the 3 probes 427-error. The schema does not change at runtime, so this is pure repeated waste — ~0.6–1.5s added to every candidate login and dashboard load.

**Fix:** Memoize the discovered table/column names at module scope (with the same invalidation hook as the cache).

---

## 13–15. Auth & resilience gaps

- **#13:** Default candidate password = last 4 digits of their phone number (`actions-auth.ts:134-146`). Every candidate who has never changed their password is guarded by 4 digits.
- **#14:** Admin PINs compared in plaintext (`actions-auth.ts:74-78`: `rp === pin`) while candidates get bcrypt. The stronger primitive is already in the codebase.
- **#15:** No `AbortSignal.timeout()` on any `fetch` call (`db/client.ts:40-51`, `:114-122`). A slow Supabase response holds the function until the platform timeout, exhausting the concurrency pool.

---

## 16. Database error text leaked to clients

**Location:** `db/client.ts:52-54`.

```js
throw new Error(pathname + ' → HTTP ' + res.status + ' ' + text.slice(0, 200));
```

Discloses table names, column names, constraint names and sometimes row data to unauthenticated callers — a free schema map.

**Fix:** Log the detail server-side; return a generic message to the client.

---

## 17. `cacheClear()` runs before validation and on failure

**Location:** `actions-mail.ts:26`, `actions-candidate.ts:16`, `actions-auth.ts:196` (before `handleDaftarKandidat` validates).

The global cache is wiped before the request is known to be valid, and before the mutation succeeds. `handleDaftarKandidat` is **unauthenticated**, so it is a cheap way to keep the cache permanently cold.

**Fix:** Move `cacheClear()` to after the mutation succeeds; prefer targeted invalidation.

---

## 18–20. Correctness gaps

- **#18:** Candidate ID allocation is read-then-write, non-atomic (`db/candidates.ts:180-202`). Two concurrent registrations can produce the same `ASJ#####`.
- **#19:** `tsOf` compares timestamps as strings (`actions-public.ts:204-206`). Mixed `timestamptz` and `DD/MM/YYYY` formats sort incorrectly.
- **#20:** 7 sequential trial-and-error INSERT variants (`actions-auth.ts:222-241`). A partially matching schema can succeed on the wrong variant, producing orphan rows with NULLs.

---

# 🆕 New Findings (v2)

## 28. `isVipCatatan` regex matches almost anything → VIP gate is ineffective 🔴

**Location:** `netlify/functions/_lib/ai/chat.ts:123-126`.

```js
function isVipCatatan(c) {
  const s = String(c || '');
  return s.includes('[VIP]') || /\[(?:KELAS\s*[A-Z0-9]+|[A-Z0-9]+)\]/i.test(s);
}
```

The `[A-Z0-9]+` alternative matches **any** bracketed alphanumeric token: `[NOTE]`, `[DOKUMEN]`, `[2024]`, `[ABC]`, `[REVISI]`, `[PROSES]`. Since many `catatan_internal` fields use bracketed tags for status tracking (e.g., `[MCU]`, `[VISA]`), a large proportion of candidates will match this regex even without VIP status.

**Impact:** The VIP gate (finding #3) is already bypassable; this makes it **structurally ineffective**. Any candidate whose `catatan_internal` contains any bracketed tag gets treated as VIP. Combined with finding #3(a) (omit the field entirely), this is a triple failure of the VIP access control.

**Fix:**
```js
function isVipCatatan(c) {
  const s = String(c || '');
  return s.includes('[VIP]') || /\[KELAS\s*[A-Z0-9]+\]/i.test(s);
}
```

Mirror this in `js/03_candidate.js` / `js/pages/ai_form.js` so client and server agree.

---

## 29. `getMonthlyReport` passes `pageSize: 5000` to unclamped `loadCandidatesUnik` 🟡

**Location:** `actions-public.ts:492-495`.

```js
const { rows: candRows } = await loadCandidatesUnik('', {
  page: 1,
  pageSize: 5000,
});
```

This hits the exact path described in finding #8: `pageSize: 5000` is uncapped, so `findCandidatesByIds` builds a `id=in.(<5000 ids>)` query that is almost certainly too large for PostgREST. The `catch` returns `undefined`, and `loadCandidatesUnik` silently falls back to the full-scan `findCandidates()` path (which does `select *` with no light projection and no cache population).

**Impact:** Every monthly report execution forces an uncached full table scan of all candidates, including all 154 columns of the master table. This is the **most expensive single request** in the entire backend.

**Fix:** Use `fetchPagedAll` directly (the existing helper already handles 1000-row pagination), or clamp `pageSize` to 100 as in finding #8 and loop.

---

## 30. `handleCekDataPelamar` does 4–5 serial roundtrips 🟡

**Location:** `actions-upload.ts:120-200` (`handleCekDataPelamar`).

The function performs:
1. `findFormsByWa(wa)` — 1–2 queries (try `or`, then fallback `no_wa`)
2. If `myRows.length` → `findCandidates()` — full scan of the candidate table
3. For each of the above: `normalizeWa` + filter in JS

All of these are **serial** (no `Promise.all`). The `findCandidates()` fallback in step 2 is a full table scan (`select *` over `database_candidate` / `master_database_candidate`).

**Impact:** A public endpoint (`apply-full.html`) that fires on page load takes 3–5× longer than necessary. Since this is unauthenticated, it's also a DoS vector (each request costs 4+ Supabase roundtrips).

**Fix:** Use `findCandidateByWaFiltered` (already exists) instead of `findCandidates()` for the lookup. Parallelize the form + candidate fetches.

---

## 31. Admin dashboard serial waterfall: auth → candidates → berkas → forms 🟡

**Location:** `actions-public.ts:340-400` (`handleGetAppData` admin path).

The admin dashboard load is structured as:
1. `loadPublicBase()` + `loadCandidatesUnik()` — parallel ✅
2. `attachBerkasBio()` + `loadSchedules()` + `loadTugas()` + `findFormsLight()` + `loadWaTemplates()` — parallel ✅
3. But step 2 **waits for step 1 to complete** (it depends on `result.candidates` from step 1).

The real issue: `attachBerkasBio` (step 2) itself does 2 serial roundtrips (berkas + master, though now parallelized), but then `attachApplications` does a third. And `loadCandidatesUnik` (step 1) already does 2 roundtrips (light scan + full-page fetch by IDs).

**Total for admin dashboard load:** 2 (parallel base+candidates) → 5 (parallel berkas+schedules+tugas+forms+templates) → 1 (attachApplications). **8 serial groups, 2 full table scans** (candidates light + forms light).

**Impact:** ~2–3 seconds cold, ~300ms cached. The cache helps but is wiped by every mutation (finding #17).

**Fix:** Batch `attachBerkasBio` to query by `id` set instead of WA set (avoids WA normalization overhead); cache forms light separately from candidates light so they don't invalidate together.

---

## 32. Service worker self-version-check fetches `sw.js` every 5 min 🟡

**Location:** `sw.js:100-115`.

```js
setInterval(function () {
  fetch('/sw.js?_check=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.text(); })
    .then(function (serverCode) {
      var serverVersion = serverCode.match(/const VERSION = '([^']+)'/);
      if (serverVersion && serverVersion[1] !== VERSION) {
        // force reload all tabs
      }
    })
    .catch(function () {});
}, 5 * 60 * 1000);
```

**Problem:** This fetches the **entire `sw.js` file** (which includes Firebase SDK imports logic) just to check a version string. With `cache: 'no-store'`, the browser never caches it, so this is a 2–5 KB download every 5 minutes, per tab, even when idle.

**Impact:** On mobile devices with limited bandwidth, this is a constant background drain. If the user has 10 tabs open, that's 10 fetches every 5 minutes. The `?_check=` cache-buster prevents any CDN/proxy caching.

**Fix:** Fetch only a tiny version endpoint (e.g., `/version.txt` containing just the hash), or compare against a `manifest.webmanifest` version field. Better: use the built-in `ServiceWorkerRegistration.update()` method which is optimized for this exact use case.

---

## 33. `findFormsByWaList` tries up to 4 sequential Supabase queries per call 🟡

**Location:** `db/forms.ts:162-181`.

```js
const r1 = await tryQuery({ limit: '500', or: `(no_wa.in.(${inList}),wa.in.(${inList}))` });
if (r1 !== undefined) return r1;
return tryQuery({ limit: '500', no_wa: 'in.(' + inList + ')' });
```

`tryQuery` itself tries 2 queries internally (light projection → full projection). So each call can fire up to **4 serial queries**. This function is called from `handleGetCandidatesPage` and `handleSimpanBerkasTahapan` — both are common admin operations.

**Impact:** 4× the Supabase roundtrips needed in the worst case. Even the happy path (first query succeeds) still pays for the light-projection probe.

**Fix:** Memoize the schema column check (finding #12); after the first successful call, remember which query shape works and skip the probe on subsequent calls.

---

## 34. `fireIngest` sends fire-and-forget HTTP to self with no backpressure 💭

**Location:** `actions-upload.ts:30-42`.

```js
function fireIngest(payload, sessionToken) {
  fetch(target, { method: 'POST', body })
    .then(r => r.json())
    .then(j => console.log('[Smart Ingest] result:', ...))
    .catch(e => console.warn('[Smart Ingest] HTTP call failed:', e.message));
}
```

**Problem:** Every upload (apply, berkas, revisi CV) fires an HTTP request to the `/ingest` function. There is no deduplication, no backpressure, and no tracking. If a candidate uploads 5 files in parallel (Promise.allSettled), 5 ingest functions fire simultaneously.

**Impact:** On Netlify Free (limited concurrent function executions), this can exhaust the concurrency pool and block other function invocations. The ingest function itself does AI (Gemini) calls, which have their own latency.

**Fix:** Deduplicate by `(wa, fileUrl)` key; add a small debounce (1–2s); consider a queue pattern using Supabase instead of self-referential HTTP.

---

## 35. Backend `getAppData` admin path: 8+ parallel DB queries, some with full-table scans 🟡

**Location:** `actions-public.ts:290-400` (the complete admin `getAppData` flow).

Full breakdown of the admin dashboard cold-load:

| Step | Query | Type | Rows |
|------|-------|------|------|
| 1a | `findJobs()` → try 9 table names | serial probe | ≤50 |
| 1b | `findAssets()` → try 8 table names | parallel w/ 1a | ≤20 |
| 1c | `findSettings()` → try 8 table names | parallel w/ 1a | ≤50 |
| 2 | `findAllCandidatesLight()` → paginate ALL `database_candidate` | serial after 1 | **1000+** |
| 3 | `findCandidatesByIds(page)` → fetch 50 by ID | serial after 2 | 50 |
| 4a | `fetchBerkasByWa()` → `pemberkasan_checklist` in WA set | parallel batch | ≤150 |
| 4b | `fetchMasterLightByWa()` → `master_database_candidate` light | parallel w/ 4a | ≤150 |
| 5 | `findFormsLight()` → `database_asj_form` 500 rows | parallel w/ 4 | **500** |
| 6 | `loadSchedules()` → `database_schedule` 500 rows | parallel w/ 4 | ≤500 |
| 7 | `loadTugas()` → `database_tugas` 500 rows | parallel w/ 4 | ≤500 |
| 8 | `loadWaTemplates()` → `wa_templates` 500 rows | parallel w/ 4 | ≤100 |

**Total:** 8+ Supabase queries, 2 full table scans (candidates + forms), ~500ms–2s cold.

**Impact:** This is the "initial load" for every admin who opens the dashboard. The cache (`public-base` + `cand:...`) helps on repeat loads, but any mutation wipes all cache (finding #17), forcing a full re-fetch.

**Fix:** Pre-compute and cache `schedules`, `tugas`, and `waTemplates` separately (they change rarely); use `count=estimated` for the candidates total (finding #10); add `ORDER BY` to `findAllCandidatesLight` to ensure deterministic pagination.

---

# 💭 Nits

21. **`queryPaged` is dead code** (`db/misc.ts:6-18`) — no callers anywhere in `netlify/`. Remove it.

22. **`supabasePaged` default produces an invalid header** (`db/client.ts:110-119`): with `{}` the `Range` becomes `"undefined-undefined"`. Add defaults.

23. **GET invocation does not parse `payload`** (`netlify-wrapper.ts:26-32`): `body.payload = q.payload` assigns the raw query string, but handlers expect an array.

24. **`Access-Control-Allow-Origin: *`** (`netlify-wrapper.ts:43`) on an authenticated API. Restrict to the app origin.

25. **`bcrypt.hashSync(..., 10)`** (`actions-auth.ts:220`, `:291`) blocks the event loop for ~100ms. Use async `bcrypt.hash`.

26. **`findForms()` still uses `select: '*'`** (`db/forms.ts:59-64`), pulling `ai_data_json`, even though `FORM_LIGHT_COLS` exists.

27. **`attachApplications` mutates shared objects** (`db/candidates.ts:259-268`): writes into per-WA arrays that would be shared if two candidates had the same WA. Safe only because `dedupeKandidatRaw` runs first — fragile.

---

# What is genuinely good

- The **dispatcher** is table-driven (`action-registry.ts`) with a single `try/catch` and a single rate-limit chokepoint — the right shape.
- **`requireAdmin` / `requireRole` / `isOwnerOrAdmin`** are centralised and applied consistently. The `kind === 'refresh'` exclusion is a thoughtful detail.
- The **light-projection + dedupe + slice** strategy in `loadCandidatesUnik` is a real optimisation with measured results (1.489ms → 297ms). Its only weakness is the unclamped input (#8).
- `verifyToken` correctly uses **`timingSafeEqual`** and validates the part count before parsing.
- **`supabaseUpsert`** handles the "unique constraint not yet migrated" case gracefully by falling back rather than failing — good defensive engineering against schema drift.
- The **parallel query strategy** (Fase 3.18) is well-executed: `loadPublicBase` runs 3 queries in parallel, `attachBerkasBio` runs berkas + master in parallel, and `getAppData` runs public + candidate data in parallel.
- **Web Vitals tracking** (`js/core/web-vitals.ts`) is auto-initialized and reports to backend — good observability foundation.
- The **service worker** strategy (network-first for navigation, stale-while-revalidate for assets) is well-designed; the anti-cache-nyangkut fix (skipWaiting at install) is a real improvement.

---

# Suggested fix order

1. **#1, #2, #3, #5, #28** — Trust-boundary and auth bypasses. Small, surgical, highest impact. #28 (VIP regex) is a one-line fix.
2. **#4** — Add token expiry (needs coordinated frontend refresh change, but is self-contained).
3. **#6** — Switch `rowIndex` → `id`. Removes a silent data-corruption class.
4. **#7** — Bound the rate-limit store.
5. **#8, #9, #17, #29** — Clamp inputs, single-flight the cache, stop clearing prematurely, fix monthly report. These are where the remaining latency lives.
6. **#10–#20** — Correctness and resilience, batch as convenient.
7. **#30–#35** — New performance findings; lower priority but worth addressing for the admin dashboard cold-load experience.
