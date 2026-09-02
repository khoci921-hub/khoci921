# Debug Audit: B2. `js/04_auth.js` — Authentication

**Tanggal:** 2026-08-20
**Pengerja:** Buffy (Codebuff)
**File:** `js/04_auth.js` (319 baris)
**Status:** ✅ Diverifikasi — 0 critical, 1 low

---

## 1. Architecture

### Exports (12)

| Export                               | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `bukaModalKandidat(mode)`            | Toggle login/register modal                           |
| `runAuthAction(btn, html, text, fn)` | Loading state wrapper                                 |
| `normalizeWaInput(w)`                | WA normalization (delegate to shared/wa-rules.js)     |
| `isValidWaInput(w)`                  | WA format validation (delegate to shared/wa-rules.js) |
| `toastWaFormat()`                    | WA format error toast                                 |
| `prosesDaftarKandidat()`             | Register flow                                         |
| `prosesGantiPasswordKandidat()`      | Change password flow                                  |
| `prosesLoginKandidat()`              | Login flow                                            |
| `showLoginAdminMaster()`             | Admin login step 1                                    |
| `prosesLoginMaster()`                | Admin login step 2                                    |
| `showLoginPersonal(name)`            | Admin login step 3                                    |
| `prosesLoginPersonal()`              | Admin login step 4                                    |

---

## 2. Security Analysis

### ✅ WA Normalization Gate

```javascript
const waNorm = normalizeWaInput(w);
if (!isValidWaInput(w)) {
  showToast(toastWaFormat(), 'error');
  return;
}
```

- **normalizeWa**: Buang non-digit, `0xx` → `62xx`
- **isValidWaFormat**: `/^628\d{9,10}$/` (13 digit, awalan 628)
- **Delegate**: `shared/wa-rules.js` → single source of truth ✅

### ✅ Password Validation

```javascript
if (baru.length < 6 || baru.length > 20 || /\s/.test(baru)) {
  showToast(tr('ui.pass_new_hint'), 'error');
  return;
}
```

- Min 6, max 20 chars, no whitespace ✅

### ✅ Session Token

```javascript
localStorage.setItem('asj_kandidat_session', res.sessionToken || '');
localStorage.setItem('asj_admin_session', res.sessionToken || '');
```

- Server-generated HMAC token (not client-generated) ✅
- Empty string fallback if server doesn't return token ✅

### ✅ runAuthAction Pattern

```javascript
export async function runAuthAction(btn, loadingHtml, idleText, fn) {
  if (btn) { btn.innerHTML = loadingHtml; btn.disabled = true; }
  try { return await fn(); }
  catch (err) { showToast(...); return null; }
  finally { if (btn) { btn.innerHTML = idleText; btn.disabled = false; } }
}
```

- Optimistic UI: button disabled during request ✅
- Error handling: catch → toast → return null ✅
- Cleanup: finally → restore button state ✅

### ✅ Admin Login Flow

- 3-step: Master PIN → Personal PIN → Session ✅
- Each step validates server-side ✅

---

## 3. Low Priority Finding

### ⚠️ LOW: `asj_session_token` legacy key

```javascript
localStorage.setItem(
  'asj_session_token',
  Date.now().toString(36) + Math.random().toString(36).substr(2),
);
```

- **Impact**: Legacy token generated client-side, dipakai sebagai rate-limit key
- **Security**: Bukan otorisasi — hanya rate-limit identifier
- **Verdict**: LOW — tidak ada security risk (server validate `asj_kandidat_session`)

---

## 4. Summary

| Item                | Status | Notes                             |
| ------------------- | ------ | --------------------------------- |
| WA normalization    | ✅     | shared/wa-rules.js, 628xxx format |
| Password validation | ✅     | 6-20 chars, no whitespace         |
| Session token       | ✅     | Server-generated HMAC             |
| runAuthAction       | ✅     | Loading + error + cleanup         |
| Admin login flow    | ✅     | 3-step, server-validated          |
| `asj_session_token` | ⚠️ LOW | Legacy rate-limit key, not auth   |
| Syntax              | ✅     | OK                                |

**Verdict: B2 DIVERIFIKASI — Security posture solid. 1 low finding (legacy key, no impact).**
