import test from "node:test";
import assert from "node:assert/strict";

import { createFederationLoadQueue } from "../../src/bim/federation/federation-loader.ts";

test("createFederationLoadQueue runs tasks sequentially", async () => {
  const queue = createFederationLoadQueue();
  const events = [];

  const first = queue.enqueue(async () => {
    events.push("first:start");
    await new Promise((resolve) => setTimeout(resolve, 20));
    events.push("first:end");
    return 1;
  });

  const second = queue.enqueue(async () => {
    events.push("second:start");
    events.push("second:end");
    return 2;
  });

  assert.equal(await first, 1);
  assert.equal(await second, 2);
  await queue.waitForIdle();

  assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
});
