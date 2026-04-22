import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/frontend', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('echarts') || id.includes('vue-echarts') || id.includes('zrender')) {
            return 'echarts'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
