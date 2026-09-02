# Debug Audit: A4. `js/core/sentry.js` + `sentry-dummy.js` — Error Tracking

**Tanggal:** 2026-08-20
**Pengerja:** Buffy (Codebuff)
**File:** `js/core/sentry.js` (80 baris) + `js/core/sentry-dummy.js` (5 baris)
**Status:** ✅ Diverifikasi — 3 findings (1 medium, 2 low)

---

## 1. sentry.js Analysis

### ✅ Strengths

- **Lazy init**: `_initialized` guard → tidak double-init
- **Noise filter**: ResizeObserver loop, empty promise rejections → di-drop
- **Environment detection**: hostname check → production vs development
- **Error capture**: Global error + unhandledrejection listeners
- **try-catch**: Sentry init gagal → tidak crash app

### ✅ DSN

```javascript
const DSN =
  'https://1aaacfbbb81ea01e30ba99e7ad953bf0@o4511939170467840.ingest.us.sentry.io/4511939208478720';
```

- Real DSN dari Sentry project `lpk-amanah-sakura-japan` ✅

### ✅ Config

```javascript
tracesSampleRate: 0.1,           // 10% performance traces
replaysSessionSampleRate: 0,      // disable replay (hemat quota)
replaysOnErrorSampleRate: 0.5,    // 50% replay saat error
```

- Sensible defaults ✅

---

## 2. Exported Functions Usage

| Function                        | Exported | Called           | Status     |
| ------------------------------- | -------- | ---------------- | ---------- |
| `initSentry()`                  | ✅       | ✅ bridge.js:421 | **ACTIVE** |
| `setSentryUser(ctx)`            | ✅       | ❌               | **UNUSED** |
| `addBreadcrumb(cat, msg, data)` | ✅       | ❌               | **UNUSED** |
| `Sentry` (re-export)            | ✅       | ❌               | **UNUSED** |

### ⚠️ Finding MEDIUM: `setSentryUser()` tidak dipanggil

- **Impact**: Error tracking tidak punya user context (role, WA, name)
- **Benefit if fixed**: Error di Sentry bisa difilter per user/role
- **Effort**: Tambah 1 baris di `initApp()` (js/engine/init.js)
- **Rec**: **FIX SEKARANG** — 1 baris, high value

---

## 3. sentry-dummy.js Analysis

```javascript
export const init = () => {};
export const setUser = () => {};
export const addBreadcrumb = () => {};
export const browserTracingIntegration = () => {};
export const captureException = () => {};
```

### ⚠️ Finding LOW: sentry-dummy.js tidak di-import

- **Impact**: Dead code — tidak dipakai siapapun
- **Benefit if fixed**: Kurangi noise di codebase
- **Effort**: Hapus file
- **Rec**: **FIX SEKARANG** — hapus dead code

---

## 4. DSN Hardcoded

```javascript
const DSN = 'https://1aaacfbbb81ea01e30ba99e7ad953bf0@...';
```

### ⚠️ Finding LOW: DSN hardcoded, bukan dari env var

- **Impact**: DSN berubah → harus edit source code
- **Benefit if fixed**: Fleksibilitas tanpa rebuild
- **Effort**: Baca dari `window.__SENTRY_DSN__` atau meta tag
- **Rec**: **SKIP** — DSN jarang berubah, sudah di-commit

---

## 5. Summary

| Item            | Status       | Notes                             |
| --------------- | ------------ | --------------------------------- |
| initSentry      | ✅           | Called from bridge.js, lazy init  |
| Noise filter    | ✅           | ResizeObserver + empty rejection  |
| Error capture   | ✅           | Global error + unhandledrejection |
| setSentryUser   | ⚠️ UNUSED    | Exported but never called         |
| addBreadcrumb   | ⚠️ UNUSED    | Exported but never called         |
| sentry-dummy.js | ⚠️ DEAD CODE | Not imported anywhere             |
| DSN hardcoded   | ⚠️ LOW       | Not from env var                  |

### Issues Found:

1. ⚠️ **MEDIUM**: `setSentryUser()` tidak dipanggil → error tanpa user context
2. ⚠️ **LOW**: `sentry-dummy.js` dead code → tidak di-import
3. ⚠️ **LOW**: DSN hardcoded → tidak dari env var

### Recommendations:

1. **setSentryUser**: FIX SEKARANG — tambah 1 baris di initApp()
2. **sentry-dummy.js**: FIX SEKARANG — hapus file
3. **DSN hardcoded**: SKIP — jarang berubah, sudah di-commit

**Verdict: A4 DIVERIFIKASI — 1 medium + 2 low. 2 bisa di-fix sekarang.**
