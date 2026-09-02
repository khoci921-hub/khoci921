// ESLint flat config (ESLint 10 + typescript-eslint 8).
// Updated: target .ts files with @typescript-eslint/parser (2026-08-24).
// no-undef aktif untuk SEMUA frontend files (.js + .ts) — semua referensi
// global sudah di-window-kan eksplisit via registerSeamAliases (bridge.ts).
// .mjs (scripts/, e2e/) & netlify functions (CommonJS) tetap tanpa no-undef.
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['assets/**', 'vendor/**', 'node_modules/**', 'dist/**', '*.html'],
  },
  // Base config for all JS files
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      eqeqeq: 'warn',
    },
  },
  // TypeScript files with TS parser
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.ts', '**/*.mts'],
  })),
  {
    files: ['**/*.ts', '**/*.mts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      eqeqeq: 'warn',
      // Disable noisy rules for JS-in-TS codebase (36/54 files are pure JS)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-var': 'off',
      'prefer-const': 'off',
    },
  },
  // Frontend ESM: no-undef for all frontend files
  {
    files: [
      'js/**/*.ts',
      'js/**/*.js',
      'api-client.ts',
      'i18n.ts',
      'pwa.ts',
      'api-client.js',
      'i18n.js',
      'pwa.js',
    ],
    rules: {
      'no-undef': 'error',
    },
  },
);
