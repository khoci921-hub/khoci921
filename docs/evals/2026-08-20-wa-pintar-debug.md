# D2. `js/08_wa_pintar.js` — WA Pintar — Audit Report

**Date:** 2026-08-20
**File:** `js/08_wa_pintar.js` (517 lines)
**Reviewer:** Buffy (Codebuff)

---

## Summary

| Metric        | Value        |
| ------------- | ------------ |
| Exports       | 15 functions |
| callAPI calls | 2            |
| tr() usage    | 21           |
| DOM refs      | 41           |
| Syntax        | ✅ OK        |

---

## Findings

### F1: XSS in renderWaTemplates — template nama/isi unescaped (MEDIUM)

**Location:** Lines 31-32

```javascript
'<h4 ...>' + t.nama + '</h4>' + '<p ...>' + t.isi + '</p>';
```

`t.nama` and `t.isi` rendered without `esc()`. If admin enters `<script>` in template name, it executes.

### F2: Hardcoded button labels (LOW)

**Locations:** Lines 38, 41, 44, 50, 92, 171

- 'Kirim', 'Edit', 'Hapus' — button labels
- 'Belum ada template...' — empty state
- 'Edit Template' — form title
- 'Buka WhatsApp & Kirim' — action button

---

## Recommendations

| #   | Finding                | Fix Now? | Effort    |
| --- | ---------------------- | -------- | --------- |
| F1  | XSS in template render | ✅ YES   | Add esc() |
| F2  | Hardcoded buttons      | ✅ YES   | Use tr()  |

---

## Audit Trail

- 2026-08-20: Initial audit by Buffy
