import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The /api proxy makes the browser treat Flask as same-origin, so the session
// cookie just works and we need no CORS config at all.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
})
