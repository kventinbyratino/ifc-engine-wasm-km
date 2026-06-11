import { getChecksDom } from "./dom/checks-dom";
import { getClashDom } from "./dom/clash-dom";
import { getDataDom } from "./dom/data-dom";
import { getDrawingsDom } from "./dom/drawings-dom";
import { getIssuesDom } from "./dom/issues-dom";
import { getViewerDom } from "./dom/viewer-dom";

export type BimDomElements = ReturnType<typeof getDomElements>;

export function getDomElements() {
  const viewer = getViewerDom();
  const data = getDataDom();
  const checks = getChecksDom();
  const issues = getIssuesDom();
  const clash = getClashDom();
  const drawings = getDrawingsDom();

  return {
    viewer,
    data,
    checks,
    issues,
    clash,
    drawings,
    ...viewer,
    ...data,
    ...checks,
    ...issues,
    ...clash,
    ...drawings,
  };
}
