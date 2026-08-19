// biology-lab vite config — the Biology room runs on its own port/URL,
// separate from the Chemistry Lab (5173). strictPort fails loudly instead of
// silently stealing another port.
//
// base: served under /b/ when the lab backend hosts all labs on one origin.
// Override with BASE_PATH=/ for a root-level deploy.
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/b/',
  server: {
    port: 5174,
    strictPort: true
  },
  preview: {
    port: 5174,
    strictPort: true
  }
});