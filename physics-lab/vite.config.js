// biology-lab vite config — the Physics room runs on its own port/URL,
// separate from the Chemistry Lab (5173). strictPort fails loudly instead of
// silently stealing another port.
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5176,
    strictPort: true
  },
  preview: {
    port: 5176,
    strictPort: true
  }
});