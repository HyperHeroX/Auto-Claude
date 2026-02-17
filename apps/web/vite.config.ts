import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../frontend/src/renderer'),
      '@shared': resolve(__dirname, '../frontend/src/shared'),
      '@platform': resolve(__dirname, 'src/platform'),
      '@components': resolve(__dirname, '../frontend/src/renderer/shared/components'),
      '@hooks': resolve(__dirname, '../frontend/src/renderer/shared/hooks'),
      '@lib': resolve(__dirname, '../frontend/src/renderer/shared/lib'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
