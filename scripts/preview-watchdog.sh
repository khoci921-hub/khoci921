#!/bin/bash
# ============================================================
# preview-watchdog.sh — jaga preview server SELALU hidup.
#
# Latar: CLI platform (freebuff-preview) tidak ter-inject ulang
# setelah sandbox restart, jadi preview mati tanpa ada yang
# menyalakannya lagi. Script ini menjalankan perintah YANG SAMA
# dengan yang dipakai platform (node serve-static.mjs di :3000)
# dan me-restart otomatis kalau mati.
#
# Cara pakai:  sh scripts/preview-watchdog.sh  (biarkan berjalan)
# ============================================================
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
LOG=/tmp/preview-watchdog.log

echo "$(date +%H:%M:%S) watchdog started (root=$ROOT)" >> "$LOG"

while true; do
  if ! curl -sf -o /dev/null -m 5 "http://localhost:3000/"; then
    pkill -f "node serve-static.mjs" 2>/dev/null
    sleep 1
    PORT=3000 nohup node serve-static.mjs >> "$LOG" 2>&1 &
    echo "$(date +%H:%M:%S) preview restarted (pid $!)" >> "$LOG"
  fi
  sleep 10
done
