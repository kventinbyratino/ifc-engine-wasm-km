import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-context-menu-tests-"));
const source = path.join(repoRoot, "src/bim/ui/element-context-menu.ts");
const target = path.join(tempRoot, "element-context-menu.ts");
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, await readFile(source, "utf8"));
const { createElementContextMenu } = await import(pathToFileURL(target).href);

function createElement(tagName = "div") {
  const listeners = new Map();
  return {
    tagName,
    hidden: false,
    disabled: false,
    textContent: "",
    className: "",
    style: {},
    dataset: {},
    children: [],
    onclick: null,
    role: "",
    setAttribute(name, value) { this[name] = String(value); },
    append(...nodes) { this.children.push(...nodes); },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type, event) { listeners.get(type)?.(event); },
    querySelector(selector) {
      if (selector === "button") return this.children.find((child) => child.tagName === "button") ?? null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "button") return this.children.filter((child) => child.tagName === "button");
      return [];
    },
  };
}

function setupDom() {
  const body = createElement("body");
  const target = createElement("div");
  const documentListeners = new Map();
  globalThis.document = {
    body,
    createElement,
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    removeEventListener(type) { documentListeners.delete(type); },
  };
  globalThis.window = { innerWidth: 360, innerHeight: 640 };
  return { body, target, documentListeners };
}

test("element context menu opens all selection actions and runs their callbacks", () => {
  const { body, target } = setupDom();
  const calls = [];
  const menu = createElementContextMenu({
    target,
    getSelectionCount: () => 1,
    onOpenProperties: () => calls.push("properties"),
    onFindInData: () => calls.push("data"),
    onCreateIssue: () => calls.push("issue"),
    onAddToSelectionSet: () => calls.push("selection-set"),
  });

  let prevented = false;
  target.dispatch("contextmenu", {
    clientX: 320,
    clientY: 620,
    preventDefault: () => { prevented = true; },
  });

  assert.equal(prevented, true);
  assert.equal(body.children.includes(menu.element), true);
  assert.equal(menu.element.hidden, false);
  const buttons = menu.element.querySelectorAll("button");
  assert.deepEqual(buttons.map((button) => button.textContent), [
    "Свойства",
    "Найти в данных",
    "Создать замечание",
    "Добавить в выборку",
  ]);
  assert.equal(buttons.every((button) => button.disabled === false), true);

  for (const button of buttons) {
    button.onclick();
    target.dispatch("contextmenu", { clientX: 20, clientY: 30, preventDefault: () => {} });
  }
  assert.deepEqual(calls, ["properties", "data", "issue", "selection-set"]);
});

test("element context menu disables Properties when no element is selected", () => {
  const { target } = setupDom();
  let opened = 0;
  const menu = createElementContextMenu({
    target,
    getSelectionCount: () => 0,
    onOpenProperties: () => { opened += 1; },
  });

  target.dispatch("contextmenu", {
    clientX: 20,
    clientY: 30,
    preventDefault: () => {},
  });

  const button = menu.element.querySelector("button");
  assert.equal(button.disabled, true);
  button.onclick();
  assert.equal(opened, 0);
});
