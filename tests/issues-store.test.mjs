import test from "node:test";
import assert from "node:assert/strict";

import { createIssueStore } from "../src/bim/issues/issues-store.ts";
import { createIssueRecord, normalizeImportedIssues } from "../src/bim/issues/issue-repository.ts";

function makeRecord(overrides = {}) {
  return {
    modelId: "model-a",
    localId: 42,
    name: "Wall 01",
    category: "IFCWALL",
    globalId: "gid-42",
    typeName: "WallType",
    storey: "Level 01",
    number: "A1",
    materialName: "Concrete",
    psetCount: 1,
    searchable: "wall 01 level 01 concrete",
    ...overrides,
  };
}

function makeClock(...timestamps) {
  const queue = [...timestamps];
  return () => queue.shift() ?? timestamps[timestamps.length - 1];
}

test("createIssueRecord normalizes issue fields and timestamps", () => {
  const issue = createIssueRecord(
    {
      title: "   ",
      description: "  Needs review  ",
      priority: undefined,
      source: undefined,
      record: makeRecord(),
      camera: {
        position: [1, 2, 3],
        target: [4, 5, 6],
      },
    },
    makeClock("2026-01-01T00:00:00.000Z"),
  );

  assert.equal(issue.title, "BIM issue");
  assert.equal(issue.description, "Needs review");
  assert.equal(issue.priority, "medium");
  assert.equal(issue.source, "manual");
  assert.equal(issue.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(issue.updatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(issue.id.startsWith("issue-"), true);
  assert.equal(issue.id.includes("modela"), true);
  assert.equal(issue.id.endsWith("-42"), true);
});

test("normalizeImportedIssues fills missing timestamps without mutating input", () => {
  const imported = [
    {
      id: "issue-1",
      title: "Issue 1",
      description: "",
      status: "open",
      priority: "low",
      source: "manual",
      modelId: "model-a",
      localId: 1,
      globalId: "gid-1",
      ifcClass: "IFCWALL",
      elementName: "Wall 01",
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  const normalized = normalizeImportedIssues(imported, makeClock("2026-01-03T00:00:00.000Z"));

  assert.notStrictEqual(normalized, imported);
  assert.equal(normalized[0].updatedAt, "2026-01-02T00:00:00.000Z");
  assert.equal(imported[0].updatedAt, undefined);
});

test("issue store keeps list isolated and updates status through injected clock", () => {
  const now = makeClock(
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:01:00.000Z",
  );
  const store = createIssueStore({ now });

  const created = store.create({
    title: "Follow up",
    description: "Check wall",
    priority: "high",
    source: "manual",
    record: makeRecord(),
  });

  assert.equal(created.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(created.updatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(store.list().length, 1);

  const snapshot = store.list();
  snapshot.push(created);
  assert.equal(store.list().length, 1);

  store.updateStatus(created.id, "closed");
  const [updated] = store.list();
  assert.equal(updated.status, "closed");
  assert.equal(updated.updatedAt, "2026-01-01T00:01:00.000Z");

  store.remove(created.id);
  assert.equal(store.list().length, 0);
});
