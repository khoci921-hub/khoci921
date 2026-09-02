# Debug Report: C1. `js/render/admin.js` — Admin Render

**Date:** 2026-08-20
**Agent:** Buffy (Codebuff)
**Lines:** 357 (7 functions, 5 registered)

---

## Summary

| Item                | Status                      | Detail                                               |
| ------------------- | --------------------------- | ---------------------------------------------------- |
| **Functions**       | ✅ 7 exported, 5 registered | `renderAdminFull` + `renderDbJobTable` internal only |
| **XSS safety**      | ✅                          | All dynamic values use `esc()`/`escJs()`             |
| **i18n**            | ✅                          | All UI text via `tr()`/`trOption()`                  |
| **DOM null checks** | ✅                          | All getElementById calls guarded                     |
| **Hash routing**    | ✅                          | try-catch on `history.replaceState`                  |
| **Syntax**          | ✅                          | OK                                                   |
| **Tests**           | ✅                          | 181/181 pass                                         |

---

## Findings

### ⚠️ MEDIUM: O(n²) Candidate Scan in `filterDbJob()` Sort

**Location:** `admin.js:200-201`

```javascript
// Inside arr.sort() comparator:
return (
  ALL_CANDIDATES.filter((c) => c.idLoker === b.code).length -
  ALL_CANDIDATES.filter((c) => c.idLoker === a.code).length
);
```

**Analysis:**

- Sort comparator runs O(n log n) times, each calling `ALL_CANDIDATES.filter()` which is O(m)
- Total: O(n * m * log n) where n = DB_JOBS, m = ALL_CANDIDATES
- With 100 jobs × 500 candidates = 50,000+ filter operations per sort

**Also at line 281:**

```javascript
var cands = ALL_CANDIDATES.filter((c) => c.idLoker === db.code);
```

- Called for every job row — another O(n × m)

**Impact:** MEDIUM — with 500+ candidates and 100+ jobs, filterDbJob may cause UI lag during admin panel load
**Fix:** Pre-compute candidate count Map before sort:

```javascript
var countMap = {};
ALL_CANDIDATES.forEach((c) => {
  countMap[c.idLoker] = (countMap[c.idLoker] || 0) + 1;
});
// Then in sort: countMap[b.code] - countMap[a.code]
// And in render: countMap[db.code] || 0
```

**Rec:** FIX — simple optimization, 5 lines

---

### ⚠️ LOW: `renderAdminFull` Calls 10+ Renderers Without Error Boundary

**Location:** `admin.js:71-87`

```javascript
export function renderAdminFull() {
  safeSet('dash-loker', ...);
  renderAdmin();
  renderDbFilters();
  filterDbJob();
  renderFormInbox();
  window.filterKandidat();
  renderJadwal();
  renderTugas();
  renderDashboardAgenda();
  renderWaTemplates();
}
```

**Analysis:**

- If any renderer throws, subsequent renderers won't execute
- No try-catch wrapping individual renderers
- One broken renderer could leave admin panel partially rendered

**Impact:** LOW — all renderers are well-guarded individually, but a thrown error in one could cascade
**Fix:** Optional — wrap each in try-catch for defense-in-depth
**Rec:** Defer — risk is low

---

### ✅ PASS: XSS & i18n

All dynamic values in HTML strings properly escaped:

- `window.esc()` for text content
- `window.escJs()` for JS string args in onclick handlers
- `tr()` for all UI labels
- `trOption()` for translated option labels

---

## Architecture Notes

1. **Hash Routing**: `adminSwitchTab` updates `window.location.hash` via `replaceState` — enables shareable admin URLs
2. **A11y**: `aria-current="page"` set on active tab, removed from inactive
3. **Debounce**: `debouncedFilterDbJob` properly debounces at 250ms
4. **Pipeline Badge**: `badgeTahapanDb` uses step index for color coding — emerald (done) → amber (mid) → sky (early)

---

## Conclusion

**Rating: FIX RECOMMENDED** — 1 medium issue (O(n²) candidate scan). Simple optimization with pre-computed Map. Other findings are low-risk deferrals.

---

## Changelog

| Date       | Action                                        |
| ---------- | --------------------------------------------- |
| 2026-08-20 | Initial debug — 1 medium finding (O(n²) scan) |
