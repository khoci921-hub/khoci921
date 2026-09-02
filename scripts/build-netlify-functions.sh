#!/bin/bash
# Pre-build Netlify functions: bundle each wrapper + _lib into standalone CJS
# This bypasses Netlify's esbuild which can't resolve .ts from CommonJS require()
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNC_DIR="$ROOT/netlify/functions"
OUT_DIR="$ROOT/.netlify/functions"

echo "── Pre-building Netlify functions ──"

# Clean old built functions
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Bundle each wrapper file
BUNDLED=0
FAILED=0
for wrapper in "$FUNC_DIR"/*.js; do
  name=$(basename "$wrapper" .js)
  outfile="$OUT_DIR/$name.js"

  if npx esbuild "$wrapper" \
    --bundle \
    --platform=node \
    --target=node20 \
    --format=cjs \
    --outfile="$outfile" \
    --log-level=error 2>/dev/null; then
    BUNDLED=$((BUNDLED + 1))
  else
    echo "  ❌ Failed: $name"
    FAILED=$((FAILED + 1))
  fi
done

echo "  ✅ Bundled: $BUNDLED functions"
if [ "$FAILED" -gt 0 ]; then
  echo "  ⚠️  Failed: $FAILED functions"
fi

# Also copy _lib as-is (for Netlify to find if needed)
cp -r "$FUNC_DIR/_lib" "$OUT_DIR/_lib" 2>/dev/null || true

# Ensure functions use CommonJS (root package.json has type:module)
echo '{"type": "commonjs"}' > "$OUT_DIR/package.json"

echo "── Done ──"
