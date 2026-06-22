import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir, rm, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { copyPatchedModule } from "./helpers/copy-patched-module.mjs";
import * as THREE from "three";

const repoRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const tempRoot = await mkdtemp(path.join(repoRoot, ".tmp-drawing-annotations-tests-"));
await mkdir(tempRoot, { recursive: true });
const srcRoot = new URL("../src/bim", import.meta.url).pathname;

async function copyPatched(filename, replacements = [], sourceRoot = srcRoot) {
  await copyPatchedModule({
    srcRoot: sourceRoot,
    tempRoot,
    sourceRelative: filename,
    specifierMap: Object.fromEntries(replacements),
  });
}

await writeFile(
  path.join(tempRoot, "thatopen-components.ts"),
  `export class TechnicalDrawings {}
export class LinearAnnotations {}
export class LeaderAnnotations {}
export class CalloutAnnotations {}
`,
);
await copyPatched("types.ts");
await copyPatched("drawings/drawing-selection-sync.ts", [["../types", "../types.ts"], ["@thatopen/components", "../thatopen-components.ts"]]);
await copyPatched("drawings/drawing-document.ts", [["./drawing-selection-sync", "./drawing-selection-sync.ts"], ["@thatopen/components", "../thatopen-components.ts"]]);
await copyPatched("drawings/annotation-geometry.ts", [["./drawing-document", "./drawing-document.ts"], ["@thatopen/components", "../thatopen-components.ts"]]);
await copyPatched("drawings/annotation-factory.ts", [
  ["./drawing-annotations", "./drawing-annotations.ts"],
  ["./annotation-geometry", "./annotation-geometry.ts"],
  ["./drawing-document", "./drawing-document.ts"],
  ["@thatopen/components", "../thatopen-components.ts"],
]);
await copyPatched("drawings/drawing-annotations.ts", [
  ["./drawing-document", "./drawing-document.ts"],
  ["./annotation-factory", "./annotation-factory.ts"],
  ["@thatopen/components", "../thatopen-components.ts"],
]);
await copyPatched("drawings/drawing-interaction.ts", [["./drawing-annotations", "./drawing-annotations.ts"], ["@thatopen/components", "../thatopen-components.ts"]]);

const obcUrl = pathToFileURL(path.join(tempRoot, "thatopen-components.ts")).href;
const OBC = await import(obcUrl);
const annotationsUrl = pathToFileURL(path.join(tempRoot, "drawings/drawing-annotations.ts")).href;
const factoryUrl = pathToFileURL(path.join(tempRoot, "drawings/annotation-factory.ts")).href;
const interactionUrl = pathToFileURL(path.join(tempRoot, "drawings/drawing-interaction.ts")).href;

const {
  addDrawingAnnotation,
  clearDrawingAnnotations,
  deleteDrawingAnnotation,
  syncDrawingAnnotations,
  updateDrawingAnnotationText,
  getDrawingAnnotationTypeLabel,
} = await import(annotationsUrl);
const {
  createDrawingAnnotation,
  normalizeAnnotationText,
} = await import(factoryUrl);
const {
  createDrawingInteractionController,
} = await import(interactionUrl);

function createFakeEnvironment() {
  const stores = {
    linear: new Map(),
    leader: new Map(),
    callout: new Map(),
  };

  const makeSystem = (kind) => ({
    activeStyle: `${kind}-style`,
    add(_drawing, payload) {
      const uuid = `${kind}-${stores[kind].size + 1}`;
      stores[kind].set(uuid, { uuid, ...payload });
      return { uuid };
    },
    clear() {
      stores[kind].clear();
    },
    delete(_drawing, ids) {
      for (const id of ids) stores[kind].delete(id);
    },
    update(_drawing, ids, patch) {
      for (const id of ids) Object.assign(stores[kind].get(id) ?? {}, patch);
    },
    items: stores[kind],
  });

  const systems = {
    linear: makeSystem("linear"),
    leader: makeSystem("leader"),
    callout: makeSystem("callout"),
  };

  const techDrawings = {
    use(systemClass) {
      if (systemClass === OBC.LinearAnnotations) return systems.linear;
      if (systemClass === OBC.LeaderAnnotations) return systems.leader;
      if (systemClass === OBC.CalloutAnnotations) return systems.callout;
      throw new Error("Unknown annotations system");
    },
  };

  const components = {
    get(token) {
      if (token === OBC.TechnicalDrawings) return techDrawings;
      throw new Error("Unknown component token");
    },
  };

  const drawingMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 6), new THREE.MeshBasicMaterial());
  drawingMesh.updateMatrixWorld(true);

  const drawing = {
    three: drawingMesh,
    raycast: () => null,
    annotations: {
      getBySystem(system) {
        return system.items;
      },
    },
  };

  const record = {
    id: "drawing-1",
    name: "Plan 01",
    view: "plan",
    source: "all",
    itemCount: 1,
    lineCount: 2,
    annotations: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    drawing,
    viewport: null,
    projection: {
      far: 40,
      bounds: { left: -5, right: 5, top: 5, bottom: -5, scale: 100 },
      scale: 100,
    },
    sourceModelIdMap: { model: new Set([1]) },
    sheets: [],
  };

  return { components, record, systems };
}

