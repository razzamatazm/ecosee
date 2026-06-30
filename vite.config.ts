import { defineConfig } from 'vitest/config';

// Single self-contained ES module for HACS (Lit is bundled in, not externalized,
// so the card is self-sufficient inside Home Assistant). The dev server serves the
// preview harness under dev/ — see dev/index.html.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/ecosee-card.ts',
      formats: ['es'],
      fileName: () => 'ecosee.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2021',
    minify: 'esbuild',
  },
  server: {
    open: '/dev/',
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
