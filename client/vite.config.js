import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Two build modes:
//  • client (default) → dist/  — the browser bundle, code-split + vendor chunk
//  • SSR (`vite build --ssr`) → dist-ssr/entry-server.cjs — a CommonJS module the
//    Express server require()s to render pages on the server.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  build: isSsrBuild
    ? {
        outDir: 'dist-ssr',
        emptyOutDir: true,
        ssr: 'src/entry-server.jsx',
        rollupOptions: {
          // ESM output so react-router-dom's ESM-only server build loads cleanly;
          // the CommonJS Express server pulls it in via dynamic import().
          output: { format: 'es', entryFileNames: 'entry-server.mjs' },
        },
      }
    : {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          output: {
            // Keep the rarely-changing framework code in its own long-cached chunk,
            // separate from app code, so app-only deploys don't force a re-download.
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom', 'react-toastify'],
            },
          },
        },
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
}))
