import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // xóa 2 dòng dưới nếu không chạy với docker
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        // OLD (localhost): target: 'http://127.0.0.1:8000',
        target: process.env.BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})
