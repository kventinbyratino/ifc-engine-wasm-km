import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../src/bim/ui/checks-panel.ts", import.meta.url), "utf8");

test("health-check Issue buttons are accessible and protected from duplicate submits", () => {
  assert.match(source, /issueButton\.setAttribute\(\"aria-label\",/);
  assert.match(source, /issueButton\.disabled\s*=\s*true/);
  assert.match(source, /onCreateIssue\(issue\)/);
});
