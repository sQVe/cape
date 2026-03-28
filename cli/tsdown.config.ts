import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: 'esm',
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
});
