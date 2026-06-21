import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: 'all',
    semi: true,
    tabWidth: 2,
    useTabs: false,
    endOfLine: 'lf',
    bracketSpacing: true,
    arrowParens: 'always',
    ignorePatterns: [
      'dist/**',
      'coverage/**',
      'pnpm-lock.yaml',
      'hooks/**',
      'scripts/**',
      'commands/**',
    ],
    overrides: [{ files: ['*.md'], options: { proseWrap: 'always', printWidth: 100 } }],
    sortImports: {
      newlinesBetween: true,
      groups: ['builtin', 'external', ['parent', 'sibling', 'index'], 'style', 'unknown'],
    },
  },
  staged: {
    '*.{ts,tsx}': ['vp lint --fix', 'vp fmt . --write'],
    '*.{json,md,yaml,yml}': 'vp fmt . --write',
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
          globalSetup: ['cli/src/__e2e__/globalSetup.ts'],
          testTimeout: 15_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
