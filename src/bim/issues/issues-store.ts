import type { BimIssue, IssueDraft } from "./issue-types";
import { createIssueRecord, normalizeImportedIssues, removeIssue, updateIssueStatus, type IssueClock } from "./issue-repository.js";

export function createIssueStore(options: { now?: IssueClock } = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  let issues: BimIssue[] = [];

  return {
    list: () => [...issues],
    create: (draft: IssueDraft) => {
      const issue = createIssueRecord(draft, now);
      issues = [issue, ...issues];
      return issue;
    },
    updateStatus: (id: string, status: BimIssue["status"]) => {
      issues = updateIssueStatus(issues, id, status, now);
    },
    remove: (id: string) => {
      issues = removeIssue(issues, id);
    },
    clear: () => {
      issues = [];
    },
    importJson: (json: string) => {
      const parsed = JSON.parse(json) as BimIssue[];
      issues = normalizeImportedIssues(parsed, now);
      return [...issues];
    },
  };
}
