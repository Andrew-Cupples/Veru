/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Two backends sit behind one origin in development: the market data API and the Prompt Ledger API.
// More specific prefixes must come first; Vite matches proxy keys in order.
const marketApi = process.env.MARKET_API ?? 'http://localhost:5080';
const ledgerApi = process.env.LEDGER_API ?? 'http://localhost:5180';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/market': marketApi,
      '/api': ledgerApi,
    },
  },
  test: {
    environment: 'jsdom',
  },
});
