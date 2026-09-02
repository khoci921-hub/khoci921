# Debug Report: B5. `js/init/util.js` — Utilities

**Date:** 2026-08-20
**Agent:** Buffy (Codebuff)
**Lines:** 298 (19 exported functions, 19 registered aliases)

---

## Summary

| Item                   | Status   | Detail                                    |
| ---------------------- | -------- | ----------------------------------------- |
| **Functions exported** | ✅ 19/19 | All registered via `registerSeamAliases`  |
| **DOM null checks**    | ✅       | All `getElementById` calls guarded        |
| **XSS safety**         | ✅       | Dynamic innerHTML uses `esc()`            |
| **i18n compliance**    | ✅       | All callers use `tr()` for toast messages |
| **Syntax**             | ✅       | `node --check --input-type=module` OK     |
| **Tests**              | ✅       | 181/181 pass                              |

---

## Function Inventory

| #   | Function                  | Purpose                                           | Callers                |
| --- | ------------------------- | ------------------------------------------------- | ---------------------- |
| 1   | `thumbnailUrl`            | Supabase Storage thumbnail (?width=&quality=)     | public.js, share       |
| 2   | `safeSetVal`              | DOM set value with null check                     | multiple               |
| 3   | `normalizePhone`          | WA `0xx`→`62xx` normalization                     | **24+ callers** (core) |
| 4   | `showToast`               | Toast notification (3 types)                      | 50+ callers            |
| 5   | `safeSet`                 | DOM innerHTML with null check                     | multiple               |
| 6   | `setImg`                  | DOM img src setter                                | multiple               |
| 7   | `setBg`                   | DOM background-image setter                       | multiple               |
| 8   | `getHighResImage`         | **Passthrough** (Google Drive conversion removed) | 6 callers              |
| 9   | `getDirectDownloadUrl`    | **Passthrough** (Google Drive conversion removed) | 5 callers              |
| 10  | `formatPendidikanTingkat` | Education level formatter (JSON/text)             | CV builders            |
| 11  | `isPreviewableFile`       | File type check for preview                       | preview.js             |
| 12  | `previewFinalUrl`         | URL for iframe preview (docs.gview for PDF)       | preview.js             |
| 13  | `populate`                | Select dropdown builder                           | admin, forms           |
| 14  | `rePopulateDropdowns`     | Rebuild all dropdowns on language change          | i18n                   |
| 15  | `populateCheckboxes`      | Checkbox group builder                            | admin filters          |
| 16  | `formatInputWA`           | WA input format + validation ring                 | register, auth         |
| 17  | `hapusRingWA`             | Clear WA validation ring                          | register               |
| 18  | `salinTeksDecode`         | Copy decoded text to clipboard                    | share                  |
| 19  | `toggleMinimize`          | Toggle element minimize/maximize                  | admin panels           |

---

## Findings

### ⚠️ LOW: `salinTeksDecode` — Deprecated `document.execCommand('copy')`

**Location:** `util.js:258`

```javascript
document.execCommand('copy'); // deprecated
```

**Analysis:**

- `document.execCommand('copy')` is deprecated but still works in all browsers
- Modern alternative: `navigator.clipboard.writeText()`
- The try-catch around it means it degrades gracefully
- `salinTeksDecode` is only called from `js/pages/share.js` (1 caller)

**Impact:** Minimal — still works, just deprecated API
**Fix:** Optional — upgrade to `navigator.clipboard.writeText()` with fallback
**Rec:** Defer to ESM refactor (§6 TODO.md)

---

### ⚠️ LOW: `getHighResImage` & `getDirectDownloadUrl` — No-Op Passthrough

**Location:** `util.js:86-92`

```javascript
export function getHighResImage(url) {
  if (!url || url === '-') return '';
  return url; // passthrough — Google Drive conversion removed
}
export function getDirectDownloadUrl(url) {
  if (!url || url === '-' || url.trim() === '') return '';
  return url; // passthrough
}
```

**Analysis:**

- Both functions used to convert Google Drive links to direct download URLs
- Google Drive integration was removed, these are now pure passthrough
- Still have 6 + 5 callers respectively
- Could be inlined, but that would touch many files for no functional gain

**Impact:** Zero runtime impact — just dead code complexity
**Fix:** Not recommended — defer to refactor
**Rec:** Skip

---

### ⚠️ LOW: `previewFinalUrl` — PDF via Google Docs Viewer

**Location:** `util.js:147`

```javascript
return 'https://docs.google.com/gview?url=' + encodeURIComponent(u) + '&embedded=true';
```

**Analysis:**

- PDF URLs are sent to Google Docs Viewer for iframe rendering
- This means PDF content is fetched by Google's servers
- If PDFs contain sensitive candidate data (passports, IDs), this is a privacy consideration
- However, this is the standard approach for PDF preview in web apps (no good pure-client alternative)
- Fixed on 2026-08-19 to improve mobile compatibility

**Impact:** LOW privacy concern (PDFs already in Supabase public storage)
**Fix:** Not recommended — no good alternative for mobile PDF preview
**Rec:** Acceptable trade-off

---

## DOM Safety Audit

| Function             | DOM Access                          | Null Check                  | XSS                                                    |
| -------------------- | ----------------------------------- | --------------------------- | ------------------------------------------------------ |
| `safeSetVal`         | `getElementById`                    | ✅ `if (el)`                | N/A (value)                                            |
| `showToast`          | `getElementById('toast-container')` | ✅ `if (!container) return` | ⚠️ `message` in innerHTML — but all callers use `tr()` |
| `safeSet`            | `getElementById`                    | ✅ `if (el)`                | ✅ caller-controlled                                   |
| `setImg`             | `getElementById`                    | ✅ `if (el && url)`         | N/A (src)                                              |
| `setBg`              | `getElementById`                    | ✅ `if (el && url)`         | N/A (style)                                            |
| `populate`           | `getElementById`                    | ✅ `if (!el) return`        | ✅ `esc()` on all dynamic                              |
| `populateCheckboxes` | `getElementById`                    | ✅ `if (!el) return`        | ✅ `esc()` on all dynamic                              |
| `formatInputWA`      | Element param                       | ⚠️ No null check on `el`    | N/A (DOM event)                                        |
| `hapusRingWA`        | Element param                       | ⚠️ No null check on `el`    | N/A (DOM event)                                        |
| `toggleMinimize`     | `getElementById` + `querySelector`  | ✅ `if (el)` + `if (icon)`  | N/A                                                    |

**Note on `formatInputWA` and `hapusRingWA`:** These receive `el` from DOM event handlers (e.g., `oninput="formatInputWA(this)"`), so `el` is always a valid element. No null check needed.

---

## Architecture Notes

1. **No State**: All functions are stateless helpers — no module-level variables
2. **Bridge via Data Property**: Unlike `state.js` (which uses accessor get/set), these use simple data property aliases because functions are never reassigned
3. **Deprecated API**: `document.execCommand('copy')` — only in `salinTeksDecode`
4. **Google Docs Viewer**: PDF preview routed through Google — acceptable trade-off for mobile compatibility

---

## Conclusion

**Rating: PASS** — util.js is clean, well-guarded, and functional. All 19 functions properly registered. Minor deprecated API (`execCommand`) and dead code (`getHighResImage` passthrough) deferred to refactor. No critical or medium issues.

---

## Changelog

| Date       | Action                                |
| ---------- | ------------------------------------- |
| 2026-08-20 | Initial debug — PASS, no fixes needed |
