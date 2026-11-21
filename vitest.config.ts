import { defineConfig } from 'vitest/config';
import { COVERAGE_LINES } from './scripts/verify.mjs';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/**/*.test.ts', 'e2e/support/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/model/**', 'src/shared/config/**'],
      exclude: ['**/*.test.{ts,tsx}'],
      thresholds: { lines: COVERAGE_LINES },
    },
  },
});
