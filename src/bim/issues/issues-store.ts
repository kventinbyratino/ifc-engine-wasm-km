import type { BimIssue, IssueDraft } from "./issue-types";

export function createIssueStore() {
  let issues: BimIssue[] = [];

  return {
    list: () => [...issues],
    create: (draft: IssueDraft) => {
      const now = new Date().toISOString();
      const issue: BimIssue = {
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
        createdAt: now,
        updatedAt: now,
      };
      issues = [issue, ...issues];
      return issue;
    },
    updateStatus: (id: string, status: BimIssue["status"]) => {
      issues = issues.map((issue) => (issue.id === id ? { ...issue, status, updatedAt: new Date().toISOString() } : issue));
    },
    remove: (id: string) => {
      issues = issues.filter((issue) => issue.id !== id);
    },
    clear: () => {
      issues = [];
    },
    importJson: (json: string) => {
      const parsed = JSON.parse(json) as BimIssue[];
      issues = parsed.map((issue) => ({ ...issue, updatedAt: issue.updatedAt || issue.createdAt || new Date().toISOString() }));
      return [...issues];
    },
  };
}

function createIssueId(modelId: string, localId: number) {
  return `issue-${Date.now().toString(36)}-${modelId.replace(/[^a-z0-9]/gi, "").slice(0, 8)}-${localId}`;
}
