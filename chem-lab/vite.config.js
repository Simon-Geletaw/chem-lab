// chem-lab vite config — the Chemistry Lab (hub) runs on port 5173, separate
// from the subject labs (biology 5174, math 5175, physics 5176). strictPort
// fails loudly instead of silently stealing another port.
//
// base: the app is served under /c/ when the lab backend hosts all labs on one
// origin (http://localhost:8080/c/). Override with BASE_PATH=/ for a
// root-level deploy (e.g. Vercel).
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/c/',
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 5173,
    strictPort: true
  }
});