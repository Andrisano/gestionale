import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  // Aggiungiamo questo per vedere meglio gli errori nel terminale
  server: {
    hmr: {
      overlay: true,
    }
  }
})