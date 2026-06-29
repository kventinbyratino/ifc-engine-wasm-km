import test from "node:test";
import assert from "node:assert/strict";
import { stripKmProfileChrome } from "../src/bim/app/km-shell-chrome.ts";

function createNode(name) {
  return {
    name,
    removed: false,
    remove() {
      this.removed = true;
    },
  };
}

test("stripKmProfileChrome removes BIM profile chrome on KM route", () => {
  const dom = {
    profileScreen: createNode("profileScreen"),
    bimStub: createNode("bimStub"),
  };

  const changed = stripKmProfileChrome("km", dom);

  assert.equal(changed, true);
  assert.equal(dom.profileScreen.removed, true);
  assert.equal(dom.bimStub.removed, true);
});

test("stripKmProfileChrome keeps chrome on BIM route", () => {
  const dom = {
    profileScreen: createNode("profileScreen"),
    bimStub: createNode("bimStub"),
  };

  const changed = stripKmProfileChrome("bim", dom);

  assert.equal(changed, false);
  assert.equal(dom.profileScreen.removed, false);
  assert.equal(dom.bimStub.removed, false);
});
