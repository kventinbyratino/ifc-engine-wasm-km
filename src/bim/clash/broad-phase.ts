import type { ElementBox } from "./clash-types";

export function getCandidatePairs(a: ElementBox[], b: ElementBox[], tolerance: number) {
  const sortedA = [...a].sort((left, right) => left.box.min.x - right.box.min.x);
  const sortedB = [...b].sort((left, right) => left.box.min.x - right.box.min.x);
  const pairs: Array<[ElementBox, ElementBox]> = [];
  let start = 0;

  for (const itemA of sortedA) {
    const minA = itemA.box.min.x - tolerance;
    const maxA = itemA.box.max.x + tolerance;

    while (start < sortedB.length && sortedB[start].box.max.x + tolerance < minA) {
      start++;
    }

    for (let index = start; index < sortedB.length; index++) {
      const itemB = sortedB[index];
      if (itemB.box.min.x - tolerance > maxA) break;
      pairs.push([itemA, itemB]);
    }
  }

  return pairs;
}
