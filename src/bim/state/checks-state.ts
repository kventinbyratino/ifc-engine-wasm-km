import type { ModelHealthReport } from "../checks/check-types.ts";
import { createDefaultChecksRuleRegistry } from "../checks/check-settings.ts";
import type { ModelHealthRuleRegistry } from "../checks/rules.ts";

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