function createViewportStub() {
  const handlers = new Map();
  const classes = new Set();
  return {
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
    removeEventListener(type) {
      handlers.delete(type);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 100 };
    },
    dispatch(type, event) {
      const handler = handlers.get(type);
      if (!handler) throw new Error(`No handler for ${type}`);
      handler(event);
    },
  };
}

test("annotation factory creates default text and records linear annotation", () => {
  const { components, record, systems } = createFakeEnvironment();
  const annotation = addDrawingAnnotation(record, {
    components,
    type: "linear",
    point: new THREE.Vector3(1, 0, 2),
  });

  assert.equal(annotation.type, "linear");
  assert.equal(annotation.text, "10 м");
  assert.equal(record.annotations.length, 1);
  assert.equal(record.annotations[0].id, "linear-1");
  assert.equal(systems.linear.items.size, 1);
  assert.equal(getDrawingAnnotationTypeLabel("callout"), "Маркер");
  assert.equal(normalizeAnnotationText("leader", undefined, new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))), "Выноска");
});

test("annotation flows support update delete and clear", () => {
  const { components, record, systems } = createFakeEnvironment();

  const annotation = addDrawingAnnotation(record, {
    components,
    type: "callout",
    text: "  Спецификация  ",
    point: new THREE.Vector3(2, 0, 3),
  });
  assert.equal(annotation.type, "callout");
  assert.equal(record.annotations.length, 1);
  assert.equal(record.annotations[0].text, "Спецификация");

  updateDrawingAnnotationText(record, components, annotation.id, "Обновлённый текст");
  assert.equal(record.annotations[0].text, "Обновлённый текст");
  assert.equal(systems.callout.items.get(annotation.id).text, "Обновлённый текст");

  deleteDrawingAnnotation(record, components, annotation.id);
  assert.equal(record.annotations.length, 0);
  assert.equal(systems.callout.items.size, 0);

  addDrawingAnnotation(record, { components, type: "leader", text: "Выноска", point: new THREE.Vector3(1, 0, 1) });
  addDrawingAnnotation(record, { components, type: "linear", point: new THREE.Vector3(0, 0, 0) });
  assert.equal(record.annotations.length, 2);
  clearDrawingAnnotations(record, components);
  assert.equal(record.annotations.length, 0);
  assert.equal(systems.linear.items.size, 0);
  assert.equal(systems.leader.items.size, 0);
  assert.equal(systems.callout.items.size, 0);
});

test("interactive drawing annotations add a record on pointer click", () => {
  const { components, record } = createFakeEnvironment();
  const viewport = createViewportStub();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const previousWindow = globalThis.window;
  const windowHandlers = new Map();
  globalThis.window = {
    addEventListener(type, handler) {
      windowHandlers.set(type, handler);
    },
    removeEventListener(type) {
      windowHandlers.delete(type);
    },
  };

  try {
    const statuses = [];
    const added = [];
    record.drawing.raycast = () => ({ point: new THREE.Vector3(2, 0, 4), line: null });

    const controller = createDrawingInteractionController({
      viewport,
      world: { camera: { three: camera } },
      components,
      getActiveDrawing: () => record,
      getAnnotationType: () => "callout",
      getAnnotationText: () => "Интерактивная заметка",
      onAnnotationAdded: (nextRecord) => added.push(nextRecord.id),
      onStatus: (message) => statuses.push(message),
    });

    controller.setActive(true);
    viewport.dispatch("pointerdown", {
      button: 0,
      clientX: 45,
      clientY: 55,
      pointerId: 1,
      preventDefault() {},
      stopPropagation() {},
    });

    assert.equal(controller.active, true);
    assert.equal(added.length, 1);
    assert.equal(record.annotations.length, 1);
    assert.equal(record.annotations[0].type, "callout");
    assert.match(statuses.at(-1) ?? "", /интерактивно/);

    controller.dispose();
  } finally {
    globalThis.window = previousWindow;
  }
});

test.after(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});
