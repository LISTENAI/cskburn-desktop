import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import autoprefixer from 'autoprefixer';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  resolve: {
    alias: {
      '@': resolve('./src'),
    },
  },

  plugins: [
    vue(),
  ],

  // Match syntax target to the oldest WebView we support per README
  // (macOS 13 Ventura ≈ Safari 16, Ubuntu 22.04 WebKitGTK 2.36 ≈ Safari 15.4,
  // Win10 WebView2). Runtime APIs newer than ES2022 must be polyfilled
  // explicitly — see src/polyfills.ts.
  build: {
    target: ['es2022', 'chrome108', 'safari15.4', 'edge108'],
  },

  css: {
    postcss: {
      plugins: [
        autoprefixer(),
      ],
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}));
