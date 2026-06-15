import type { BimElementRecord } from "./element-record.ts";
import { escapeHtml } from "../ui/dom-utils.ts";

export function renderElementsTable(options: {
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
        <th>Этаж</th>
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

export const renderElementTable = renderElementsTable;

function createEmptyDataMessage(text: string) {
  const message = document.createElement("span");
  message.className = "empty-state";
  message.textContent = text;
  return message;
}
