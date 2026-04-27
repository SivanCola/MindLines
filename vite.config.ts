import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react';
          }
          if (id.includes('/node_modules/react-markdown/') || id.includes('/node_modules/remark-gfm/')) {
            return 'markdown';
          }
          if (id.includes('/node_modules/lucide-react/')) {
            return 'icons';
          }
          if (id.includes('/node_modules/@dnd-kit/')) {
            return 'dnd';
          }
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  }
});
