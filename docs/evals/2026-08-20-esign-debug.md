# D5. `js/12_esign_match.js` — E-Sign & Naitei — Audit Report

**Date:** 2026-08-20
**File:** `js/12_esign_match.js` (583 lines)
**Reviewer:** Buffy (Codebuff)

---

## Summary

| Metric        | Value        |
| ------------- | ------------ |
| Exports       | 15 functions |
| callAPI calls | 2            |
| tr() usage    | 19           |
| DOM refs      | 48           |
| Syntax        | ✅ OK        |

---

## Findings

### F1: Hardcoded canvas hint (LOW)

**Location:** Line 116

```javascript
document.getElementById('fs-canvas-hint').innerText = 'Gunakan jari di area putih.';
```

Should use tr() — already has key `ui.draw_hint`.

---

## Verdict

**CLEAN** — 0 critical, 0 medium, 1 low. Tahapan gate regex per AGENTS.md §6.

---

## Audit Trail

- 2026-08-20: Initial audit by Buffy
