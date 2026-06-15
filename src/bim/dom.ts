import { getChecksDom } from "./dom/checks-dom.ts";
import { getClashDom } from "./dom/clash-dom.ts";
import { getDataDom } from "./dom/data-dom.ts";
import { getDrawingsDom } from "./dom/drawings-dom.ts";
import { getFederationDom } from "./dom/federation-dom.ts";
import { getIssuesDom } from "./dom/issues-dom.ts";
import { getViewerDom } from "./dom/viewer-dom.ts";

export type BimDomElements = ReturnType<typeof getDomElements>;

export function getDomElements() {
  const viewer = getViewerDom();
  const data = getDataDom();
  const checks = getChecksDom();
  const federation = getFederationDom();
  const issues = getIssuesDom();
  const clash = getClashDom();
  const drawings = getDrawingsDom();

  return {
    viewer,
    data,
    checks,
    federation,
    issues,
    clash,
    drawings,
    ...viewer,
    ...data,
    ...checks,
    ...federation,
    ...issues,
    ...clash,
    ...drawings,
  };
}
