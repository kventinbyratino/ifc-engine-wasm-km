import type { ModelHealthReport } from "../checks/check-types";
import { createDefaultChecksRuleRegistry } from "../checks/check-settings";
import type { ModelHealthRuleRegistry } from "../checks/rules";

export type ChecksWorkspaceState = {
  healthReport: ModelHealthReport | null;
  ruleRegistry: ModelHealthRuleRegistry;
};

export function createChecksState(): ChecksWorkspaceState {
  return {
    healthReport: null,
    ruleRegistry: createDefaultChecksRuleRegistry(),
  };
}

export function getHealthIssueCount(checksState: ChecksWorkspaceState) {
  return checksState.healthReport?.summary.issueCount ?? 0;
}
