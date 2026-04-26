import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/]three[\\/]/.test(id) && !/[\\/]@react-three/.test(id)) {
            return "vendor-three"
          }
          if (/[\\/]node_modules[\\/]@react-three[\\/]/.test(id)) {
            return "vendor-r3f"
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        ws: true
      }
    }
  }
})
