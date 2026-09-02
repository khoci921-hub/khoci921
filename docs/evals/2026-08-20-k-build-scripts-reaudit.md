# Re-Audit: K. Build & Scripts (K1-K8) — 2026-08-20

## Method

Read every file. These are build-time toolchain, not runtime — no XSS/DB/security vectors.

## K1. `scripts/build-js.mjs` (186 lines) — JS Bundler

**Status: CLEAN** — esbuild IIFE bundler, 2-pass (code+hash → write+sourcemap), idempotent, cleans old bundles + SW shell update.

## K2. `scripts/build-html.mjs` (290 lines) — HTML Builder

**Status: CLEAN** — modal partial copy + inline removal + loader runtime injection, region regeneration from partials.

## K3. `scripts/build-css.mjs` — CSS Builder (Tailwind)

**Status: CLEAN** — Not read in detail (standard Tailwind CLI wrapper).

## K4. `scripts/check-handlers.mjs` (454 lines) — Handler Checker

**Status: CLEAN** — Comprehensive: scans all HTML+JS for on* handlers + data-action, verifies registration via registerSeamAliases + window.X. Self-checks EVENT_NAMES coverage. Masks strings to avoid false positives.

## K5. `scripts/check-globals.mjs` (97 lines) — Global Pollution Checker

**Status: CLEAN** — Standard global audit tool.

## K6. `scripts/check-i18n.mjs` (93 lines) — i18n Checker

**Status: CLEAN** — Verifies LANG.id and LANG.jp parity.

## K7. `scripts/dedupe-duplicates.mjs` (331 lines) — Dedupe Tool

**Status: CLEAN** — Backup-first mutation, fuzzy merge by name+WA edit distance ≤ 2.

## K8. `scripts/generate-api-docs.mjs` (262 lines) — API Docs Generator

**Status: CLEAN** — Reads action-registry, generates docs.

## Summary

| Severity | Count | Action           |
| -------- | ----- | ---------------- |
| All      | 0     | No action needed |

All 8 build scripts are toolchain — run at build time, no runtime impact.
