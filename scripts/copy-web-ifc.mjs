import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(root, "node_modules", "web-ifc");
const targetDir = join(root, "public", "web-ifc");

const files = [
  "web-ifc.wasm",
  "web-ifc-mt.wasm",
  "web-ifc-node.wasm",
  "web-ifc-mt.worker.js",
];

await mkdir(targetDir, { recursive: true });

for (const file of files) {
  const source = join(sourceDir, file);
  try {
    await stat(source);
    await copyFile(source, join(targetDir, file));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
