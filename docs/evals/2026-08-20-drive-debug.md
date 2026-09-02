# C5. `js/admin_ops/drive.js` — Drive Migration — Audit Report

**Date:** 2026-08-20
**File:** `js/admin_ops/drive.js` (245 lines)
**Reviewer:** Buffy (Codebuff)

---

## Summary

| Metric        | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Exports       | 9 (1 var + 8 functions)                                |
| callAPI calls | 2 (`getDriveLinkCandidates`, `uploadDriveReplacement`) |
| tr() usage    | 7                                                      |
| Syntax        | ✅ OK                                                  |

---

## Findings

### F1: Broken `typeof callAPI` guard in ESM file (MEDIUM)

**Location:** Line 17

```javascript
if (typeof callAPI !== 'function') return;
```

File is ESM (`import { registerSeamAliases } from '../core/bridge.js'`). `callAPI` is not imported locally, so `typeof callAPI` always returns `'undefined'` — this guard silently breaks `muatMigrasiDrive()` every call.

Should be `typeof window.callAPI !== 'function'` or removed (ESM already handles imports).

### F2: Missing null check on file input (LOW)

**Location:** Line 191

```javascript
var input = document.getElementById('dl-file-' + safeId);
var extErr = window.cekEkstensiFile(input);
```

If element doesn't exist, `cekEkstensiFile(null)` may crash.

### F3: Hardcoded Indonesian toast messages (LOW)

**Locations:** Lines 208, 228

```javascript
// Line 208 — hardcoded success message
window.showToast(res.field + ' ' + idKandidat + ' terupload ke Storage ✓', 'success');
// Line 228 — hardcoded error fallback
window.showToast((res && res.error) || 'Gagal upload', 'error');
```

---

## Recommendations

| #   | Finding                  | Fix Now? | Effort   |
| --- | ------------------------ | -------- | -------- |
| F1  | Broken typeof callAPI    | ✅ YES   | 1 line   |
| F2  | Missing input null check | ✅ YES   | 2 lines  |
| F3  | Hardcoded toast strings  | ✅ YES   | Use tr() |

---

## Audit Trail

- 2026-08-20: Initial audit by Buffy
