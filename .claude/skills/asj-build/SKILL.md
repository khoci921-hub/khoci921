---
name: asj-build
description: >
  Build, test, lint, and deploy commands for ASJ Portal. USE FOR: running
  build (bun run build), checking syntax (node --check), running tests
  (bun run test), linting, format checking, preview server, deploying to
  Netlify. DO NOT USE FOR: debugging runtime behavior, inspecting live
  pages, or fixing bugs — use asj-debug or asj-e2e instead.
metadata:
  version: '1.0.0'
---

# ASJ Build Skill

All build/test commands for ASJ Portal. Native commands are free and
deterministic — prefer them over live browser inspection for anything
that doesn't require seeing the current live page.

## Build commands

```bash
# Full build (CSS + HTML + JS) — MANDATORY after any JS/HTML/CSS change
bun run build

# Individual build steps
bun run build:css       # Tailwind CSS (src/main.css → assets/main.css)
bun run build:html      # Partials → HTML files (modals-shared.html etc.)
bun run build:js        # JS → bundled assets/app-<hash>.js

# Syntax check all changed JS files
node --check js/04_auth.js
node --check netlify/functions/_lib/handlers.js

# Syntax check ESM files
node --check --input-type=module < api-client.js

# Audit global pollution
node scripts/audit-globals.mjs --high

# Scan ESM references (must be 0 errors)
bunx eslint --no-warn-ignored --rule 'no-undef: error' --rule 'no-unused-vars: off' api-client.js i18n.js js/core/bridge.js
```

## Test commands

```bash
# Run all tests
bun run test

# Run specific test file
npx vitest run tests/actions-mail.test.js

# Run tests in watch mode
npx vitest

# Check handler aliases (part of build)
bun run check:handlers

# Check i18n parity
bun run check:i18n
```

## Lint & format

```bash
# Lint
bun run lint

# Format check
bun run format:check

# Auto-format
bun run format
```

## Preview server

```bash
# Start preview (port 3000, backend in-process)
node serve-static.mjs

# Or via freebuff
freebuff-preview start
freebuff-preview status
freebuff-preview logs
```

## E2E tests

```bash
# Run E2E tests (requires preview running)
BASE_URL="http://localhost:3000" node e2e/upload-check.mjs
BASE_URL="http://localhost:3000" node e2e/biodata-check.mjs
BASE_URL="http://localhost:3000" node e2e/login-check.mjs
```

## Deploy (REQUIRES EXPLICIT OWNER PERMISSION)

```bash
# Check deploy readiness
freebuff-deploy check

# Deploy
freebuff-deploy start

# Check deploy status
freebuff-deploy status
freebuff-deploy logs
```

## Dedupe candidates

```bash
# Dry-run (read-only)
bun run dedupe

# Apply (with backup)
bun run dedupe:apply
```

## When NOT to use this skill

If the task is "why is this filter broken" or "why does this modal
not open" — that's a debugging task. Use `asj-debug` instead.
If the task is "write an E2E test for upload flow" — use `asj-e2e`.
