#!/usr/bin/env bash
# ship.sh — build + test + lint + commit + push SEKALI JALAN.
#
# Alur tim (README): setiap pekerjaan selesai WAJIB di-commit DAN di-push ke
# main. Skrip ini menjalankan semuanya berurutan dan berhenti di langkah
# pertama yang gagal, supaya tidak ada yang terlupakan.
#
# Pemakaian:
#   ./scripts/ship.sh "pesan commit"
#   bun run ship -- "pesan commit"
#
# Catatan:
# - Commit pakai `git add -A` — file yang di-ignore (.env.local, node_modules,
#   .freebuff) otomatis TIDAK ikut ter-stage.
# - Lint hanya memblokir ERROR (warning gaya tidak).
# - Sebelum push, `git pull --rebase origin main` supaya tidak kena
#   non-fast-forward kalau ada rekan yang push duluan.
set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "❌ Tulis pesan commit, contoh:"
  echo "   ./scripts/ship.sh \"Fix tombol X di modal CV\""
  exit 1
fi

echo "── 1/5 Build (CSS + HTML + JS) ──"
bun run build

echo "── 2/5 Test (Vitest) ──"
bun run test

echo "── 3/5 Lint (error = block; warning tidak) ──"
bun run lint || {
  echo "❌ Lint ada ERROR — perbaiki dulu sebelum ship."
  exit 1
}

echo "── 4/5 Commit ──"
git add -A
if git diff --cached --quiet; then
  echo "ℹ️  Tidak ada perubahan untuk di-commit — selesai."
  exit 0
fi
git status --short
git diff --cached --stat
git commit -m "$MSG"

echo "── 5/5 Push ke origin/main ──"
git pull --rebase origin main
git push origin main
echo "✅ Selesai & ter-push: $(git log --oneline -1)"
