# Debug Audit: A3. `js/core/bridge.js` — ESM→Legacy Bridge

**Tanggal:** 2026-08-20
**Pengerja:** Buffy (Codebuff)
**File:** `js/core/bridge.js` (468 baris)
**Status:** ✅ Diverifikasi — 6 tests pass, no critical issues

---

## 1. Architecture

### Purpose

Bridge ESM → Legacy: menghubungkan modul ESM (api-client.js, i18n.js) dengan kode classic (window.* aliases).

### Exports (7)

| Export                  | Type     | Purpose                               |
| ----------------------- | -------- | ------------------------------------- |
| `PortalBridge`          | Object   | Namespace tunggal untuk kode legacy   |
| `registerSeamAliases()` | Function | Daftarkan alias HTML↔JS ke window     |
| `getSeamAliases()`      | Function | Snapshot registry (audit/debug)       |
| `dispatchSeamAction()`  | Function | Eksekusi seam action dari data-action |
| `initSeamDispatcher()`  | Function | Pasang listener delegasi document     |
| `checkInlineHandlers()` | Function | Guard runtime handler inline          |
| `flushGuardWarnings()`  | Function | Cetak temuan guard                    |

### Imports (5)

- `api-client.js` → callAPI, esc, escJs, resolveSelfUrl
- `i18n.js` → tr, trOption, trOptionId, LANG, renderLanguageLight, toggleFormLanguage
- `fcm-client.js` → requestNotificationPermission
- `web-vitals.js` → initWebVitals
- `sentry.js` → initSentry

### Side Effects (3)

1. `window.PortalBridge = PortalBridge` — expose ke global
2. `initSeamDispatcher()` — pasang click/change listener
3. `checkInlineHandlers()` + `load` event → guard + flush

---

## 2. registerSeamAliases() Analysis

### ✅ Strengths

- **Collision guard**: Nama sama + nilai beda → warn + terbaru menang
- **Idempotent**: Nama sama + nilai sama → tidak warn
- **Non-function guard**: Tanpa `allowNonFunction` → ditolak + warn
- **Source tracking**: `SEAM_SOURCES` map → pesan tabrakan jelas
- **Return value**: Return aliases → bisa chaining

### ✅ Correct Pattern

```javascript
// Core aliases (bridge.js)
registerSeamAliases({ callAPI, esc, escJs }, { source: 'bridge:api-client' });
registerSeamAliases({ tr, trOption, LANG }, { source: 'bridge:i18n', allowNonFunction: true });

// Page-specific aliases (js/pages/*.js)
registerSeamAliases({ bukaDigitalCV, renderAdminFull }, { source: 'pages/admin' });
```

### ⚠️ Finding: No `unregisterSeamAliases()`

- **Impact**: Kalau modul di-unload (dynamic import), alias tetap di window
- **Verdict**: LOW — project tidak pakai dynamic import unload

---

## 3. dispatchSeamAction() Analysis

### ✅ Correct

```javascript
export function dispatchSeamAction(name, event, args) {
  const fn = resolveSeam(name);
  if (typeof fn !== 'function') {
    console.warn(`...`);
    return undefined;
  }
  return fn.apply(event ? event.currentTarget : undefined, args || []);
}
```

- Resolve dari SEAM_ALIASES → fallback window.* ✅
- `fn.apply()` dengan `currentTarget` context ✅
- Return undefined untuk nama tak dikenal ✅

---

## 4. checkInlineHandlers() Guard

### ✅ Strengths

- **Lazy flush**: Scan → guardPending → flush +3 detik → catch dynamic renders
- **Non-blocking**: Hanya `console.warn`, tidak mengubah perilaku
- **Preview-only**: `isPreviewHost()` → tidak jalan di production
- **String masking**: `maskInlineStrings()` → false positive dikurangi

### ✅ False Positive Handling

```javascript
// 3 scan bertahap:
checkInlineHandlers(); // Load pertama
window.addEventListener('load', () => {
  checkInlineHandlers(); // Setelah semua script load
  setTimeout(() => {
    checkInlineHandlers(); // +3 detik untuk dynamic render
    flushGuardWarnings(); // Cetak yang MASIH missing
  }, 3000);
});
```

### ⚠️ Finding: `guardPending` Map tidak pernah di-cleanup otomatis

- **Impact**: Kalau 1000+ handler inline, memory usage naik
- **Verdict**: LOW — Map cleared setiap flush, preview-only

---

## 5. Sentry + Web Vitals Auto-Init

```javascript
initSentry();
initWebVitals();
```

### ✅ Correct

- Auto-init saat module dimuat
- Tidak ada dependency antara keduanya
- Error handling di dalam masing-masing init

---

## 6. Source Map Warning

```
Error: ENOENT: no such file or directory, open 'vendor/web-vitals.js.map'
```

### ⚠️ Finding: Missing source map

- **Impact**: Test output noise, tidak mempengaruhi runtime
- **Verdict**: LOW — vendor file, bukan project code

---

## 7. Test Coverage

| Test                                    | Status | Detail                             |
| --------------------------------------- | ------ | ---------------------------------- |
| registerSeamAliases menolak non-fungsi  | ✅     | Guard works                        |
| registerSeamAliases menerima non-fungsi | ✅     | allowNonFunction works             |
| guard tabrakan nama                     | ✅     | Collision detected, terbaru menang |
| re-registrasi idempotent                | ✅     | Same value → no warn               |
| dispatchSeamAction resolve              | ✅     | Registry + window fallback         |
| dispatchSeamAction nama tak dikenal     | ✅     | Warn + undefined                   |

---

## 8. Summary

| Item                | Status | Notes                                        |
| ------------------- | ------ | -------------------------------------------- |
| Architecture        | ✅     | Clean ESM→Legacy bridge pattern              |
| registerSeamAliases | ✅     | Collision guard, idempotent, source tracking |
| dispatchSeamAction  | ✅     | Registry + window fallback                   |
| checkInlineHandlers | ✅     | Lazy flush, preview-only, non-blocking       |
| Sentry + Web Vitals | ✅     | Auto-init on module load                     |
| Syntax              | ✅     | node --check OK                              |
| Tests               | ✅     | 6/6 pass                                     |

### Issues Found:

1. ⚠️ **LOW**: No `unregisterSeamAliases()` (cleanup function)
2. ⚠️ **LOW**: Missing `vendor/web-vitals.js.map` (source map noise)### Recommendations:
3. **Unregister**: SKIP — project tidak pakai dynamic import unload, zero impact
4. **Source map**: SKIP — vendor file, test noise only, zero impact

### Log Keputusan:

| #   | Finding                    | Keputusan | Alasan                                    |
| --- | -------------------------- | --------- | ----------------------------------------- |
| 1   | No unregisterSeamAliases() | **SKIP**  | Project tidak pakai dynamic import unload |
| 2   | Missing web-vitals.js.map  | **SKIP**  | Vendor file, test noise only              |

**Verdict: A3 DIVERIFIKASI — 2 temuan LOW, keduanya SKIP (zero impact). Bridge dalam kondisi sehat.**
