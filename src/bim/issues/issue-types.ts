import type { BimElementRecord } from "../data/element-index";

export type BimIssueStatus = "open" | "in-review" | "closed";
export type BimIssuePriority = "critical" | "high" | "medium" | "low";

export type BimIssue = {
  id: string;
  title: string;
  description: string;
  status: BimIssueStatus;
  priority: BimIssuePriority;
  source: "manual" | "health-check" | "clash";
  modelId: string;
  localId: number;
  globalId: string;
  ifcClass: string;
  elementName: string;
  camera?: BimIssueCamera;
  createdAt: string;
  updatedAt: string;
};

export type BimIssueCamera = {
  position: [number, number, number];
  target: [number, number, number];
};

export type IssueDraft = {
  title: string;
  description?: string;
  priority?: BimIssuePriority;
  source?: BimIssue["source"];
  record: BimElementRecord;
  camera?: BimIssueCamera;
};
