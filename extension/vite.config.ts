import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'src/popup/popup.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',  // Remove hash from chunk filenames
        assetFileNames: '[name].[ext]',
        // Completely disable chunking
        manualChunks: undefined,
      },
      // Prevent optimizations that create shared chunks
      preserveEntrySignatures: 'strict',
    },
    copyPublicDir: false,
    minify: false,  // Disable minification to see the actual code structure
    // Disable chunk size warnings
    chunkSizeWarningLimit: 10000,
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
        copyFileSync('src/popup/popup.html', 'dist/popup.html');
        
        // Copy icons directory
        const iconsDir = resolve(__dirname, 'icons');
        const distIconsDir = resolve(__dirname, 'dist/icons');
        
        if (existsSync(iconsDir)) {
          mkdirSync(distIconsDir, { recursive: true });
          const files = readdirSync(iconsDir);
          files.forEach(file => {
            const srcPath = join(iconsDir, file);
            const destPath = join(distIconsDir, file);
            if (statSync(srcPath).isFile()) {
              copyFileSync(srcPath, destPath);
            }
          });
        }
      },
    },
  ],
});
