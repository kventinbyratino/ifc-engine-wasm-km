import test from "node:test";
import assert from "node:assert/strict";

import {
  applyClassRemapping,
  validateClassReplacement,
} from "../../src/bim/ifc-overrides/class-mapping.ts";

test("validateClassReplacement accepts compatible IFC remaps", () => {
  const result = validateClassReplacement("IFCWALL", "IFCWALLSTANDARDCASE");
  assert.equal(result.ok, true);
  assert.equal(result.reason, "");
});

test("validateClassReplacement rejects unsafe remaps", () => {
  const result = validateClassReplacement("IFCDOOR", "IFCWALL");
  assert.equal(result.ok, false);
  assert.match(result.reason, /not compatible/i);
});

test("applyClassRemapping updates record category and preserves source class", () => {
  const [record] = applyClassRemapping([
    {
      modelId: "model-a",
      localId: 1,
      name: "Wall 01",
      category: "IFCWALL",
      globalId: "gid-1",
      typeName: "WallType",
      storey: "Level 01",
      number: "A1",
      materialName: "Concrete",
      psetCount: 1,
      searchable: "wall 01",
    },
  ], [{ fromClass: "IFCWALL", toClass: "IFCWALLSTANDARDCASE" }]);

  assert.equal(record.category, "IFCWALLSTANDARDCASE");
  assert.equal(record.sourceCategory, "IFCWALL");
});
