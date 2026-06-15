import type { BimElementRecord } from "../data/element-index.ts";
import type { HealthCheckIssue, HealthCheckIssueType, HealthCheckSeverity } from "./check-types.ts";

export type HealthRuleGroup = "name" | "identity" | "structure" | "material";

export type RuleContext = {
  duplicateGlobalIds: Set<string>;
  proxyShare: number;
};

export type HealthRuleDefinition = {
  type: HealthCheckIssueType;
  title: string;
  severity: HealthCheckSeverity;
  group: HealthRuleGroup;
  priority: number;
  enabled?: boolean;
  applies: (record: BimElementRecord, context: RuleContext) => boolean;
  describe: (record: BimElementRecord, context: RuleContext) => string;
};

export type HealthRuleRegistryEntry = HealthRuleDefinition & {
  enabled: boolean;
};

export type HealthRuleControl = Pick<
  HealthRuleRegistryEntry,
  "type" | "title" | "severity" | "group" | "priority" | "enabled"
>;

export function createRuleContext(records: BimElementRecord[]): RuleContext {
  const globalIdCounts = new Map<string, number>();
  let proxyCount = 0;

  for (const record of records) {
    if (record.globalId) globalIdCounts.set(record.globalId, (globalIdCounts.get(record.globalId) ?? 0) + 1);
    if (record.category === "IFCBUILDINGELEMENTPROXY") proxyCount++;
  }

  return {
    duplicateGlobalIds: new Set([...globalIdCounts.entries()].filter(([, count]) => count > 1).map(([globalId]) => globalId)),
    proxyShare: records.length ? proxyCount / records.length : 0,
  };
}

export function createIssueFromRule(record: BimElementRecord, rule: HealthRuleDefinition, context: RuleContext): HealthCheckIssue {
  return {
    id: `${rule.type}:${record.modelId}:${record.localId}`,
    type: rule.type,
    title: rule.title,
    description: rule.describe(record, context),
    severity: rule.severity,
    modelId: record.modelId,
    localId: record.localId,
    globalId: record.globalId,
    record,
  };
}

export function createHealthRuleRegistry(rules: HealthRuleDefinition[]) {
  return sortRegistry(rules.map(normalizeRule));
}

export function listHealthRuleControls(registry: HealthRuleRegistryEntry[]) {
  return sortRegistry(registry).map(({ type, title, severity, group, priority, enabled }) => ({
    type,
    title,
    severity,
    group,
    priority,
    enabled,
  }));
}

export function getEnabledHealthRules(registry: HealthRuleRegistryEntry[]) {
  return sortRegistry(registry).filter((rule) => rule.enabled);
}

export function setHealthRuleEnabled(registry: HealthRuleRegistryEntry[], type: HealthCheckIssueType, enabled: boolean) {
  return updateHealthRule(registry, type, { enabled });
}

export function setHealthRulePriority(registry: HealthRuleRegistryEntry[], type: HealthCheckIssueType, priority: number) {
  return updateHealthRule(registry, type, { priority });
}

export function updateHealthRule(
  registry: HealthRuleRegistryEntry[],
  type: HealthCheckIssueType,
  patch: Partial<Pick<HealthRuleRegistryEntry, "enabled" | "priority" | "title" | "severity" | "group">>,
) {
  return sortRegistry(
    registry.map((rule) => (rule.type === type ? normalizeRule({ ...rule, ...patch }) : normalizeRule(rule))),
  );
}

export function getHealthRuleControl(registry: HealthRuleRegistryEntry[], type: HealthCheckIssueType) {
  return listHealthRuleControls(registry).find((rule) => rule.type === type);
}

function normalizeRule(rule: HealthRuleDefinition | HealthRuleRegistryEntry): HealthRuleRegistryEntry {
  return {
    ...rule,
    enabled: rule.enabled ?? true,
  };
}

function sortRegistry(registry: HealthRuleRegistryEntry[]) {
  return [...registry].sort((a, b) => a.priority - b.priority || a.group.localeCompare(b.group, "ru") || a.title.localeCompare(b.title, "ru") || a.type.localeCompare(b.type, "ru"));
}
