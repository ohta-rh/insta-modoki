import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'coverage/**',
      'node_modules/**',
      'next-env.d.ts',
      'cloudflare-env.d.ts',
      'test-results/**',
      'playwright-report/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
