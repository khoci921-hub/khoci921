import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve .js imports to .ts files during test runs
    },
    extensions: ['.ts', '.mts', '.js', '.mjs', '.json'],
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.mts'],
    exclude: ['node_modules', 'assets', 'vendor', 'e2e', '.freebuff'],
  },
});
