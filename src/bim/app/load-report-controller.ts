import type { BimAppContext } from "./app-context.ts";
import { buildModelLoadReportRows, type ModelLoadReport } from "../performance/load-report.ts";

export function createLoadReportController(ctx: BimAppContext) {
  const { loadReportModal, loadReportName, loadReportRows, closeLoadReportBtn } = ctx.dom;

  function openLoadReportModal(report: ModelLoadReport) {
    loadReportName.textContent = report.sourceName;
    renderReportRows(report);
    loadReportModal.hidden = false;
    closeLoadReportBtn.focus();
  }

  function closeLoadReportModal() {
    loadReportModal.hidden = true;
  }

  function renderReportRows(report: ModelLoadReport) {
    const rows = buildModelLoadReportRows(report).map((row) => {
      const element = document.createElement("div");
      element.className = "load-report-row";

      const label = document.createElement("span");
      label.className = "load-report-label";
      label.textContent = row.label;

      const value = document.createElement("strong");
      value.className = "load-report-value";
      value.textContent = row.value;

      element.append(label, value);
      return element;
    });

    loadReportRows.replaceChildren(...rows);
  }

  return {
    openLoadReportModal,
    closeLoadReportModal,
  };
}
