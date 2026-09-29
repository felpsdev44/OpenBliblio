// Sobe a tela em desenvolvimento. A API continua no server.js, porta 3001.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
