import type { BimElementRecord } from "./element-index";
import { escapeHtml } from "../ui/dom-utils";

export function renderElementTable(options: {
  records: BimElementRecord[];
  totalCount: number;
  output: HTMLElement;
  onSelect: (record: BimElementRecord) => void;
}) {
  const { records, totalCount, output, onSelect } = options;
  const rendered = records.slice(0, 300);

  if (totalCount === 0) {
    output.replaceChildren(createEmptyDataMessage("Нет элементов по текущим фильтрам."));
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "data-table-wrap";

  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>IFC Class</th>
        <th>Name</th>
        <th>GlobalId</th>
        <th>Storey</th>
        <th>Psets</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody")!;
  for (const record of rendered) {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.innerHTML = `
      <td>${escapeHtml(record.category || "-")}</td>
      <td>
        <strong>${escapeHtml(record.name || `#${record.localId}`)}</strong>
        <small>${escapeHtml(record.modelId)} · ${record.localId}${record.typeName ? ` · ${escapeHtml(record.typeName)}` : ""}</small>
      </td>
      <td>${escapeHtml(record.globalId || "-")}</td>
      <td>${escapeHtml(record.storey || "-")}</td>
      <td>${record.psetCount}</td>
    `;
    row.onclick = () => onSelect(record);
    row.onkeydown = (event) => {
      if (event.code === "Enter" || event.code === "Space") onSelect(record);
    };
    tbody.append(row);
  }

  wrapper.append(table);

  if (totalCount > rendered.length) {
    const more = document.createElement("p");
    more.className = "data-more";
    more.textContent = `Показаны первые ${rendered.length} из ${totalCount}. Уточните фильтр.`;
    wrapper.append(more);
  }

  output.replaceChildren(wrapper);
}

export function exportElementsJson(records: BimElementRecord[]) {
  downloadFile(
    "bim-elements.json",
    JSON.stringify(records.map(stripSearchable), null, 2),
    "application/json",
  );
}

export function exportElementsCsv(records: BimElementRecord[]) {
  const headers = ["modelId", "localId", "ifcClass", "name", "globalId", "type", "storey", "psetCount"];
  const rows = records.map((record) => [
    record.modelId,
    record.localId,
    record.category,
    record.name,
    record.globalId,
    record.typeName,
    record.storey,
    record.psetCount,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  downloadFile("bim-elements.csv", csv, "text/csv;charset=utf-8");
}

export function fillSelectOptions(select: HTMLSelectElement, values: string[], label: string) {
  const currentValue = select.value;
  select.replaceChildren(new Option(label, ""), ...values.map((value) => new Option(value, value)));
  if (values.includes(currentValue)) select.value = currentValue;
}

function stripSearchable(record: BimElementRecord) {
  const { searchable: _searchable, ...publicRecord } = record;
  return publicRecord;
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

function createEmptyDataMessage(text: string) {
  const message = document.createElement("span");
  message.className = "empty-state";
  message.textContent = text;
  return message;
}
