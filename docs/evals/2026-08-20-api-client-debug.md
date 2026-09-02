# Debug Audit: A1. `api-client.js` — API Bridge

**Tanggal:** 2026-08-20
**Pengerja:** Buffy (Codebuff)
**File:** `api-client.js` (389 baris)
**Status:** ✅ Diverifikasi — 181 tests pass, syntax OK

---

## 1. Action Mapping Completeness

### ✅ CANDIDATE_ACTIONS (16 actions)

Semua action ada di `action-registry.js` + `NETLIFY_FUNCTIONS` mapping:

- `getMasterDataByWa`, `submitMasterForm`, `getExistingCandidateJsonByWa`
- `getDrafCvMaster`, `simpanUpdateMaster`, `simpanBiodataLengkap`
- `simpanRevisiKandidat`, `simpanBerkasTahapan`, `simpanDataTtdNaitei`
- `gantiPasswordKandidat`, `processAiInterview`, `selesaikanWawancara`
- `simpanHasilWawancara`, `processAIChat`, `submitDataAsj`
- `registerFcmToken` — ✅ ada di registry (`auth.registerFcmToken`)

### ✅ ADMIN_ACTIONS (36 actions)

Semua action ada di `action-registry.js` + `NETLIFY_FUNCTIONS` mapping.

### ✅ Cross-reference: api-client ↔ action-registry

- **77 actions** di registry
- **77 actions** di `NETLIFY_FUNCTIONS` (api-client.js)
- **0 mismatch** — semua action yang dipanggil frontend punya handler backend

### ✅ Cross-reference: frontend callAPI() ↔ registry

Test `action-registry.test.js` memverifikasi:

- Semua `callAPI('action', ...)` di `js/` + `api-client.js` ada di `ACTION_HANDLERS`
- Semua action punya route di `NETLIFY_FUNCTIONS`
- **Status: PASS** (181 tests)

---

## 2. SWR Cache Analysis

### ✅ Cacheable Reads (3 actions)

```javascript
CACHEABLE_READS = new Set(['getAppData', 'getAppConfig', 'getCandidatesPage']);
```

- **getAppData**: Dashboard data — di-cache 5 menit ✅
- **getAppConfig**: Config data — di-cache 5 menit ✅
- **getCandidatesPage**: Candidates page — di-cache 5 menit ✅

### ✅ Cache TTL

```javascript
READ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit
```

- Cocok untuk repeat visits (reload halaman) ✅
- Tidak terlalu lama (data bisa basi) ✅

### ✅ Cache Invalidation

- Non-read actions → invalidate ALL `asj_cache_*` keys ✅
- Loop dari `sessionStorage.length - 1` ke 0 (aman saat remove) ✅

### ⚠️ Finding: Cache key includes full payload

```javascript
const cacheKey = 'asj_cache_' + action + ':' + JSON.stringify(payload || []);
```

- **Impact**: `getAppData(['admin'])` vs `getAppData(['kandidat'])` punya cache key berbeda ✅
- **Risk**: Jika payload array besar, cache key jadi panjang → sessionStorage limit 5MB
- **Verdict**: LOW RISK — payload kecil, 3 actions saja yang di-cache

### ⚠️ Finding: sessionStorage error handling silent

```javascript
try {
  sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), value: parsed }));
} catch (e) {}
```

- **Impact**: Kalau sessionStorage penuh, cache gagal tapi tidak error → fetch ulang setiap kali
- **Verdict**: ACCEPTABLE — degrade gracefully ke non-cache

---

## 3. Session Token Logic

### ✅ Token Attachment (3 jalur)

| Jalur        | Condition                                                    | Token Source                                    |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------- |
| **Logout**   | `action === 'logout'`                                        | Admin login? → admin session : kandidat session |
| **Admin**    | `ADMIN_ACTIONS.has(action)` atau `getAppData + admin`        | `asj_admin_session`                             |
| **Kandidat** | `CANDIDATE_ACTIONS.has(action)` atau `getAppData + kandidat` | Admin aktif? → admin session : kandidat session |

### ✅ Admin Priority

- Kalau admin DAN kandidat login di perangkat yang sama → **admin token menang** ✅
- Ini benar karena admin perlu akses penuh ke data kandidat

### ⚠️ Finding: `getAppData` dual-mode handling

```javascript
} else if (
  ADMIN_ACTIONS.has(action) ||
  (action === 'getAppData' && payload && payload[0] === 'admin')
) {
```

