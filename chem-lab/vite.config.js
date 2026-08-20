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