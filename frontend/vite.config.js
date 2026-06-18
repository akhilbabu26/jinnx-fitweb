import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },

      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
})