- **Impact**: `getAppData` BUKAN di `ADMIN_ACTIONS` — harus check `payload[0] === 'admin'` secara manual
- **Risk**: Kalau caller lupa kirim `payload[0]`, default ke public mode (no token)
- **Verdict**: LOW RISK — pattern ini sudah dipakai konsisten di frontend

---

## 4. Error Handling

### ✅ Network Error

```javascript
} catch (err) {
  console.error('[Netlify Error]', action, err);
  return { success: false, error: err.message || 'Network error' };
}
```

- Return error object, bukan throw → caller tidak crash ✅

### ✅ JSON Parse Error

```javascript
try {
  parsed = JSON.parse(text);
} catch (e) {
  parsed = { success: false, message: text };
}
```

- Fallback ke raw text → user bisa lihat response mentah ✅

### ✅ Session Invalid

```javascript
if (parsed && parsed.sessionInvalid) {
  // Toast → clear localStorage → reload
}
```

- Toast sebelum reload → user tahu kenapa ✅
- Clear semua key yang relevan ✅
- `window.location.reload()` → fresh start ✅

### ⚠️ Finding: No HTTP status code check

```javascript
const res = await fetch(url, { ... });
const text = await res.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch (e) {
  parsed = { success: false, message: text };
}
```

- **Impact**: Kalau server return 500 + HTML error page, `JSON.parse` gagal → `parsed = { success: false, message: "<html>..." }`
- **Risk**: User melihat raw HTML di toast
- **Verdict**: LOW — Netlify Functions selalu return JSON, tapi bisa lebih robust

---

## 5. XSS Protection

### ✅ `esc()` — HTML Entity Escape

```javascript
export function esc(x) {
  return String(x == null ? '' : x)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- Cover `& < > " '` ✅
- Null-safe: `x == null` → empty string ✅

### ✅ `escJs()` — JS in HTML Attribute Escape

```javascript
export function escJs(x) {
  return String(x == null ? '' : x)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\r\n\u2028\u2029]/g, ' ');
}
```

- Double escape: JS (`\\`, `'`) + HTML (`& < > "`) ✅
- Line breaks → space (prevent attribute breakout) ✅
- Unicode line separators (`\u2028`, `\u2029`) handled ✅

### ✅ Test Coverage

- `js/xss-escape.test.js` — tests `esc()` dan `escJs()` ✅

---

## 6. URL Resolution

### ✅ `resolveSelfUrl()`

```javascript
export function resolveSelfUrl(url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return url;
  try {
    const u = new URL(url);
    if (u.origin !== window.location.origin) {
      return window.location.origin + u.pathname + u.search + u.hash;
    }
  } catch (e) {
    /* URL tidak valid — biarkan */
  }
  return url;
}
```

- Guard: non-string, relative URL → return as-is ✅
- Replace origin kalau beda → form selalu buka di origin yang benar ✅
- Error handling: invalid URL → biarkan ✅

---

## 7. Unused Code / Dead Code

### ⚠️ `callNetlify()` — wrapper yang tidak dipakai

```javascript
function callNetlify(action, payload) {
  return callAPI(action, payload);
}
```

- **Impact**: Dead code — tidak dipanggil siapapun
- **Verdict**: REMOVE — technical debt

---

## 8. Summary

| Item                    | Status | Notes                                 |
| ----------------------- | ------ | ------------------------------------- |
| Action mapping complete | ✅     | 77/77 actions matched                 |
| SWR cache working       | ✅     | TTL 5min, invalidation on mutation    |
| Session token logic     | ✅     | Admin priority correct                |
| Error handling          | ✅     | Graceful degradation                  |
| XSS protection          | ✅     | esc() + escJs() tested                |
| URL resolution          | ✅     | Origin rewrite working                |
| Syntax                  | ✅     | `node --check --input-type=module` OK |
| Tests                   | ✅     | 181/181 pass                          |

### Issues Found:

1. ⚠️ **LOW**: No HTTP status code check (500 → raw HTML in toast)
2. ⚠️ **LOW**: Dead code `callNetlify()` wrapper
3. ⚠️ **LOW**: sessionStorage quota error silently ignored

### Recommendations:

1. **Optional**: Add `if (!res.ok)` check before JSON parse
2. **Optional**: Remove `callNetlify()` dead code
3. **Optional**: Log sessionStorage quota error for debugging

**Verdict: A1 DIVERIFIKASI — Tidak ada critical issues. File dalam kondisi sehat.**
