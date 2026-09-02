# Debug Audit: B1. `js/engine/init.js` — Engine Utama

**Tanggal:** 2026-08-20
**Pengerja:** Buffy (Codebuff)
**File:** `js/engine/init.js` (512 baris)
**Status:** ⚠️ Diverifikasi — 2 medium issues (listener leaks)

---

## 1. Architecture

### Exports (2)

| Export                 | Purpose                               |
| ---------------------- | ------------------------------------- |
| `refreshDataDinamis()` | Load data + retry + mode switching    |
| `initApp()`            | Render dashboard + setup auto-refresh |

### Flow

```
refreshDataDinamis()
  → determine mode (public/admin/kandidat)
  → validate session (auto-login hardening)
  → muatData(0) with retry
    → callAPI('getAppData', [mode, payload])
    → initApp(res) → render dashboard + setup timer
```

---

## 2. Issues Found

### ⚠️ MEDIUM: hashchange listener leak

```javascript
// Line 332 — INSIDE initApp(), called every 30s by auto-refresh
window.addEventListener('hashchange', function () {
  var h = (window.location.hash || '').replace('#', '').trim();
  if (h && validTabs.indexOf(h) !== -1) window.adminSwitchTab(h);
});
```

**Problem**: `initApp()` called every 30s → new listener added each time → after 10 min = 20 duplicate listeners.

**Impact**: Multiple `adminSwitchTab()` calls per hash change → UI flicker, performance degradation.

**Fix**: Move listener outside `initApp()` or add idempotent guard.

---

### ⚠️ MEDIUM: visibilitychange listener leak

```javascript
// Line 372 — INSIDE initApp(), called every 30s by auto-refresh
document.addEventListener('visibilitychange', function () {
  if (document.hidden) return;
  if (!AUTO_REFRESH_TIMER) return;
  if (window.adaModalTerbuka()) return;
  refreshDataDinamis(null, true);
});
```

**Problem**: Same as above — new listener each `initApp()` call.

**Impact**: Multiple `refreshDataDinamis()` calls when tab becomes visible → duplicate API calls.

**Fix**: Move listener outside `initApp()` or add idempotent guard.

---

## 3. Other Findings (LOW)

### ✅ Retry logic

- `muatData(percobaan)` retry 1x sebelum error toast → good

### ✅ Session invalid handling

- Admin: clear + toast + reload ✅
- Kandidat: clear + stop timer + toast + reload ✅

### ✅ Admin priority

- Admin wins over kandidat when both logged in ✅

### ✅ Datalist dedup

- Duplicate datalist render removed (FIX 2026-08-20) ✅

---

## 4. Summary

| Item                      | Status    | Notes                        |
| ------------------------- | --------- | ---------------------------- |
| refreshDataDinamis        | ✅        | Retry + mode switching       |
| initApp                   | ✅        | Render + auto-refresh        |
| hashchange listener       | ⚠️ MEDIUM | Leak — added every initApp() |
| visibilitychange listener | ⚠️ MEDIUM | Leak — added every initApp() |
| Session invalid           | ✅        | Admin + kandidat handled     |
| Datalist dedup            | ✅        | Fixed 2026-08-20             |
| Syntax                    | ✅        | OK                           |

### Issues Found:

1. ⚠️ **MEDIUM**: hashchange listener leak → duplicate tab switches
2. ⚠️ **MEDIUM**: visibilitychange listener leak → duplicate API calls

### Recommendations:

1. **hashchange**: Move to module scope (one-time) or add `let hashInitialized = false` guard
2. **visibilitychange**: Move to module scope (one-time) or add guard

**Verdict: B1 DIVERIFIKASI — 2 medium issues (listener leaks), bisa di-fix sekarang.**
