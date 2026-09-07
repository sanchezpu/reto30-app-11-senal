import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Puerto de preview fijo y con strictPort: sin el, vite se cambia de puerto
  // en silencio si el 4173 esta ocupado por otra app del reto y acabas
  // capturando la portada equivocada.
  server: { proxy: { '/api': 'http://localhost:3011' } },
  preview: { proxy: { '/api': 'http://localhost:3011' } },
})
