import { configDefaults, defineConfig } from 'vitest/config';

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
    // test/browser/** runs in real headless Firefox via vitest.browser.config.ts
    // (issue #85) — it asserts on rendered boxes/pixels, which need a real engine.
    exclude: [...configDefaults.exclude, 'test/browser/**'],
    environment: 'node',
  },
});
