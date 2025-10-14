import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  // Ensure correct asset paths for GitHub Pages
  base: '/ttp-play-dates/',
  plugins: [react()],
  resolve: {
    alias: {
      '@tanstack/react-query': resolve(
        __dirname,
        'src/utils/react-query-shim.js',
      ),
    },
  },
})
