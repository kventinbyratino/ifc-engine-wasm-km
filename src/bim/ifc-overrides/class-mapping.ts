import type { BimElementRecord } from "../data/element-record.ts";

export type ClassMappingRule = {
  fromClass: string;
  toClass: string;
  reason?: string;
};

export type ClassReplacementCheck = {
  ok: boolean;
  reason: string;
  fromClass: string;
  toClass: string;
};

export type ClassMappingSummary = {
  total: number;
  compatible: number;
  incompatible: number;
  diagnostics: ClassReplacementCheck[];
};

const CLASS_COMPATIBILITY: Record<string, string[]> = {
  IFCBEAM: ["IFCBEAM", "IFCBEAMSTANDARDCASE"],
  IFCCOLUMN: ["IFCCOLUMN", "IFCCOLUMNSTANDARDCASE"],
  IFCDOOR: ["IFCDOOR", "IFCDOORSTANDARDCASE", "IFCDOORLINING", "IFCDOORPANEL"],
  IFCFURNISHINGELEMENT: ["IFCFURNISHINGELEMENT"],
  IFCMEMBER: ["IFCMEMBER", "IFCBEAM", "IFCCOLUMN", "IFCWALL"],
  IFCWINDOW: ["IFCWINDOW", "IFCWINDOWSTANDARDCASE"],
  IFCWALL: ["IFCWALL", "IFCWALLSTANDARDCASE", "IFCMEMBER"],
};

export function validateClassReplacement(
  fromClass: string,
  toClass: string,
  compatibility = CLASS_COMPATIBILITY,
): ClassReplacementCheck {
  const source = normalizeClassName(fromClass);
  const target = normalizeClassName(toClass);
  if (!source || !target) {
    return { ok: false, reason: "Source and target IFC classes are required.", fromClass: source, toClass: target };
  }

  if (source === target) {
    return { ok: true, reason: "", fromClass: source, toClass: target };
  }

  const allowedTargets = compatibility[source];
  if (!allowedTargets) {
    return {
      ok: false,
      reason: `IFC class ${source} has no compatibility rule for replacement to ${target}.`,
      fromClass: source,
      toClass: target,
    };
  }

  if (allowedTargets.includes(target)) {
    return { ok: true, reason: "", fromClass: source, toClass: target };
  }

  return {
    ok: false,
    reason: `Replacement ${source} → ${target} is not compatible with the current mapping rules.`,
    fromClass: source,
    toClass: target,
  };
}

export function applyClassRemapping(records: BimElementRecord[], mappings: ClassMappingRule[]) {
  const mappingBySource = new Map(mappings.map((rule) => [normalizeClassName(rule.fromClass), rule]));
  return records.map((record) => {
    const rule = mappingBySource.get(normalizeClassName(record.category));
    if (!rule) {
      return { ...record, sourceCategory: record.category };
    }

    const validation = validateClassReplacement(record.category, rule.toClass);
    if (!validation.ok) {
      return { ...record, sourceCategory: record.category, remapReason: validation.reason };
    }

    const targetClass = normalizeClassName(rule.toClass);
    return {
      ...record,
      category: targetClass,
      searchable: rebuildSearchable(record.searchable, record.category, targetClass),
      sourceCategory: record.category,
      remapReason: rule.reason?.trim() || "",
    };
  });
}

export function summarizeClassMappings(mappings: ClassMappingRule[]): ClassMappingSummary {
  const diagnostics = mappings.map((rule) => validateClassReplacement(rule.fromClass, rule.toClass));
  return {
    total: mappings.length,
    compatible: diagnostics.filter((result) => result.ok).length,
    incompatible: diagnostics.filter((result) => !result.ok).length,
    diagnostics,
  };
}

function normalizeClassName(value: string) {
  return String(value ?? "").trim().toUpperCase();
}

function rebuildSearchable(searchable: string, fromClass: string, toClass: string) {
  if (!searchable) return searchable;
  const fromPattern = new RegExp(`\\b${escapeRegExp(fromClass)}\\b`, "g");
  return searchable.replace(fromPattern, toClass);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
