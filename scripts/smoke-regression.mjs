#!/usr/bin/env node
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = { dist: "dist" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dist") {
      args.dist = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

async function mustRead(filePath, label) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`missing ${label}: ${filePath}`);
  }
}

async function listAssetFiles(dist) {
  const assetsDir = path.join(dist, "assets");
  await access(assetsDir);
  const names = await readdir(assetsDir);
  return names.map((name) => path.join(assetsDir, name));
}

function extractAssetRefs(indexHtml) {
  return Array.from(indexHtml.matchAll(/(?:src|href)=["']([^"']*assets\/[^"']+)["']/g), (match) => match[1]);
}

async function assertAssetRefsExist(dist, indexHtml) {
  const refs = extractAssetRefs(indexHtml);
  if (refs.length === 0) throw new Error("missing built asset references in index.html");

  for (const ref of refs) {
    const cleanRef = ref.replace(/^\//, "");
    const assetsIndex = cleanRef.indexOf("assets/");
    const assetPath = path.join(dist, cleanRef.slice(assetsIndex));
    await access(assetPath);
  }
}

async function assertNonEmptyAssets(assetFiles) {
  if (assetFiles.length === 0) throw new Error("missing assets directory files");
  for (const assetFile of assetFiles) {
    const info = await stat(assetFile);
    if (info.size === 0) throw new Error(`empty built asset: ${assetFile}`);
  }
}

async function assertDrawingRuntimeMarkers(assetFiles) {
  const jsFiles = assetFiles.filter((file) => file.endsWith(".js") || file.endsWith(".mjs"));
  const combined = (await Promise.all(jsFiles.map((file) => readFile(file, "utf8")))).join("\n");
  const markers = ["drawingsPanel", "generateDrawingBtn", "Чертёж", "Размер", "Выноска", "АР, КР"];
  if (!markers.some((marker) => combined.includes(marker))) {
    throw new Error("missing drawing runtime marker in built JS assets");
  }
}

export async function runSmokeRegression({ dist = "dist" } = {}) {
  const resolvedDist = path.resolve(dist);
  const indexHtml = await mustRead(path.join(resolvedDist, "index.html"), "dist index.html");
  if (!indexHtml.includes("app")) throw new Error("index.html does not contain app mount marker");

  const assetFiles = await listAssetFiles(resolvedDist);
  await assertAssetRefsExist(resolvedDist, indexHtml);
  await assertNonEmptyAssets(assetFiles);
  await assertDrawingRuntimeMarkers(assetFiles);

  return {
    dist: resolvedDist,
    assets: assetFiles.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runSmokeRegression(parseArgs(process.argv.slice(2)));
    console.log(`smoke-regression ok: ${result.assets} assets checked in ${result.dist}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
