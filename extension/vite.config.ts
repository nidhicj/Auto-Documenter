import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Recursive copy function
function copyRecursiveSync(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  define: {
    'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || 'http://localhost:3001'),
  },
  build: {
    outDir: 'dist',
    // Ensure ES module format for Chrome extension
    target: 'esnext',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'src/popup/popup.ts'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    copyPublicDir: false,
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
        copyFileSync('src/popup/popup.html', 'dist/popup.html');
        
        // Copy icons folder
        if (existsSync('icons')) {
          copyRecursiveSync('icons', 'dist/icons');
          console.log('[Vite] Copied icons folder to dist');
        } else {
          console.warn('[Vite] Icons folder not found');
        }
      },
    },
  ],
});
