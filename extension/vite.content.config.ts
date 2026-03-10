import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // IMPORTANT: don't wipe dist produced by the main build
    target: 'es2019',
    rollupOptions: {
      input: resolve(__dirname, 'src/content.ts'),
      output: {
        // Classic-script friendly: no ESM imports
        format: 'iife',
        entryFileNames: 'content.js',

        // Force a single file bundle (no shared chunks like logger.js)
        inlineDynamicImports: true,
      },
    },
  },
});
