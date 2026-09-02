# Debug Report: C2. `js/render/candidate.js` — Kandidat Table

**Date:** 2026-08-20
**Agent:** Buffy (Codebuff)
**Lines:** 930 (8 exported functions, 7 registered)

---

## Summary

| Item                | Status                      | Detail                                                     |
| ------------------- | --------------------------- | ---------------------------------------------------------- |
| **Functions**       | ✅ 8 exported, 7 registered | All via `registerSeamAliases`                              |
| **XSS safety**      | ✅                          | All dynamic values use `esc()`/`escJs()`                   |
| **i18n**            | ⚠️ 1 issue                  | Hardcoded "Tidak ada data kandidat" in `showMonthlyReport` |
| **Filter debounce** | ✅                          | 250ms debounce via `debouncedFilterKandidat`               |
| **NULL guards**     | ✅                          | `filterKandidat` checks `if (!c) return false`             |
| **Infinite scroll** | ✅                          | `IntersectionObserver` with cleanup, +25 increment         |
| **Column filters**  | ✅                          | Excel-style, persisted to localStorage                     |
| **Syntax**          | ✅                          | OK                                                         |
| **Tests**           | ✅                          | 181/181 pass                                               |

---

## Findings

### ⚠️ MEDIUM: Duplicated Filter Logic (DRY Violation)

**Location:** `candidate.js:455-507` (exportKandidatCsv) vs `candidate.js:589-670` (filterKandidat)

**Analysis:**

- `exportKandidatCsv` has its own filter logic (lines 455-507)
- `filterKandidat` has nearly identical filter logic (lines 589-670)
- Both filter by: global search, gender, age, JFT, column filters
- **Difference:** `filterKandidat` has NULL guard (`if (!c) return false`), CSV export doesn't

**Impact:** MEDIUM — if filter logic changes in one place, the other won't be updated (already diverged: NULL guard missing in CSV)
**Fix:** Extract shared filter function, call from both places
**Rec:** FIX — extract `matchesCandidateFilters(c, val, genF, ageF, jftF)` helper

---

### ⚠️ MEDIUM: Hardcoded Indonesian in `showMonthlyReport`

**Location:** `candidate.js:830`

```javascript
html += '<p class="text-slate-500 text-sm">Tidak ada data kandidat.</p>';
```

**Analysis:**

- This string is user-facing in a modal
- Should use `tr()` for i18n
- Key already exists: `tr('admin.report_empty')` or similar

**Impact:** MEDIUM — Indonesian-only for JP users
**Fix:** Replace with `tr()` call
**Rec:** FIX — 1 line

---

### ⚠️ LOW: CSV Export Missing NULL Guard

**Location:** `candidate.js:455`

```javascript
var rows = (ALL_CANDIDATES || []).filter(function (c) {
  if (!hasAnyFilter) return true; // ← no NULL check for c
```

vs `filterKandidat` at line 591:

```javascript
var arr = (ALL_CANDIDATES || []).filter(function (c) {
  if (!c) return false; // ← NULL guard present
```

**Analysis:**

- If ANY_CANDIDATES contains null entries, CSV export will crash on `c.nama`
- `filterKandidat` correctly handles this

**Impact:** LOW — null entries unlikely in production, but defensive coding
**Fix:** Add `if (!c) return false;` after `if (!hasAnyFilter) return true;`
**Rec:** FIX — 1 line

---

### ✅ PASS: XSS & Escaping

All dynamic values properly escaped:

- `window.esc()` for text content
- `window.escJs()` for JS string args in onclick
- `tr()` for all UI labels
- `trOption()` for translated dropdown values

---

### ✅ PASS: Infinite Scroll

- `IntersectionObserver` with `rootMargin: '100px'` (preloads early)
- Previous observer disconnected before creating new one
- Increment: +25 per trigger
- Fallback: manual "Load More" button

---

## Architecture Notes

1. **Dual Mode**: Simple (6 columns, mobile-friendly) vs Full (6 columns + filters)
2. **Column Filters**: Excel-style — text inputs + dropdowns, persisted to localStorage
3. **Head Rendering**: Only once on init (not per keystroke — bug fix 2026-08-19)
4. **CSV Export**: Respects active filters, BOM UTF-8 for Excel, blob URL with cleanup

---

## Conclusion

**Rating: FIX RECOMMENDED** — 1 medium (DRY violation) + 1 medium (hardcoded string) + 1 low (NULL guard). All simple fixes.

---

## Changelog

| Date       | Action                                    |
| ---------- | ----------------------------------------- |
| 2026-08-20 | Initial debug — 2 medium + 1 low findings |
