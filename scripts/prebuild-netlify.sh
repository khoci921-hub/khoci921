#!/bin/bash
# Prebuild for Netlify: strip .ts extensions from backend imports
# Netlify's esbuild doesn't resolve .ts extensions in import paths
# This script strips them before esbuild bundles the functions
echo "[prebuild-netlify] Stripping .ts extensions from backend imports..."
find netlify/functions/_lib -name '*.ts' ! -name '*.test.ts' -exec sed -i "s/from '\(\.\/[^']*\)\.ts'/from '\1'/g" {} +
echo "[prebuild-netlify] Done ✅"
