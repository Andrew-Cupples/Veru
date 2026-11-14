/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone dev shell for the Prompt Ledger module. The broader app imports the
// package source directly (see package.json "exports"), so this config is dev-only.
const apiTarget = process.env.LEDGER_API ?? 'http://localhost:5180';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5181,
    strictPort: true,
    proxy: { '/api': apiTarget },
  },
  test: {
    environment: 'jsdom',
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
