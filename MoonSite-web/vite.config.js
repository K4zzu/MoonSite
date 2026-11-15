import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' keeps every asset and data URL relative, so the build works from any sub-path
// (GitHub Pages project sites, Netlify, a USB stick...).
// three.js and React go into their own chunks: they change far less often than the app, so returning visitors
// keep them cached across deploys.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
        },
      },
    },
  },
})
