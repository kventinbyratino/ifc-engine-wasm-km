import { assertNotAborted, BBoxIndex } from "../spatial/bbox-index";
import type { ClashDetectionInput, ClashDetectionResult, FragmentsBBoxProvider } from "./clash-types";
import { getClashCandidateBoxes } from "./clash-candidates";
import { getCandidatePairs } from "./broad-phase";
import { createClashRecord, isSameElement, sortClashRecords } from "./clash-report";
import { getOverlapVolume } from "./overlap";

export async function detectHardClashes(
  fragments: FragmentsBBoxProvider,
  input: ClashDetectionInput,
): Promise<ClashDetectionResult> {
  const groupA = input.groupA.slice(0, input.limit);
  const groupB = input.groupB.slice(0, input.limit);
  const bboxIndex = input.bboxIndex ?? new BBoxIndex();
  const boxesA = await getClashCandidateBoxes(fragments, groupA, bboxIndex, input.signal);
  const boxesB = await getClashCandidateBoxes(fragments, groupB, bboxIndex, input.signal);
  const clashes = [] as ClashDetectionResult["clashes"];
  let checkedPairs = 0;
  let skippedPairs = 0;

  for (const [itemA, itemB] of getCandidatePairs(boxesA, boxesB, input.tolerance)) {
    assertNotAborted(input.signal);
    if (isSameElement(itemA.record, itemB.record)) {
      skippedPairs++;
      continue;
    }

    checkedPairs++;
    const overlapVolume = getOverlapVolume(itemA.box, itemB.box);
    if (overlapVolume <= 0) continue;
    clashes.push(createClashRecord(itemA.record, itemB.record, overlapVolume));
  }

  return { clashes: sortClashRecords(clashes), checkedPairs, skippedPairs };
}
