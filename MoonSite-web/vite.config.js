import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' keeps every asset and data URL relative, so the build works from any sub-path
// (GitHub Pages project sites, Netlify, a USB stick...).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 },
})
