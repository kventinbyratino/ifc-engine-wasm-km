import type { BimElementRecord } from "./element-record.ts";

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

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const title of ["IFC Class", "Name", "GlobalId", "Этаж", "Psets"]) {
    const th = document.createElement("th");
    th.textContent = title;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  for (const record of rendered) {
    const row = document.createElement("tr");
    row.tabIndex = 0;

    const classCell = document.createElement("td");
    classCell.textContent = record.category || "-";

    const nameCell = document.createElement("td");
    const nameStrong = document.createElement("strong");
    nameStrong.textContent = record.name || `#${record.localId}`;
    const nameSmall = document.createElement("small");
    nameSmall.textContent = `${record.modelId} · ${record.localId}${record.typeName ? ` · ${record.typeName}` : ""}`;
    nameCell.append(nameStrong, nameSmall);

    const globalIdCell = document.createElement("td");
    globalIdCell.textContent = record.globalId || "-";

    const storeyCell = document.createElement("td");
    storeyCell.textContent = record.storey || "-";

    const psetsCell = document.createElement("td");
    psetsCell.textContent = String(record.psetCount);

    row.append(classCell, nameCell, globalIdCell, storeyCell, psetsCell);
    row.onclick = () => onSelect(record);
    row.onkeydown = (event) => {
      if (event.code === "Enter" || event.code === "Space") onSelect(record);
    };
    tbody.append(row);
  }

  table.append(thead, tbody);
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
