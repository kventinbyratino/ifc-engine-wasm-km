import * as OBC from "@thatopen/components";
import type { BimElementRecord } from "../data/element-index";
import type { IDSPropertyRequirementDraft, IDSRequirementCheck, IDSValidationReport } from "./check-types";

export function loadIDSSpecifications(components: OBC.Components, idsXml: string) {
  const ids = components.get(OBC.IDSSpecifications);
  ids.list.clear();
  return ids.load(idsXml);
}

export function getLoadedIDSSpecificationCount(components: OBC.Components) {
  return components.get(OBC.IDSSpecifications).list.size;
}

export function getIDSTitle(components: OBC.Components) {
  return components.get(OBC.IDSSpecifications).IDSInfo?.title ?? "";
}

export function addIDSPropertyRequirement(components: OBC.Components, draft: IDSPropertyRequirementDraft) {
  const ids = components.get(OBC.IDSSpecifications);
  ids.IDSInfo = { title: draft.title.trim() || ids.IDSInfo?.title || "BIM IDS" };
  const spec = ids.create(draft.specificationName, ["IFC4"]);
  spec.description = `${draft.entity} must have ${draft.propertySet}.${draft.propertyName}`;
  spec.applicability.add(
    new OBC.IDSEntity(components, {
      type: "simple",
      parameter: draft.entity.trim().toUpperCase(),
    }),
  );
  spec.requirements.add(
    new OBC.IDSProperty(
      components,
      { type: "simple", parameter: draft.propertySet.trim() },
      { type: "simple", parameter: draft.propertyName.trim() },
    ),
  );
  return spec;
}

export function exportIDSSpecifications(components: OBC.Components, title: string) {
  const ids = components.get(OBC.IDSSpecifications);
  return ids.export({
    title: title.trim() || ids.IDSInfo?.title || "BIM IDS",
    date: new Date(),
  });
}

export async function runIDSValidation(options: {
  components: OBC.Components;
  modelIds: string[];
  elementIndex: BimElementRecord[];
}) {
  const ids = options.components.get(OBC.IDSSpecifications);
  const specs = [...ids.list.values()];
  const records = new Map(options.elementIndex.map((record) => [`${record.modelId}:${record.localId}`, record]));
  const items: IDSValidationReport["items"] = [];

  for (const spec of specs) {
    const result = await spec.test(options.modelIds.map((modelId) => new RegExp(`^${escapeRegExp(modelId)}$`)), {
      skipIfFails: false,
    });

    for (const [modelId, modelItems] of result) {
      for (const [localId, itemResult] of modelItems) {
        const key = `${modelId}:${localId}`;
        const record = records.get(key);
        items.push({
          id: `${spec.identifier}:${key}`,
          specification: spec.name,
          status: itemResult.pass ? "pass" : "fail",
          modelId,
          localId,
          globalId: itemResult.guid ?? record?.globalId ?? "",
          record,
          checks: itemResult.checks.flatMap((facetCheck) =>
            facetCheck.checks.map((check) => normalizeCheck(facetCheck.facetType, check)),
          ),
        });
      }
    }
  }

  return {
    idsTitle: ids.IDSInfo?.title ?? "IDS",
    createdAt: new Date().toISOString(),
    items,
    summary: {
      specifications: specs.length,
      applicableElements: items.length,
      pass: items.filter((item) => item.status === "pass").length,
      fail: items.filter((item) => item.status === "fail").length,
    },
  } satisfies IDSValidationReport;
}

function normalizeCheck(facetType: string, check: OBC.IDSCheck): IDSRequirementCheck {
  return {
    facetType,
    parameter: check.parameter ?? "-",
    currentValue: formatValue(check.currentValue),
    requiredValue: formatValue(check.requiredValue),
    pass: check.pass,
  };
}

function formatValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    const parameter = (value as { parameter?: unknown }).parameter;
    if (parameter !== undefined) return Array.isArray(parameter) ? parameter.join(" | ") : String(parameter);
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
