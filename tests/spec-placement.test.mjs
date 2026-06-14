import test from "node:test";
import assert from "node:assert/strict";

import {
  addSpecBlock,
  createSpecBlocksFromRows,
  moveSpecBlock,
  removeSpecBlock,
} from "../src/bim/sheets/spec-placement.ts";

const rows = [
  { category: "IFCWALL", storey: "01", count: 3 },
  { category: "IFCWINDOW", storey: "01", count: 2 },
  { category: "IFCDOOR", storey: "02", count: 4 },
  { category: "IFCSLAB", storey: "02", count: 1 },
  { category: "IFCCOLUMN", storey: "03", count: 7 },
];

test("createSpecBlocksFromRows splits rows into titled blocks", () => {
  const blocks = createSpecBlocksFromRows(rows, { title: "Спецификация", maxRowsPerBlock: 2 });

  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].title, "Спецификация 1/3");
  assert.equal(blocks[1].title, "Спецификация 2/3");
  assert.equal(blocks[2].title, "Спецификация 3/3");
  assert.deepEqual(blocks[0].rows, rows.slice(0, 2));
  assert.deepEqual(blocks[1].rows, rows.slice(2, 4));
  assert.deepEqual(blocks[2].rows, rows.slice(4));
});

test("addSpecBlock removeSpecBlock and moveSpecBlock preserve ordering", () => {
  const blocks = createSpecBlocksFromRows(rows.slice(0, 3), { title: "Спецификация", maxRowsPerBlock: 2 });
  const extra = {
    id: "spec-extra",
    title: "Ведомость",
    rows: [{ category: "IFCSPACE", storey: "03", count: 8 }],
  };

  const added = addSpecBlock(blocks, extra);
  assert.equal(added.at(-1)?.id, "spec-extra");

  const moved = moveSpecBlock(added, "spec-extra", 0);
  assert.equal(moved[0].id, "spec-extra");
  assert.equal(moved[1].title, "Спецификация 1/2");

  const removed = removeSpecBlock(moved, "spec-extra");
  assert.equal(removed.some((block) => block.id === "spec-extra"), false);
  assert.equal(removed.length, blocks.length);
});
