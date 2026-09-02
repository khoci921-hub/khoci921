# AGENTS.md — Quick Reference untuk AI Agent

> Dokumen lengkap: **ASJ-PORTAL.md** (baca itu dulu).

---

## Aturan Cepat

1. WA: selalu 628xxxxxxxxxxxx (12-14 digit)
2. Upload: browser → Cloudinary → URL string
3. Modal: edit di partials/modals-shared.html saja
4. Build: bun run build setelah ubah JS/HTML/CSS
5. Deploy: JANGAN tanpa izin pemilik

---

## Peta Dokumen

| Dokumen | Isi |
|---------|-----|
| ASJ-PORTAL.md | Referensi lengkap (kode, pipeline, deploy, keamanan) |
| AGENTS_REFERENCE.md | Reference lengkap untuk AI agent |
| PROGRESS2.md | Riwayat sesi terbaru |
| CHANGELOG2.md | Riwayat per commit |
| DEBUG-TODO.md | Debug checklist semua kode |
| docs/HTML_PAGES.md | Dependensi semua halaman HTML |
| docs/api.json | OpenAPI spec |

---

## Mandatory Skill Dispatch

> Setiap kali menerima prompt, AGENT WAJIB memuat skill yang sesuai SEBELUM coding.

### Skill Categories

#### 🧠 Thinking & Docs (Pola Pikir & Dokumentasi)

| Skill | Kapan Digunakan | Trigger |
|-------|----------------|---------|
| **before-building** | 🔥 Wajib sebelum membangun fitur baru — surface pilihan tersembunyi | Saat user mengajukan build |
| **stop-overthinking** | Paksa keputusan praktis, hentikan overthinking | `/stop-overthinking` |
| **decisions** | Review keputusan yang sudah dibuat | `/decisions` |
| **next-decision** | Drill open decisions satu per satu | `/next-decision` |
| **ask-then-build** | Scope fitur dengan tanya 3-6 pertanyaan | "ask-then-build" |
| **remind** | TLDR + compress percakapan | `/remind` |
| **context-compression** | Compress long conversation history (max 10K chars) | System message |

#### 🛡️ Ops & Setup (Keamanan & Operasional)

| Skill | Kapan Digunakan | Trigger |
|-------|----------------|---------|
| **risky-changes** | ⚠️ Wajib sebelum ship perubahan risiko tinggi | "risky change", "is this safe" |
| **global-agent-guardrails** | Denylist perintah shell berbahaya | Otomatis via PreToolUse hook |
| **setup-help** | Step-by-step setup guidance | "help me set up X" |
| **anti-sleep** | Prevent agent sleep/idle timeout | Manual invocation |

#### 🔍 Research & Web

| Skill | Kapan Digunakan | Trigger |
|-------|----------------|---------|
| **research-prompt** | Tulis research prompt satu paragraf | "research brief", "deep research" |
| **neuroarxiv** | 🔥 Cek arXiv prior art sebelum desain arsitektur | "/neuroarxiv", "check arXiv" |
| **subtask-analysis** | Create sub-task agent for research | "subtask analysis", "deep analysis" |
| **subtask-code** | Create sub-task agent for writing code | "subtask code", "delegate coding" |

#### 💡 Advice (Project Strategy & Review)

| Skill | Kapan Digunakan | Trigger |
|-------|----------------|---------|
| **advise-project-approach** | 🔥 Research & advise pendekatan proyek | "best way to build X", "architecture critique" |

#### ✍️ Skill Authoring

| Skill | Kapan Digunakan | Trigger |
|-------|----------------|---------|
| **effective-agent-skills** | 📘 Complete guide untuk membuat SKILL.md | Saat membuat/mengedit skill |
| **folder-specific-claude-and-agents-md** | Buat CLAUDE.md/AGENTS.md spesifik folder | "create agent context" |

### Dispatch Table

| Tipe Task | Skill Wajib | Skill Opsional |
|-----------|-------------|----------------|
| Bangun fitur baru | before-building → stop-overthinking | decisions, next-decision |
| Revisi / Edit kode | stop-overthinking → risky-changes (jika risiko tinggi) | decisions |
| Debug / Fix bug | risky-changes → stop-overthinking | decisions |
| Refactor | risky-changes → stop-overthinking | decisions, next-decision |
| Optimasi performa | risky-changes → stop-overthinking | decisions |
| Security / Auth | risky-changes (WAJIB) → before-building | decisions |
| UI / Responsive | before-building → stop-overthinking | — |
| Backend action baru | before-building → risky-changes | decisions |
| Database schema change | risky-changes (WAJIB) → before-building | decisions |
| Deploy | risky-changes (WAJIB) | — |
| Research / Arsitektur | advise-project-approach → research-prompt | neuroarxiv |
| Multi-step complex task | before-building → decisions → next-decision | stop-overthinking |
| User bilang "lanjut" | stop-overthinking (cek progress) | — |
| User bilang "review" | risky-changes → decisions | before-building |
| Long conversation | context-compression | remind |
| Complex analysis | subtask-analysis | research-prompt |
| Complex coding | subtask-code | before-building |

### Skill Files

```
skills/
├── thinking-and-docs/
│   ├── before-building/SKILL.md     Fitur baru
│   ├── stop-overthinking/SKILL.md   Praktis
│   ├── decisions/SKILL.md           Review decisions
│   ├── next-decision/SKILL.md       Drill decisions
│   └── remind/SKILL.md              TLDR
├── ops-and-setup/
│   ├── risky-changes/SKILL.md       Ship validation
│   └── global-agent-guardrails/     Safety guard
├── research-and-web/
│   ├── research-prompt/SKILL.md     Research
│   └── neuroarxiv/SKILL.md          ArXiv check
└── advice/
    └── advise-project-approach/     Architecture
```

### External Skills (from repos)

```
# From agentic-prompts-main
prompts/context-compression.md    Compress conversation history
commands/subtask-analysis.md      Sub-task for research
commands/subtask-code.md          Sub-task for coding

# From mem0-main
skills/mem0/                      Mem0 SDK reference
skills/mem0-integrate/            Wire Mem0 via TDD
skills/mem0-test-integration/     Verify Mem0 integration

# From pi-main
.pi/skills/add-llm-provider.md    Add LLM provider checklist
```

### Execution Flow

1. Baca prompt user
2. Identifikasi tipe task (pakai tabel dispatch)
3. Load skill wajib
4. Jalankan instruksi skill
5. Present opsi/keputusan ke user (jika mensyaratkan)
6. Tunggu keputusan user (jika ada pilihan)
7. Baru mulai coding/fix/refit

---

## Debug & Test Rule

> Setiap fitur baru WAJIB update DEBUG-TODO.md + tambah test.

### Checklist Wajib

SEBELUM coding:
1. Baca skill yang sesuai (tabel dispatch di atas)
2. Baca DEBUG-TODO.md → identifikasi domain yang terpengaruh

SETELAH coding & sebelum commit:
1. Update DEBUG-TODO.md → tambah item debug untuk fitur baru
2. Tambah unit test (minimal happy path + 1 edge case)
3. Tambah i18n keys kalau ada teks UI baru
4. Jalankan bun run test → pastikan semua pass
5. Jalankan node --check pada semua file JS yang diubah
6. Jalankan bun run check:handlers kalau ada action baru
7. Jalankan bun run check:i18n kalau ada teks baru

### Anti-Regressi Rules

- JANGAN hapus item debug dari DEBUG-TODO.md (meskipun sudah selesai)
- JANGAN skip test karena "sudah test manual"
- WAJIB update DEBUG-TODO.md SEBELUM commit
- WAJIB test pass SEBELUM push
