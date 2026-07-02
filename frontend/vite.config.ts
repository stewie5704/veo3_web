import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

// Hỗ trợ build landing: npm run build:landing
// React + Vite Static Export → output static HTML+JS+CSS vào ../landing
// Dùng:  $env:BUILD_LANDING=1; npm run build:landing   (PowerShell)
// Hoặc:  npm run build:landing   (và config tự detect)
const isLanding = process.env.BUILD_LANDING === '1' || process.argv.some(a => a.includes('landing') || a.includes('BUILD_LANDING'))

export default defineConfig({
  plugins: [
    react(),
    // Force output index.html (cho static landing root) thay vì landing.html
    {
      name: 'rename-landing-html',
      closeBundle() {
        if (!isLanding) return
        const out = path.resolve(__dirname, '../landing')
        const src = path.join(out, 'landing.html')
        const dest = path.join(out, 'index.html')
        if (fs.existsSync(src)) {
          if (fs.existsSync(dest)) fs.unlinkSync(dest)
          fs.renameSync(src, dest)
          // optional: log
          // console.log('✅ landing/index.html ready (React build)')
        }
      }
    }
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/images': 'http://localhost:8000',
      '/audio': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    }
  },
  build: isLanding
    ? {
        outDir: '../landing',
        emptyOutDir: false, // Giữ samples/ videos + không xoá file tĩnh cũ
        rollupOptions: {
          input: resolve(__dirname, 'landing.html'),
          output: {
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]'
          }
        }
      }
    : {
        rollupOptions: {
          input: resolve(__dirname, 'index.html')
        }
      }
})
