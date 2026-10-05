import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("three/examples/jsm/postprocessing")) {
            return "postprocessing";
          }

          if (id.includes("node_modules/three")) {
            return "three";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
