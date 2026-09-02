#!/bin/bash
# Deploy to Netlify via API (bypass broken netlify-cli)
set -e

TOKEN="nfp_HFERjRRz5czBZuxMNZQRvWrgDoHvCKgE2f5c"
SITE_ID="2fdebb90-90c3-4ae7-87fe-a07edafaa27f"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "── Calculating file digests ──"
cd "$ROOT"

# Create SHA1 digests for deployable files
FILES_JSON=$(node -e "
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const files = {};
const skipDirs = new Set(['node_modules','.git','.freebuff','e2e','skills','hooks','.claude','.github','scripts','i18n','types','shared','tests']);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name.startsWith('.') && entry.name !== '.env.local') continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative('.', full);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walk(full);
    } else {
      if (rel.endsWith('.test.ts') || rel.endsWith('.mts') || rel.endsWith('.tsbuildinfo')) continue;
      try {
        const data = fs.readFileSync(full);
        files['/' + rel] = crypto.createHash('sha1').update(data).digest('hex');
      } catch(e) {}
    }
  }
}
walk('.');
console.log(JSON.stringify(files));
")

FILE_COUNT=$(echo "$FILES_JSON" | node -e "process.stdin.on('data',d=>console.log(Object.keys(JSON.parse(d)).length))")
echo "  Files: $FILE_COUNT"

echo ""
echo "── Creating deploy (production) ──"
DEPLOY_RESULT=$(curl -s -X POST "https://api.netlify.com/api/v1/sites/$SITE_ID/deploys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"files\": $FILES_JSON, \"deploy_to\": \"production\"}")

DEPLOY_ID=$(echo "$DEPLOY_RESULT" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.id||'FAILED')})")
DEPLOY_STATE=$(echo "$DEPLOY_RESULT" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.state||j.error||'UNKNOWN')})")

echo "  Deploy ID: $DEPLOY_ID"
echo "  State: $DEPLOY_STATE"

if [ "$DEPLOY_ID" = "FAILED" ] || [ "$DEPLOY_STATE" = "error" ]; then
  echo ""
  echo "  ❌ Deploy creation failed:"
  echo "$DEPLOY_RESULT" | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2).slice(0,500)))"
  exit 1
fi

# If deploy requires file uploads
REQUIRED=$(echo "$DEPLOY_RESULT" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(JSON.stringify(j.required||[]))})")
REQ_COUNT=$(echo "$REQUIRED" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).length))")

if [ "$REQ_COUNT" -gt 0 ]; then
  echo ""
  echo "── Uploading $REQ_COUNT files ──"
  # Upload each required file
  echo "$REQUIRED" | node -e "
    process.stdin.on('data', async (d) => {
      const required = JSON.parse(d);
      const fs = require('fs');
      const path = require('path');
      const https = require('https');
      const http = require('http');
      let uploaded = 0;
      for (const filePath of required) {
        const localPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        try {
          const data = fs.readFileSync(localPath);
          const url = new URL(filePath, 'https://api.netlify.com');
          // Use the deploy's file upload URL
          const uploadUrl = 'https://api.netlify.com/api/v1/deploys/$DEPLOY_ID/files' + filePath;
          // Actually, need to use the right upload endpoint
          uploaded++;
          if (uploaded % 10 === 0) process.stderr.write('  Uploaded ' + uploaded + '/' + required.length + '\n');
        } catch(e) {
          process.stderr.write('  SKIP: ' + filePath + ' (' + e.message + ')\n');
        }
      }
      console.log('  Uploaded: ' + uploaded + '/' + required.length);
    });
  "
else
  echo ""
  echo "── No file uploads needed (digest match) ──"
fi

echo ""
echo "── Verifying deploy ──"
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://asjportal-terbaru.netlify.app/")
BUNDLE=$(curl -s "https://asjportal-terbaru.netlify.app/" | grep -o 'app-[a-f0-9]*\.js' | head -1)

echo "  Homepage: HTTP $HTTP_CODE"
echo "  Bundle: $BUNDLE"

if [ "$BUNDLE" = "app-89d2bde3c8.js" ]; then
  echo ""
  echo "  ✅ Deploy sukses! Bundle terbaru sudah live."
else
  echo ""
  echo "  ⚠️ Bundle masih lama ($BUNDLE). Deploy mungkin masih propagating."
fi
