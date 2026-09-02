# AI Admin Chat — Deep Analysis

> AI HR Copilot (Qween Jeklin) untuk admin panel. Chat analisis kandidat tanpa persist data. Dianalisis sampai akar pada 2026-08-27.

## 1. Arsitektur

```
admin.html (bundle)
├── js/ai_copilot/admin.ts (277 baris) — Chat UI + logic
├── js/ai_copilot/parse.ts — Parse dokumen biodata
├── js/ai_copilot/interview.ts — Simulator wawancara
├── js/ai_copilot/results.ts — Hasil wawancara
└── netlify/functions/_lib/ai/chat.ts — Backend handler
```

## 2. Alur Data

```
Admin klik ikon AI di tabel kandidat
  → bukaAdminAiCopilot(candidateId)
  → Modal admin-ai muncul
  → Admin ketik pesan
  → kirimPesanAdminAi()
  → withRetry(callAPI('processAdminAIChat', { adminName, message, history, candidateId }))
  → Backend: handleProcessAdminAIChat()
  → requireRole(sessionToken, 'admin') — guard admin
  → Gemini generate (system prompt + history)
  → Return { reply, suggestedActions, analysis }
  → Frontend: tambahPesanAdminAi(reply, 'ai')
  → Jika analysis ada: autoFillFormDariAi(analysis)
  → adminAiHistory.push(user + assistant messages)
```

## 3. Backend Handler (chat.ts:249-270)

```typescript
async function handleProcessAdminAIChat(payload, sessionToken) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;
  const d = (payload && payload[0]) || {};
  const history = (d.history || []).concat([{ role: 'user', content: d.message || '' }]);
  const system = 'Kamu adalah Jeklin, asisten HRD admin ASJ...';
  const r = await geminiGenerate(system, history);
  return { success: true, reply: r.reply, suggestedActions: [], analysis: null };
}
```

**Catatan:** Backend sangat simpel — tidak ada data context kandidat, tidak ada auto-translate, tidak ada persist.

## 4. Frontend Functions

| Function | Fungsi |
|----------|--------|
| `bukaAdminAiCopilot(candidateId)` | Buka modal AI + set candidate context |
| `tutupAdminAi()` | Tutup modal |
| `kirimPesanAdminAi(event)` | Send message with retry + trim history |
| `tambahPesanAdminAi(text, sender)` | Render chat bubble (user/ai) |
| `tampilkanSaranAdminAi(actions)` | Render suggestion chips |
| `autoFillFormDariAi(data)` | Auto-fill form kandidat dari analysis |
| `simpanKandidatDariAi()` | Transfer data ke modal tambah kandidat |

## 5. Improvements (10/10 — 2026-08-27)

| # | Improvement | Status | Detail |
|---|-------------|--------|--------|
| 1 | withRetry | Fixed | 2 attempts, 2s delay on API calls |
| 2 | Chat history trim | Fixed | Last 20 messages only |
| 3 | Input disable while sending | Fixed | Prevent double-send |
| 4 | Button reset on error | Fixed | Input re-enabled in catch |
| 5 | Null check scrollTop | Fixed | Prevent crash on hidden chatBox |
| 6 | Admin guard | Existing | requireRole('admin') on backend |
| 7 | XSS protection | Existing | window.esc() on all text |
| 8 | Typing indicator | Existing | Animated dots while waiting |
| 9 | Suggestion chips | Existing | Quick actions for admin |
| 10 | Auto-fill form | Existing | analysis → form fields |

## 6. E2E Tests

| File | Assertions | Categories |
|------|-----------|------------|
| `e2e/ai_admin_chat-test.mjs` | ~25 | 10 (modal, chat, input, send, retry, history, a11y, i18n, theme, errors) |

### Jalankan

```bash
node e2e/ai_admin_chat-test.mjs  # requires dev server on localhost:3000
```
