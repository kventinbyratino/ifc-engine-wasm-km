import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { createRequire } from "node:module";
import { IfcImporter } from "@thatopen/fragments";

const require = createRequire(import.meta.url);
const root = process.cwd();
const wasmPath = join(root, "node_modules", "web-ifc") + "/";

const args = parseArgs(process.argv.slice(2));
if (!args.source || !args.artifact || !args.manifest) {
  throw new Error("Usage: node backend/convert-ifc.mjs --source <path> --artifact <path> --manifest <path> [--name <name>] [--job-id <id>] [--source-name <name>]");
}

const startedAt = new Date().toISOString();
const sourceBytes = new Uint8Array(await readFile(args.source));
const importer = new IfcImporter();
importer.wasm.path = wasmPath;
importer.wasm.absolute = true;
importer.addAllAttributes();
importer.addAllRelations();

await mkdir(dirname(args.artifact), { recursive: true });
await mkdir(dirname(args.manifest), { recursive: true });

const artifactBytes = await importer.process({
  bytes: sourceBytes,
  raw: true,
  readFromCallback: false,
});

await writeFile(args.artifact, artifactBytes);

const manifest = {
  kind: "ifc-conversion-artifact",
  version: 1,
  job_id: args.jobId ?? null,
  name: args.name ?? args.sourceName ?? "model.ifc",
  source_filename: args.sourceName ?? args.name ?? "model.ifc",
  source_size_bytes: sourceBytes.byteLength,
  artifact_filename: basename(args.artifact),
  artifact_size_bytes: artifactBytes.byteLength,
  status: "completed",
  created_at: startedAt,
};

await writeFile(args.manifest, JSON.stringify(manifest, null, 2), "utf-8");
console.log(JSON.stringify({ ok: true, artifact_size_bytes: artifactBytes.byteLength }));
process.exit(0);

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      i += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}
