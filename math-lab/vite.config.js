// math-lab vite config — the Mathematics room runs on its own port/URL,
// separate from the Chemistry Lab (5173). strictPort fails loudly instead of
// silently stealing another port.
//
// base: served under /m/ when the lab backend hosts all labs on one origin.
// Override with BASE_PATH=/ for a root-level deploy.
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/m/',
  server: {
    port: 5175,
    strictPort: true
  },
  preview: {
    port: 5175,
    strictPort: true
  }
});