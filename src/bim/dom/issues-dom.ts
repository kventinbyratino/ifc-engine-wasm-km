import type { LoadingElement } from "../types.ts";
import { requiredElement } from "./dom-helpers.ts";

export function getIssuesDom() {
  return {
    issuesPanel: requiredElement<HTMLElement>("issuesPanel"),
    issuesSummary: requiredElement<HTMLElement>("issuesSummary"),
    closeIssuesPanelBtn: requiredElement<HTMLButtonElement>("closeIssuesPanelBtn"),
    createIssueBtn: requiredElement<LoadingElement>("createIssueBtn"),
    exportIssuesJsonBtn: requiredElement<HTMLButtonElement>("exportIssuesJsonBtn"),
    exportIssuesBcfBtn: requiredElement<HTMLButtonElement>("exportIssuesBcfBtn"),
    clearIssuesBtn: requiredElement<HTMLButtonElement>("clearIssuesBtn"),
    issuesOutput: requiredElement<HTMLDivElement>("issuesOutput"),
  };
}
