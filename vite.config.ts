import { defineConfig } from "vite";

const manualChunks = (id: string) => {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("node_modules/web-ifc")) return "vendor-web-ifc";
  if (id.includes("node_modules/three")) return "vendor-three";
  if (id.includes("node_modules/@thatopen/components-front")) return "vendor-thatopen-components-front";
  if (id.includes("node_modules/@thatopen/components")) return "vendor-thatopen-components";
  if (id.includes("node_modules/@thatopen/fragments")) return "vendor-thatopen-fragments";
  if (id.includes("node_modules/@thatopen/ui-obc")) return "vendor-thatopen-ui-obc";
  if (id.includes("node_modules/@thatopen/ui")) return "vendor-thatopen-ui";
  if (id.includes("node_modules/camera-controls")) return "vendor-camera-controls";
  return "vendor";
};

const hmrHost = process.env.KM_HMR_HOST;
const hmrProtocol = process.env.KM_HMR_PROTOCOL;
const hmrClientPort = process.env.KM_HMR_CLIENT_PORT;
const hmrOptions =
  hmrHost || hmrProtocol || hmrClientPort
    ? {
        host: hmrHost,
        protocol: hmrProtocol,
        clientPort: hmrClientPort ? Number(hmrClientPort) : undefined,
      }
    : undefined;

export default defineConfig({
  base: "/blue/km/",
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
    worker: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: ["dev.lab-tim.ru", "127.0.0.1", "localhost", "existed-thinks-triangle-fix.trycloudflare.com"],
    ...(hmrOptions ? { hmr: hmrOptions } : {}),
  },
});
