import type { BimElementRecord } from "../data/element-index";

export type IDSReportStatus = "pass" | "fail";

export type IDSPropertyRequirementDraft = {
  title: string;
  specificationName: string;
  entity: string;
  propertySet: string;
  propertyName: string;
};

export type IDSRequirementCheck = {
  facetType: string;
  parameter: string;
  currentValue: string;
  requiredValue: string;
  pass: boolean;
};

export type IDSReportItem = {
  id: string;
  specification: string;
  status: IDSReportStatus;
  modelId: string;
  localId: number;
  globalId: string;
  record?: BimElementRecord;
  checks: IDSRequirementCheck[];
};

export type IDSReportSummary = {
  specifications: number;
  applicableElements: number;
  pass: number;
  fail: number;
};

export type IDSValidationReport = {
  idsTitle: string;
  createdAt: string;
  items: IDSReportItem[];
  summary: IDSReportSummary;
};
