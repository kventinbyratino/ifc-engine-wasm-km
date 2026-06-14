import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-exporter-tests-"));
const srcRoot = "/home/maks/projects/IFC_engine_wasm/src/bim/data";

async function copyPatched(filename, replacements = []) {
  const source = path.join(srcRoot, filename);
  const target = path.join(tempRoot, filename);
  await mkdir(path.dirname(target), { recursive: true });
  let content = await readFile(source, "utf8");
  for (const [from, to] of replacements) content = content.replaceAll(from, to);
  await writeFile(target, content);
}

async function copyFromAbsolute(source, targetName) {
  const target = path.join(tempRoot, targetName);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await readFile(source, "utf8"));
}

await copyPatched("element-record.ts");
await copyPatched("exporters.ts");
await copyFromAbsolute("/home/maks/projects/IFC_engine_wasm/src/bim/ui/dom-utils.ts", "ui/dom-utils.ts");
await copyPatched("elements-table.ts", [
  ["./element-record", "./element-record.ts"],
  ["../ui/dom-utils", "./ui/dom-utils.ts"],
]);

const exportersUrl = pathToFileURL(path.join(tempRoot, "exporters.ts")).href;
const elementsTableUrl = pathToFileURL(path.join(tempRoot, "elements-table.ts")).href;

const { exportElementsCsv, fillSelectOptions } = await import(exportersUrl);
const { renderElementsTable } = await import(elementsTableUrl);

test("exporters canonical module downloads CSV with expected header and cells", () => {
  const downloads = [];
  const originalDocument = globalThis.document;
  const originalBlob = globalThis.Blob;
  const originalUrl = globalThis.URL;
  const originalOption = globalThis.Option;

  try {
    globalThis.Blob = class Blob {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    };
    globalThis.document = {
      createElement(tag) {
        if (tag === "a") {
          return {
            href: "",
            download: "",
            click() {
              downloads.push({ href: this.href, download: this.download });
            },
          };
        }
        throw new Error(`Unexpected tag: ${tag}`);
      },
    };
    globalThis.URL = {
      createObjectURL(blob) {
        downloads.push({ blob });
        return "blob:download";
      },
      revokeObjectURL() {},
    };
    globalThis.Option = class Option {
      constructor(text, value) {
        this.text = text;
        this.value = value;
      }
    };

    exportElementsCsv([
      {
        modelId: "m1",
        localId: 1,
        category: "IFCWALL",
        name: "Wall, 01",
        globalId: "gid1",
        typeName: "WallType",
        storey: "Level 01",
        materialName: "Concrete",
        psetCount: 2,
        searchable: "wall 01",
      },
    ]);

    const blob = downloads.find((entry) => entry.blob)?.blob;
    assert.equal(blob.options.type, "text/csv;charset=utf-8");
    assert.match(blob.parts[0], /modelId,localId,ifcClass,name,globalId,type,storey,psetCount/);
    assert.match(blob.parts[0], /"Wall, 01"/);
    assert.deepEqual(downloads.at(-1), { href: "blob:download", download: "bim-elements.csv" });
  } finally {
    globalThis.document = originalDocument;
    globalThis.Blob = originalBlob;
    globalThis.URL = originalUrl;
    globalThis.Option = originalOption;
  }
});

test("renderElementsTable renders rows and empty state with a minimal DOM stub", () => {
  const state = { replaced: [], rows: [], more: null };
  const makeNode = (tag) => ({
    tag,
    className: "",
    textContent: "",
    innerHTML: "",
    tabIndex: 0,
    children: [],
    append(...items) {
      this.children.push(...items);
      if (tag === "tbody") state.rows.push(...items);
      if (tag === "div") state.replaced.push(...items);
    },
    replaceChildren(...items) {
      this.children = [...items];
      state.replaced = [...items];
    },
    querySelector(selector) {
      if (selector === "tbody") return state.tbody;
      return null;
    },
  });

  const originalDocument = globalThis.document;
  const originalOption = globalThis.Option;
  try {
    globalThis.Option = class Option {
      constructor(text, value) {
        this.text = text;
        this.value = value;
      }
    };
    state.tbody = makeNode("tbody");
    globalThis.document = {
      createElement(tag) {
        return makeNode(tag);
      },
    };

    const selected = [];
    const output = makeNode("output");
    renderElementsTable({
      records: [
        {
          modelId: "m1",
          localId: 1,
          category: "IFCWALL",
          name: "Wall 01",
          globalId: "gid1",
          typeName: "WallType",
          storey: "Level 01",
          materialName: "Concrete",
          psetCount: 1,
          searchable: "wall 01",
        },
      ],
      totalCount: 1,
      output,
      onSelect: (record) => selected.push(record.localId),
    });

    assert.equal(state.rows.length, 1);
    assert.equal(output.children[0].tag, "div");
    state.rows[0].onclick();
    assert.deepEqual(selected, [1]);

    const emptyOutput = makeNode("output");
    renderElementsTable({ records: [], totalCount: 0, output: emptyOutput, onSelect: () => {} });
    assert.equal(emptyOutput.children[0].tag, "span");
  } finally {
    globalThis.document = originalDocument;
    globalThis.Option = originalOption;
  }
});


test("fillSelectOptions preserves existing selected value when still available", () => {
  const selectedOptions = [];
  const select = {
    value: "B",
    replaceChildren(...items) {
      selectedOptions.splice(0, selectedOptions.length, ...items);
    },
  };
  const originalOption = globalThis.Option;
  try {
    globalThis.Option = class Option {
      constructor(text, value) {
        this.text = text;
        this.value = value;
      }
    };
    fillSelectOptions(select, ["A", "B"], "All");
    assert.equal(select.value, "B");
    assert.equal(selectedOptions[0].value, "");
  } finally {
    globalThis.Option = originalOption;
  }
});
