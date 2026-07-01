import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const appStatusSource = await readFile(new URL("../src/bim/app/app-status.ts", import.meta.url), "utf8");
const controllerSource = await readFile(new URL("../src/bim/app/model-load-controller.ts", import.meta.url), "utf8");

test("busy loading UI mirrors progress into the visible title and status pill", () => {
  assert.match(appStatusSource, /loadingTitle\.textContent = progressMessage;/);
  assert.match(appStatusSource, /loadingStatus\.textContent = progressMessage;/);
  assert.match(appStatusSource, /statusText\.textContent = progressMessage;/);
});

test("model loads yield one frame before heavy processing starts", () => {
  assert.match(controllerSource, /await yieldToUiFrame\(signal\);/);
  assert.match(controllerSource, /async function yieldToUiFrame\(signal\?: AbortSignal\)/);
});
