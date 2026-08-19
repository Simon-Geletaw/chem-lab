// chem-lab vite config — the Chemistry Lab (hub) runs on port 5173, separate
// from the subject labs (biology 5174, math 5175, physics 5176). strictPort
// fails loudly instead of silently stealing another port.
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 5173,
    strictPort: true
  }
});