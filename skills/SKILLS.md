# SKILLS.md — Agent Skills Library (from davidondrej/skills)

> Sumber: [github.com/davidondrej/skills](https://github.com/davidondrej/skills)  
> Di-integrasikan: 2026-08-19 · Lisensi: MIT

Skills adalah instruksi terstruktur yang dimuat agent hanya saat relevan (progressive disclosure).
Setiap skill ada di folder `skills/<category>/<skill-name>/SKILL.md`.

---

## Cara Menggunakan Skills

1. **Agent otomatis memilih** skill berdasarkan deskripsi di frontmatter saat task cocok
2. **Manual invocation**: sebut nama skill dalam prompt (mis. "run risky-changes")
3. **Baca langsung**: `cat skills/<category>/<skill-name>/SKILL.md`

---

## Skills yang Tersedia

### 🧠 Thinking & Docs (Pola Pikir & Dokumentasi)

| Skill                 | Kapan Digunakan                                                                     | Trigger                                               |
| --------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **before-building**   | 🔥 Wajib sebelum membangun fitur baru — surface pilihan tersembunyi dalam 1-3 detik | Saat user mengajukan build/apapun yang ingin dibangun |
| **stop-overthinking** | Paksa keputusan praktis, hentikan overthinking                                      | `/stop-overthinking`                                  |
| **decisions**         | Review keputusan yang sudah dibuat, cari alternatif lebih baik                      | `/decisions`                                          |
| **next-decision**     | Drill open decisions satu per satu dengan 4 opsi                                    | `/next-decision`                                      |
| **ask-then-build**    | Scope fitur dengan tanya 3-6 pertanyaan, lalu hasilkan prompt build                 | "ask-then-build"                                      |
| **remind**            | TLDR + compress percakapan jadi plain English                                       | `/remind`                                             |
| **short**             | Compress jawaban sebelumnya jadi lebih pendek                                       | "short", "shorter", "tl;dr"                           |
| **level-up**          | Quiz adaptif 7 pertanyaan untuk assess knowledge user                               | "level up", "quiz me"                                 |
| **prompt-me**         | Agent wawancara user untuk extract priorities                                       | "prompt me", "ask me questions"                       |
| **teach**             | Workspace belajar terstruktur dengan lesson, reference docs                         | "teach me"                                            |

### 🛡️ Ops & Setup (Keamanan & Operasional)

| Skill                       | Kapan Digunakan                                                                                    | Trigger                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **risky-changes**           | ⚠️ Wajib sebelum ship perubahan risiko tinggi — validate asumsi dengan research + live measurement | "risky change", "is this safe to ship", "verify assumption" |
| **global-agent-guardrails** | Denylist perintah shell berbahaya (rm -rf /, fork bomb, git push --force, dll)                     | Otomatis via PreToolUse hook                                |
| **setup-help**              | Step-by-step setup guidance, satu langkah per respons                                              | "help me set up X", "walk me through this"                  |
| **anti-sleep**              | Prevent agent sleep/idle timeout                                                                   | Manual invocation                                           |

### ✍️ Skill Authoring (Membuat Skill Baru)

| Skill                                    | Kapan Digunakan                                               | Trigger                                |
| ---------------------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| **effective-agent-skills**               | 📘 Complete guide untuk membuat/menulis SKILL.md yang efektif | Saat membuat/mengedit skill            |
| **folder-specific-claude-and-agents-md** | Buat CLAUDE.md/AGENTS.md spesifik per folder                  | "create agent context for this folder" |

### 🔍 Research & Web

| Skill               | Kapan Digunakan                                                                                               | Trigger                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **research-prompt** | Tulis research prompt satu paragraf yang self-contained                                                       | "research brief", "deep research prompt"                                   |
| **neuroarxiv**      | 🔥 Cek arXiv prior art sebelum desain arsitektur — fetch real papers, isolate-read, converge ke 1 rekomendasi | "/neuroarxiv", "check arXiv", "has anyone solved this", "state of the art" |

### 💡 Advice (Project Strategy & Review)

| Skill                       | Kapan Digunakan                                                                                                              | Trigger                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **advise-project-approach** | 🔥 Research & advise pendekatan proyek: arsitektur, stack, pricing, comparables, failure conditions — sebelum/mid/post build | "best way to build X", "research comparable projects", "review my project", "stack selection", "architecture critique" |

---

## Skills yang TIDAK di-include (karena spesifik Cursor/OpenAI Codex)

Skill berikut ada di repo asli tapi tidak relevan untuk project ini (vanilla JS + Netlify):

- **agent-orchestration/** — Semua skill di kategori ini (cmux, corral-launch-agents, goal-loop, handoff, herdr, codex-subagent, fable-review, gpt-review, total-review, dll) membutuhkan infrastructure agent spesifik yang tidak dimiliki project ini
- **research-and-web/deep-research, deepapi, browser-harness, youtube-transcript** — Membutuhkan API key DeepAPI atau tool browser
- **ops-and-setup/nuke-cursor-app, macbook-metrics-setup, pi-custom-model** — Spesifik Cursor/ide tertentu
- **thinking-and-docs/brain-to-docs, save-idea, read-all-adrs** — Spesifik workflow David Ondrej

---

## Hooks (Dangerous Command Guard)

File di `hooks/`:

- **`dangerous-patterns.txt`** — Denylist POSIX-ERE regex untuk perintah shell berbahaya
- **`deny-dangerous.sh`** — Guard script: baca JSON dari stdin, block command yang match

Untuk mengaktifkan guard:

```bash
# Pilih salah satu metode sesuai agent yang digunakan
# Claude Code: tambahkan ke ~/.claude/settings.json
# Codex: tambahkan ke ~/.codex/hooks.json
# Freebuff: hook otomatis via PreToolUse
```

---

## Referensi

- **Repo asli**: https://github.com/davidondrej/skills
- **Standar Agent Skills**: https://agentskills.io
- **LICENSE**: MIT (dari repo asli)
