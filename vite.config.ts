
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Cela permet d'utiliser process.env.API_KEY dans votre code frontend
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  server: {
    host: true,
  },
});
