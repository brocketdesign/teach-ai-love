import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  optimizeDeps: {
    include: ['three', '@tensorflow/tfjs', 'tone', 'lil-gui'],
  },
  server: {
    port: 3000,
    open: true,
  },
});
