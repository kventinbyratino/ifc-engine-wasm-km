import { createServer } from "vite";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const allowedHosts = (process.env.KM_ALLOWED_HOSTS ?? "dev.lab-tim.ru,127.0.0.1,localhost")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

process.env.KM_HMR_HOST ??= process.env.KM_PUBLIC_HOST ?? "dev.lab-tim.ru";
process.env.KM_HMR_PROTOCOL ??= process.env.KM_PUBLIC_PROTOCOL ?? "wss";
process.env.KM_HMR_CLIENT_PORT ??= process.env.KM_PUBLIC_CLIENT_PORT ?? "443";

const server = await createServer({
  root,
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    allowedHosts,
  },
});

await server.listen();
server.printUrls();
