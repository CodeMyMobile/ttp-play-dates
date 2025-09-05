import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Ensure correct asset paths for GitHub Pages
  base: '/ttp-play-dates/',
  plugins: [react()],
})
