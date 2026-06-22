import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function patchImportSpecifiers(content, specifierMap = {}) {
  let patched = content;
  for (const [from, to] of Object.entries(specifierMap)) {
    const pattern = new RegExp(`(["'])${escapeRegExp(from)}\\1`, "g");
    patched = patched.replace(pattern, (_match, quote) => `${quote}${to}${quote}`);
  }
  return patched;
}

export async function copyPatchedModule({
  srcRoot,
  tempRoot,
  sourceRelative,
  targetRelative = sourceRelative,
  specifierMap = {},
  rawReplacements = [],
}) {
  const source = path.join(srcRoot, sourceRelative);
  const target = path.join(tempRoot, targetRelative);
  await mkdir(path.dirname(target), { recursive: true });

  let content = await readFile(source, "utf8");
  content = patchImportSpecifiers(content, specifierMap);
  for (const [from, to] of rawReplacements) {
    content = content.replaceAll(from, to);
  }

  const helperDependencies = [
    ["../storage/local-storage-json.ts", "storage/local-storage-json.ts"],
  ];
  for (const [specifier, relativePath] of helperDependencies) {
    if (!content.includes(specifier)) continue;
    const helperSource = path.join(srcRoot, relativePath);
    const helperTarget = path.join(tempRoot, relativePath);
    await mkdir(path.dirname(helperTarget), { recursive: true });
    await writeFile(helperTarget, await readFile(helperSource, "utf8"));
  }

  await writeFile(target, content);
}

export async function copyModuleFromAbsolute({ source, tempRoot, targetRelative }) {
  const target = path.join(tempRoot, targetRelative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await readFile(source, "utf8"));
}
