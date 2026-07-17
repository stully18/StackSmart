import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Minimal Vitest config for frontend unit tests.
// Resolves the `@/*` alias so `lib/loans.ts` (which imports `@/types`) works
// under the test runner without pulling in the full Next.js build.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
