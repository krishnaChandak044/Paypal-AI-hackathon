import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/campaigns': 'http://127.0.0.1:8000',
      '/requests': 'http://127.0.0.1:8000',
      '/needs': 'http://127.0.0.1:8000',
      '/payouts': 'http://127.0.0.1:8000',
      '/paypal': 'http://127.0.0.1:8000',
      '/recipient': 'http://127.0.0.1:8000',
      '/spending': 'http://127.0.0.1:8000',
      '/receipts': 'http://127.0.0.1:8000',
      '/bootstrap': 'http://127.0.0.1:8000',
      '/members': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
});

