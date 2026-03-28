import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*.{ts,tsx}': ['vp lint --fix', 'vp fmt . --write'],
    '*.{json,md,yaml,yml,css}': 'prettier --write',
  },
  test: {
    include: ['cli/src/**/*.test.ts', 'skills/**/*.test.ts'],
    exclude: ['hooks/**', 'scripts/**', 'node_modules/**'],
  },
});
