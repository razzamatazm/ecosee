import { defineConfig } from 'vite';

// Static build of the interactive preview harness (dev/) for GitHub Pages — the
// live demo linked from the README. `base` is the project-pages path so the built
// index.html resolves its bundle under https://razzamatazm.github.io/ecosee/. The
// bundled Montserrat faces are imported as `?inline` data URIs (see
// src/styles/bundled-font.ts), so the output is fully self-contained.
export default defineConfig({
  root: 'dev',
  base: '/ecosee/',
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
    target: 'es2021',
  },
});
