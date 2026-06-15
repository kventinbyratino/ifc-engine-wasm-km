import test from "node:test";
import assert from "node:assert/strict";

import { parseOverrideValue } from "../../src/bim/ifc-overrides/override-utils.ts";

test("parseOverrideValue preserves booleans and numbers", () => {
  assert.equal(parseOverrideValue("true"), true);
  assert.equal(parseOverrideValue("false"), false);
  assert.equal(parseOverrideValue(" 42 "), 42);
  assert.equal(parseOverrideValue(" 3.5 "), 3.5);
});

test("parseOverrideValue falls back to trimmed text and null for empty input", () => {
  assert.equal(parseOverrideValue("   "), null);
  assert.equal(parseOverrideValue(" EI60 "), "EI60");
});
