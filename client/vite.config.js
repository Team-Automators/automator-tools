import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/copywrite': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/install': 'http://localhost:3000',
      '/verify': 'http://localhost:3000',
      '/action': 'http://localhost:3000',
    },
  },
})
