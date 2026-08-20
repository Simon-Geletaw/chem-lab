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
  },
  build: {
    rollupOptions: {
      output: {
        // vendor-split: three core (build/three.module.js) and three/addons
        // (examples/jsm/*) land in stable named chunks, so the ~1 MB vendor
        // bytes are cached across labs and page loads while the app chunk
        // stays small.
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            if (id.includes('examples/jsm') || id.includes('examples\\jsm')) {
              return 'vendor-three-addons';
            }
            return 'vendor-three';
          }
        }
      }
    }
  }
});