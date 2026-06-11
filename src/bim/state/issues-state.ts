export type IssuesWorkspaceState = {
  activeIssueId: string | null;
};

export function createIssuesState(): IssuesWorkspaceState {
  return {
    activeIssueId: null,
  };
}

export function hasActiveIssue(issuesState: IssuesWorkspaceState) {
  return Boolean(issuesState.activeIssueId);
}
