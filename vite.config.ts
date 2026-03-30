import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*.{ts,tsx}': ['vp lint --fix', 'vp fmt . --write'],
    '*.{json,md,yaml,yml,css}': 'prettier --write',
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['cli/src/**/*.test.ts', 'skills/**/*.test.ts'],
          exclude: ['cli/src/__e2e__/**', 'hooks/**', 'scripts/**', 'node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['cli/src/__e2e__/**/*.test.ts'],
          testTimeout: 15_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
