import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['three', 'three/*', '../render/*', '../ui/*', '../input/*'] },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'requestAnimationFrame',
      ],
    },
  },
  { files: ['eslint.config.js'], extends: [tseslint.configs.disableTypeChecked] },
  prettier,
);
