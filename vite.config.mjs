import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Im Entwicklungsmodus braucht Vites Hot-Reload ein Inline-Skript; die strenge
// Content-Security-Policy gilt deshalb nur für die gebaute App.
const devCsp = {
  name: 'ythub-dev-csp',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, ''),
};

export default defineConfig({
  root: 'src/renderer',
  base: './', // relative Pfade, damit die gebaute App per file:// lädt
  plugins: [react(), devCsp],
  server: { port: 5173, strictPort: true },
  build: { outDir: '../../dist', emptyOutDir: true },
});
