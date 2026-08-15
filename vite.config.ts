import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Respeita a porta que o ambiente atribuir; 5173 quando ninguém atribui nada.
    port: Number(process.env.PORT) || 5173,
    // Em produção o mesmo Worker serve o app e a API, então `/api` é caminho
    // relativo e não existe CORS. No dev são dois processos, e este proxy
    // recria a mesma origem única — inclusive para o WebSocket da sala, que sem
    // `ws: true` não sobreviveria ao upgrade.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.API_PORT || 8787}`,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
