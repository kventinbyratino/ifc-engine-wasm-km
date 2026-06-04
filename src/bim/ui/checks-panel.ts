import type { BimElementRecord } from "../data/element-index";
import { escapeHtml } from "../ui/dom-utils";
import type { IDSReportItem, IDSValidationReport } from "../checks/check-types";

export function renderChecksPanel(options: {
  report: IDSValidationReport | null;
  output: HTMLElement;
  onSelect: (record: BimElementRecord) => void;
}) {
  const { report, output, onSelect } = options;
  if (!report) {
    output.replaceChildren(createEmptyMessage("Загрузите IDS и запустите проверку."));
    return;
  }

  const failed = report.items.filter((item) => item.status === "fail");
  if (failed.length === 0) {
    output.replaceChildren(createEmptyMessage(`IDS пройден. Проверено ${report.summary.applicableElements} применимых элементов.`));
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "checks-list";

  for (const item of failed.slice(0, 500)) {
    const card = document.createElement("article");
    card.className = "check-card check-card-critical";
    card.innerHTML = `
      <div class="check-card-main">
        <strong>${escapeHtml(item.specification)}</strong>
        <span>${escapeHtml(formatFailedChecks(item))}</span>
        <small>FAIL · ${escapeHtml(item.record?.category ?? "-")} · #${item.localId}${item.globalId ? ` · ${escapeHtml(item.globalId)}` : ""}</small>
      </div>
    `;

    if (item.record) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "К элементу";
      button.onclick = () => onSelect(item.record!);
      card.append(button);
    }

    wrapper.append(card);
  }

  if (failed.length > 500) {
    const more = document.createElement("p");
    more.className = "data-more";
    more.textContent = `Показаны первые 500 из ${failed.length}. Экспортируйте отчёт для полного списка.`;
    wrapper.append(more);
  }

  output.replaceChildren(wrapper);
}

export function exportChecksJson(report: IDSValidationReport | null) {
  if (!report) return;
  downloadFile("bim-ids-report.json", JSON.stringify(report, null, 2), "application/json");
}

export function exportChecksCsv(report: IDSValidationReport | null) {
  if (!report) return;
  const headers = [
    "status",
    "specification",
    "modelId",
    "localId",
    "ifcClass",
    "name",
    "globalId",
    "facetType",
    "parameter",
    "currentValue",
    "requiredValue",
    "pass",
  ];
  const rows = report.items.flatMap((item) => {
    const checks = item.checks.length ? item.checks : [{ facetType: "", parameter: "", currentValue: "", requiredValue: "", pass: item.status === "pass" }];
    return checks.map((check) => [
      item.status,
      item.specification,
      item.modelId,
      item.localId,
      item.record?.category ?? "",
      item.record?.name ?? "",
      item.globalId,
      check.facetType,
      check.parameter,
      check.currentValue,
      check.requiredValue,
      check.pass,
    ]);
  });
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  downloadFile("bim-ids-report.csv", csv, "text/csv;charset=utf-8");
}

export function formatChecksSummary(report: IDSValidationReport | null) {
  if (!report) return "IDS не загружен";
  const { summary } = report;
  return `${report.idsTitle} · specs ${summary.specifications} · fail ${summary.fail} · pass ${summary.pass}`;
}

function formatFailedChecks(item: IDSReportItem) {
  const failed = item.checks.filter((check) => !check.pass);
  if (failed.length === 0) return "Элемент не прошёл IDS требование";
  return failed
    .slice(0, 3)
    .map((check) => `${check.facetType}/${check.parameter}: требуется ${check.requiredValue || "значение"}`)
    .join("; ");
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
