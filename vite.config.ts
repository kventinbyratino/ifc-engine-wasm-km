import { defineConfig } from "vite";

export default defineConfig({
  base: "/ifc-engine-wasm/",
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("node_modules/web-ifc")) return "vendor-web-ifc";
          if (id.includes("node_modules/three")) return "vendor-three";
          if (id.includes("node_modules/@thatopen")) return "vendor-thatopen";
          if (id.includes("node_modules/camera-controls")) return "vendor-camera-controls";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: ["existed-thinks-triangle-fix.trycloudflare.com"],
  },
});
