import type { Profile } from "../types.ts";
import type { HealthCheckIssueType } from "./check-types.ts";
import { createDefaultModelHealthRuleRegistry, type ModelHealthRuleRegistry } from "./rules.ts";

export const CHECKS_SETTINGS_STORAGE_SCHEMA_VERSION = 1;

export type StoredChecksRuleSetting = {
  type: HealthCheckIssueType;
  enabled: boolean;
  priority: number;
};

export type StoredChecksSettings = {
  schemaVersion: number;
  profile: Profile;
  savedAt: string;
  rules: StoredChecksRuleSetting[];
};

export function getChecksSettingsStorageKey(profile: Profile) {
  return `ifc-health-checks-settings:${profile}:v${CHECKS_SETTINGS_STORAGE_SCHEMA_VERSION}`;
}

export function createDefaultChecksRuleRegistry() {
  return createDefaultModelHealthRuleRegistry();
}

export function serializeChecksSettings(registry: ModelHealthRuleRegistry, profile: Profile): StoredChecksSettings {
  return {
    schemaVersion: CHECKS_SETTINGS_STORAGE_SCHEMA_VERSION,
    profile,
    savedAt: new Date().toISOString(),
    rules: registry.listRules().map((rule) => ({
      type: rule.type,
      enabled: rule.enabled,
      priority: rule.priority,
    })),
  };
}

export function applyStoredChecksSettings(
  registry: ModelHealthRuleRegistry,
  stored: Pick<StoredChecksSettings, "rules">,
) {
  for (const rule of stored.rules) {
    registry.setRulePriority(rule.type, rule.priority);
    if (rule.enabled) registry.enableRule(rule.type);
    else registry.disableRule(rule.type);
  }
  return registry;
}

export function loadStoredChecksSettings(profile: Profile) {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(getChecksSettingsStorageKey(profile));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeStoredChecksSettings(parsed, profile);
  } catch (error) {
    console.warn("Checks settings parse failed", error);
    return null;
  }
}

export function loadChecksRuleRegistry(profile: Profile) {
  const baseRegistry = createDefaultChecksRuleRegistry();
  const stored = loadStoredChecksSettings(profile);
  return stored ? applyStoredChecksSettings(baseRegistry, stored) : baseRegistry;
}

export function saveStoredChecksSettings(profile: Profile, registry: ModelHealthRuleRegistry) {
  if (typeof localStorage === "undefined") return null;
  const payload = serializeChecksSettings(registry, profile);
  localStorage.setItem(getChecksSettingsStorageKey(profile), JSON.stringify(payload));
  return payload;
}

export function clearStoredChecksSettings(profile: Profile) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(getChecksSettingsStorageKey(profile));
}

function normalizeStoredChecksSettings(raw: unknown, profile: Profile): StoredChecksSettings | null {
  if (!isRecord(raw)) return null;
  if (raw.profile !== profile) return null;
  if (!Array.isArray(raw.rules)) return null;

  const rules = raw.rules
    .filter(isRecord)
    .map(normalizeStoredRule)
    .filter((rule): rule is StoredChecksRuleSetting => rule !== null);

  return {
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : CHECKS_SETTINGS_STORAGE_SCHEMA_VERSION,
    profile,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
    rules,
  };
}

function normalizeStoredRule(raw: Record<string, unknown>): StoredChecksRuleSetting | null {
  if (typeof raw.type !== "string" || typeof raw.enabled !== "boolean" || typeof raw.priority !== "number") return null;
  return {
    type: raw.type as HealthCheckIssueType,
    enabled: raw.enabled,
    priority: raw.priority,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
