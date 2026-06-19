import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { copyPatchedModule } from "./helpers/copy-patched-module.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-help-tests-"));
const srcRoot = path.resolve("src/bim");

async function copyPatched(sourceRelative, targetRelative = sourceRelative) {
  await copyPatchedModule({
    srcRoot,
    tempRoot,
    sourceRelative,
    targetRelative,
  });
}

await copyPatched("help/help-content.ts");
await copyPatched("help/help-page.ts");

const contentUrl = pathToFileURL(path.join(tempRoot, "help/help-content.ts")).href;
const pageUrl = pathToFileURL(path.join(tempRoot, "help/help-page.ts")).href;
const { HELP_SECTIONS, getHelpSectionById } = await import(contentUrl);
const { renderHelpPage } = await import(pageUrl);

test("help content covers every user-facing roadmap feature and connects sections", () => {
  const ids = new Set(HELP_SECTIONS.map((section) => section.id));
  const expectedIds = [
    "start-profile",
    "data-layer",
    "relationship-graph",
    "drawings-dxf",
    "drawing-annotations",
    "model-health",
    "issues-bcf",
    "federation-clash",
    "sheets-specifications",
    "ifc-export",
    "large-ifc-backend",
    "progressive-loading",
    "production-drawings",
    "drawing-sync",
    "section-3",
    "operations-guardrails",
  ];

  for (const id of expectedIds) assert.ok(ids.has(id), `missing help section ${id}`);
  assert.equal(HELP_SECTIONS.length, expectedIds.length);

  for (const section of HELP_SECTIONS) {
    assert.ok(section.title.length > 8, `${section.id} title is too short`);
    assert.ok(section.summary.length > 40, `${section.id} summary is too short`);
    assert.ok(section.steps.length >= 3, `${section.id} needs practical steps`);
    assert.ok(section.links.length >= 1, `${section.id} needs related navigation`);
    assert.ok(section.media?.svg.includes("<svg"), `${section.id} needs an illustration/svg screenshot`);
    for (const link of section.links) assert.ok(ids.has(link.to), `${section.id} links to missing ${link.to}`);
  }

  assert.equal(getHelpSectionById("drawing-sync")?.title, "Связь модель ↔ чертёж");
});

test("renderHelpPage builds navigable help page with anchors and related links", () => {
  const created = [];
  const makeNode = (tag) => ({
    tag,
    className: "",
    textContent: "",
    innerHTML: "",
    href: "",
    id: "",
    children: [],
    dataset: {},
    append(...items) {
      this.children.push(...items);
    },
    appendChild(item) {
      this.children.push(item);
      return item;
    },
  });
  globalThis.document = {
    createElement(tag) {
      const node = makeNode(tag);
      created.push(node);
      return node;
    },
  };

  const root = makeNode("main");
  renderHelpPage(root);

  assert.ok(root.children.length > 0);
  assert.ok(created.some((node) => node.tag === "nav" && node.className.includes("help-nav")));
  assert.ok(created.some((node) => node.tag === "article" && node.id === "help-drawing-sync"));
  assert.ok(created.some((node) => node.tag === "a" && node.href === "#help-section-3"));
  assert.ok(root.innerHTML.includes("BIM Manager Workbench"));
  assert.ok(root.innerHTML.includes("Связь между функциями"));
});
