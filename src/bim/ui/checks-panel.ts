import type { BimElementRecord } from "../data/element-index.ts";
import { escapeHtml } from "../ui/dom-utils.ts";
import type { HealthCheckIssue, HealthCheckSeverity, ModelHealthReport } from "../checks/check-types.ts";

export function renderChecksPanel(options: {
  report: ModelHealthReport | null;
  output: HTMLElement;
  onSelect: (record: BimElementRecord) => void;
  onCreateIssue?: (issue: HealthCheckIssue) => void;
}) {
  const { report, output, onSelect, onCreateIssue } = options;
  if (!report) {
    output.replaceChildren(createEmptyMessage("Загрузите модель и нажмите “Проверить модель”."));
    return;
  }

  if (report.issues.length === 0) {
    output.replaceChildren(createEmptyMessage(`Проблем не найдено. Проверено ${report.summary.totalElements} элементов.`));
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "checks-list";

  for (const issue of report.issues.slice(0, 500)) {
    const card = document.createElement("article");
    card.className = `check-card check-card-${issue.severity}`;
    card.innerHTML = `
      <div class="check-card-main">
        <strong>${escapeHtml(issue.title)}</strong>
        <span>${escapeHtml(issue.description)}</span>
        <small>${escapeHtml(formatSeverity(issue.severity))} · ${escapeHtml(issue.record.category || "-")} · #${issue.localId}${issue.globalId ? ` · ${escapeHtml(issue.globalId)}` : ""}</small>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "check-card-actions";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.textContent = "К элементу";
    selectButton.onclick = () => onSelect(issue.record);
    actions.append(selectButton);

    if (onCreateIssue) {
      const issueButton = document.createElement("button");
      issueButton.type = "button";
      issueButton.textContent = "Issue";
      issueButton.onclick = () => onCreateIssue(issue);
      actions.append(issueButton);
    }

    card.append(actions);
    wrapper.append(card);
  }

  if (report.issues.length > 500) {
    const more = document.createElement("p");
    more.className = "data-more";
    more.textContent = `Показаны первые 500 из ${report.issues.length}. Экспортируйте отчёт для полного списка.`;
    wrapper.append(more);
  }

  output.replaceChildren(wrapper);
}

export function exportChecksJson(report: ModelHealthReport | null) {
  if (!report) return;
  downloadFile("bim-health-report.json", JSON.stringify(report, null, 2), "application/json");
}

export function exportChecksCsv(report: ModelHealthReport | null) {
  if (!report) return;
  const headers = [
    "severity",
    "type",
    "title",
    "description",
    "modelId",
    "localId",
    "ifcClass",
    "name",
    "globalId",
    "storey",
    "typeName",
  ];
  const rows = report.issues.map((issue) => [
    issue.severity,
    issue.type,
    issue.title,
    issue.description,
    issue.modelId,
    issue.localId,
    issue.record.category,
    issue.record.name,
    issue.globalId,
    issue.record.storey,
    issue.record.typeName,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  downloadFile("bim-health-report.csv", csv, "text/csv;charset=utf-8");
}

export function formatChecksSummary(report: ModelHealthReport | null) {
  if (!report) return "Проверка не выполнена";
  const { summary } = report;
  return `${summary.issueCount} проблем · critical ${summary.critical} · warning ${summary.warning} · info ${summary.info}`;
}

function formatSeverity(severity: HealthCheckSeverity) {
  if (severity === "critical") return "CRITICAL";
  if (severity === "warning") return "WARNING";
  return "INFO";
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function createEmptyMessage(text: string) {
  const message = document.createElement("span");
  message.className = "empty-state";
  message.textContent = text;
  return message;
}
