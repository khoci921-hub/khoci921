# C3. `js/render/mail.js` — Mail Inbox — Audit Report

**Date:** 2026-08-20
**File:** `js/render/mail.js` (371 lines)
**Reviewer:** Buffy (Codebuff)

---

## Summary

| Metric        | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| Exports       | 3 (`MAIL_SELECTED`, `renderMailFilterUI`, `renderFormInbox`) |
| DOM refs      | 3 (`getElementById`)                                         |
| callAPI calls | 0 (render-only file)                                         |
| tr() usage    | 25+ (well i18n'd)                                            |
| Syntax        | ✅ OK                                                        |
| Tests         | ✅ 181/181 pass                                              |

---

## Findings

### F1: Duplicate `class` attribute on checkbox (LOW)

**Location:** Line ~268-269

```javascript
'<td class="p-4 text-center"><input type="checkbox" class="mail-check" data-idx="' +
  f.rowIndex +
  '" onclick="toggleMailSelect(this)" ' +
  ck +
  ' aria-label="Pilih" class="w-4 h-4 accent-rose-500 cursor-pointer">';
```

Two `class="..."` attributes on the same element. HTML spec says **first wins**, second is ignored. The `w-4 h-4 accent-rose-500 cursor-pointer` styles are silently dropped.

**Impact:** Checkbox lacks visual styling (size, color, cursor).

### F2: Hardcoded Indonesian empty messages (MEDIUM)

**Location:** Line ~335-339

```javascript
var emptyMsg =
  mailFilterStatus === 'ALL'
    ? 'TIDAK ADA DATA MAIL'
    : 'TIDAK ADA DATA MAIL DENGAN STATUS ' +
      (MAIL_STATUS_LABEL[mailFilterStatus] || mailFilterStatus);
```

Should use `tr()` for i18n support.

### F3: renderMailFilterUI count() = O(6n) (LOW)

**Location:** Lines 54-79

`renderMailFilterUI()` runs 6 separate `ALL_FORM.filter()` calls (one per status). Total = 6 passes over the array.

**Impact:** Acceptable for small datasets (<500 forms). Could optimize to single pass if needed later.

---

## Recommendations

| #   | Finding                   | Fix Now? | Effort                          |
| --- | ------------------------- | -------- | ------------------------------- |
| F1  | Duplicate class attribute | ✅ YES   | 1 line                          |
| F2  | Hardcoded empty messages  | ✅ YES   | Add i18n keys                   |
| F3  | O(6n) count               | ❌ SKIP  | Performance OK at current scale |

---

## Audit Trail

- 2026-08-20: Initial audit by Buffy
