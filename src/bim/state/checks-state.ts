import type { ModelHealthReport } from "../checks/check-types";

export type ChecksWorkspaceState = {
  healthReport: ModelHealthReport | null;
};

export function createChecksState(): ChecksWorkspaceState {
  return {
    healthReport: null,
  };
}

export function getHealthIssueCount(checksState: ChecksWorkspaceState) {
  return checksState.healthReport?.summary.issueCount ?? 0;
}
