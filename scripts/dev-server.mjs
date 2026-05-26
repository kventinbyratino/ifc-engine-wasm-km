import { createServer } from "vite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const server = await createServer({
  root,
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
  },
});

await server.listen();
server.printUrls();
