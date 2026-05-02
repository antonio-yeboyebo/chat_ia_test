import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Descomenta y ajusta si el servidor Python no tiene CORS configurado:
    // proxy: {
    //   '/comun': {
    //     target: 'http://localhost:5000',
    //     changeOrigin: true,
    //   },
    // },
  },
})
