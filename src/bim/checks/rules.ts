import { createHealthRuleRegistry, createIssueFromRule, createRuleContext, getEnabledHealthRules, getHealthRuleControl, listHealthRuleControls, setHealthRuleEnabled, setHealthRulePriority, updateHealthRule, type HealthRuleDefinition, type HealthRuleGroup, type HealthRuleRegistryEntry, type HealthRuleControl } from "./rule-registry";
import type { HealthCheckIssueType } from "./check-types";
import { IDENTITY_RULES } from "./identity-rules";
import { MATERIAL_RULES } from "./material-rules";
import { NAME_RULES } from "./name-rules";
import { STRUCTURE_RULES } from "./structure-rules";

export {
  createHealthRuleRegistry,
  createIssueFromRule,
  createRuleContext,
  getEnabledHealthRules,
  getHealthRuleControl,
  listHealthRuleControls,
  setHealthRuleEnabled,
  setHealthRulePriority,
  updateHealthRule,
} from "./rule-registry";

export type RuleListOptions = {
  group?: HealthRuleGroup;
  enabled?: boolean;
};

export type ModelHealthRuleRegistry = {
  listRules: (options?: RuleListOptions) => HealthRuleControl[];
  getEnabledRules: () => HealthRuleRegistryEntry[];
  isRuleEnabled: (type: HealthCheckIssueType) => boolean;
  enableRule: (type: HealthCheckIssueType) => void;
  disableRule: (type: HealthCheckIssueType) => void;
  setRulePriority: (type: HealthCheckIssueType, priority: number) => void;
};

export function createModelHealthRuleRegistry(rules: readonly HealthRuleDefinition[]): ModelHealthRuleRegistry {
  let registry = createHealthRuleRegistry([...rules]);

  return {
    listRules(options: RuleListOptions = {}) {
      return listHealthRuleControls(registry)
        .filter((rule) => options.group === undefined || rule.group === options.group)
        .filter((rule) => options.enabled === undefined || rule.enabled === options.enabled);
    },
    getEnabledRules() {
      return getEnabledHealthRules(registry);
    },
    isRuleEnabled(type: HealthCheckIssueType) {
      return getHealthRuleControl(registry, type)?.enabled ?? false;
    },
    enableRule(type: HealthCheckIssueType) {
      registry = setHealthRuleEnabled(registry, type, true);
    },
    disableRule(type: HealthCheckIssueType) {
      registry = setHealthRuleEnabled(registry, type, false);
    },
    setRulePriority(type: HealthCheckIssueType, priority: number) {
      registry = setHealthRulePriority(registry, type, priority);
    },
  };
}

export function createDefaultModelHealthRuleRegistry() {
  return createModelHealthRuleRegistry([
    ...NAME_RULES,
    ...IDENTITY_RULES,
    ...STRUCTURE_RULES,
    ...MATERIAL_RULES,
  ]);
}

export const MODEL_HEALTH_RULE_REGISTRY = createDefaultModelHealthRuleRegistry();

export const DEFAULT_MODEL_HEALTH_RULE_REGISTRY = createDefaultModelHealthRuleRegistry();

export const MODEL_HEALTH_RULES = MODEL_HEALTH_RULE_REGISTRY;

export const MODEL_HEALTH_RULE_GROUPS = {
  name: NAME_RULES,
  identity: IDENTITY_RULES,
  structure: STRUCTURE_RULES,
  material: MATERIAL_RULES,
} as const;
