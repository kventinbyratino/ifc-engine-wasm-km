import type { BimElementRecord } from "../data/element-index";
import type { BimIssue, BimIssueStatus, IssueDraft } from "./issue-types";

export type IssueClock = () => string;

export function createIssueRecord(draft: IssueDraft, now: IssueClock = defaultClock): BimIssue {
  const createdAt = now();
  return {
    id: createIssueId(draft.record.modelId, draft.record.localId),
    title: draft.title.trim() || "BIM issue",
    description: draft.description?.trim() ?? "",
    status: "open",
    priority: draft.priority ?? "medium",
    source: draft.source ?? "manual",
    modelId: draft.record.modelId,
    localId: draft.record.localId,
    globalId: draft.record.globalId,
    ifcClass: draft.record.category,
    elementName: draft.record.name,
    camera: draft.camera,
    createdAt,
    updatedAt: createdAt,
  };
}

export function normalizeImportedIssues(issues: BimIssue[], now: IssueClock = defaultClock): BimIssue[] {
  return issues.map((issue) => normalizeImportedIssue(issue, now));
}

export function updateIssueStatus(
  issues: BimIssue[],
  id: string,
  status: BimIssueStatus,
  now: IssueClock = defaultClock,
): BimIssue[] {
  const updatedAt = now();
  return issues.map((issue) => (issue.id === id ? { ...issue, status, updatedAt } : issue));
}

export function removeIssue(issues: BimIssue[], id: string): BimIssue[] {
  return issues.filter((issue) => issue.id !== id);
}

export function createIssueId(modelId: string, localId: number) {
  return `issue-${Date.now().toString(36)}-${modelId.replace(/[^a-z0-9]/gi, "").slice(0, 8)}-${localId}`;
}

function normalizeImportedIssue(issue: BimIssue, now: IssueClock): BimIssue {
  const createdAt = issue.createdAt || now();
  return {
    ...issue,
    createdAt,
    updatedAt: issue.updatedAt || createdAt,
  };
}

function defaultClock() {
  return new Date().toISOString();
}
