import type { BimIssue } from "./issue-types.ts";

export function exportIssuesJson(issues: BimIssue[]) {
  downloadFile("bim-issues.json", JSON.stringify(issues, null, 2), "application/json");
}

export function exportIssuesBcfLikeJson(issues: BimIssue[]) {
  const payload = {
    format: "bcf-foundation-json",
    version: "0.1",
    exportedAt: new Date().toISOString(),
    topics: issues.map((issue) => ({
      guid: issue.id,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      status: issue.status,
      labels: [issue.source, issue.ifcClass].filter(Boolean),
      reference_links: issue.globalId ? [`ifc-global-id:${issue.globalId}`] : [],
      bim_snippet: {
        modelId: issue.modelId,
        localId: issue.localId,
        globalId: issue.globalId,
        ifcClass: issue.ifcClass,
        elementName: issue.elementName,
      },
      viewpoint: issue.camera,
      creation_date: issue.createdAt,
      modified_date: issue.updatedAt,
    })),
  };

  downloadFile("bim-issues-bcf-foundation.json", JSON.stringify(payload, null, 2), "application/json");
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
