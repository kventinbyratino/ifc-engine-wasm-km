import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../src/bim/sheets/pdf-export.ts", import.meta.url), "utf8");

test("sheet PDF/print export does not depend on popup window.open", () => {
  assert.doesNotMatch(source, /window\.open\(/);
  assert.match(source, /document\.createElement\(\"iframe\"\)/);
  assert.match(source, /contentWindow\.print\(\)/);
});
