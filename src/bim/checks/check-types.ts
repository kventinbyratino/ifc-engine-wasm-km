import type { BimElementRecord } from "../data/element-index.ts";
import type { ClassMappingSummary } from "../ifc-overrides/class-mapping.ts";

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

export type HealthCheckSeverity = "critical" | "warning" | "info";

export type HealthCheckIssueType =
  | "missing-name"
  | "missing-global-id"
  | "duplicate-global-id"
  | "missing-storey"
  | "missing-type"
  | "proxy-overuse"
  | "empty-property-sets"
  | "door-missing-fire-rating"
  | "space-missing-name-or-number"
  | "missing-material";

export type HealthCheckIssue = {
  id: string;
  type: HealthCheckIssueType;
  title: string;
  description: string;
  severity: HealthCheckSeverity;
  modelId: string;
  localId: number;
  globalId: string;
  record: BimElementRecord;
};

export type HealthCheckSummary = {
  totalElements: number;
  critical: number;
  warning: number;
  info: number;
  issueCount: number;
};

export type ModelHealthReport = {
  title: string;
  createdAt: string;
  issues: HealthCheckIssue[];
  summary: HealthCheckSummary;
  classCompatibility?: ClassMappingSummary;
};
