# C4. `js/admin_ops/candidates.js` — Admin Candidates — Audit Report

**Date:** 2026-08-20
**File:** `js/admin_ops/candidates.js` (368 lines)
**Reviewer:** Buffy (Codebuff)

---

## Summary

| Metric        | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| Exports       | 9 functions                                                      |
| callAPI calls | 3 (`tandaiGagalJob`, `kirimTawaranMassal`, `getDaftarSiswaBaru`) |
| tr() usage    | 27 (well i18n'd)                                                 |
| Syntax        | ✅ OK                                                            |

---

## Findings

### F1: Missing DOM null checks (MEDIUM)

**Locations:** Lines 44, 60, 73, 74, 75, 93, 308, 343

Multiple `getElementById()` calls without null guards. If the element doesn't exist (wrong HTML ID, modal not loaded), the code crashes.

Example:

```javascript
// Line 44 — crashes if modal-list-kandidat missing
document.getElementById('modal-list-kandidat').classList.remove('hidden');

// Line 73 — crashes if input-link-grup missing
let linkGrup = document.getElementById('input-link-grup').value;

// Line 93 — crashes if btn-undang-grup missing
let btn = document.getElementById('btn-undang-grup');
btn.innerHTML = window.tr('ui.sending');
```

### F2: Hardcoded "Gagal" button label (LOW)

**Location:** Line 36

```javascript
title="${window.tr('ui.remove_from_job')}">Gagal</button>
```

The `title` attribute uses `tr()` but the button text is hardcoded Indonesian "Gagal".

### F3: Hardcoded confirm() dialogs (LOW)

**Locations:** Lines 49-53, 259-263

```javascript
confirm('Keluarkan kandidat ini dari Job ' + jobCode + '?\n(Data tidak dihapus, ...)')
confirm(tr('ui.toast_confirm_send_n').replace(...))
```

Line 259 already uses `tr()` — good. Line 49 is hardcoded Indonesian.

### F4: currentCopyListTxt is write-only (LOW)

**Location:** Line 43

```javascript
window.currentCopyListTxt = txt;
```

This value is set but never read anywhere in the codebase (dead code).

---

## Recommendations

| #   | Finding                 | Fix Now? | Effort     |
| --- | ----------------------- | -------- | ---------- |
| F1  | Missing DOM null checks | ✅ YES   | Add guards |
| F2  | Hardcoded "Gagal"       | ✅ YES   | Use tr()   |
| F3  | Hardcoded confirm()     | ✅ YES   | Use tr()   |
| F4  | Dead currentCopyListTxt | ❌ SKIP  | Defer      |

---

## Audit Trail

- 2026-08-20: Initial audit by Buffy
