import type { BimIssue, BimIssueStatus } from "../issues/issue-types.ts";
import { escapeHtml } from "./dom-utils.ts";

export function renderIssuesPanel(options: {
  issues: BimIssue[];
  output: HTMLElement;
  summary: HTMLElement;
  onSelect: (issue: BimIssue) => void;
  onStatusChange: (issue: BimIssue, status: BimIssueStatus) => void;
  onDelete: (issue: BimIssue) => void;
}) {
  const { issues, output, summary, onSelect, onStatusChange, onDelete } = options;
  summary.textContent = formatIssuesSummary(issues);

  if (issues.length === 0) {
    output.replaceChildren(createEmptyMessage("Замечаний пока нет. Выберите элемент или создайте issue из проверки."));
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "issues-list";

  for (const issue of issues) {
    const card = document.createElement("article");
    card.className = `issue-card issue-card-${issue.priority}`;
    card.innerHTML = `
      <div class="issue-card-main">
        <strong>${escapeHtml(issue.title)}</strong>
        <span>${escapeHtml(issue.description || issue.elementName || issue.ifcClass)}</span>
        <small>${escapeHtml(issue.status)} · ${escapeHtml(issue.priority)} · ${escapeHtml(issue.ifcClass)} · #${issue.localId}${issue.globalId ? ` · ${escapeHtml(issue.globalId)}` : ""}</small>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "issue-card-actions";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.textContent = "К элементу";
    selectButton.onclick = () => onSelect(issue);
    actions.append(selectButton);

    const statusSelect = document.createElement("select");
    statusSelect.className = "data-select issue-status-select";
    for (const status of ["open", "in-review", "closed"] satisfies BimIssueStatus[]) {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      option.selected = issue.status === status;
      statusSelect.append(option);
    }
    statusSelect.onchange = () => onStatusChange(issue, statusSelect.value as BimIssueStatus);
    actions.append(statusSelect);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Удалить";
    deleteButton.onclick = () => onDelete(issue);
    actions.append(deleteButton);

    card.append(actions);
    wrapper.append(card);
  }

  output.replaceChildren(wrapper);
}

export function formatIssuesSummary(issues: BimIssue[]) {
  const open = issues.filter((issue) => issue.status === "open").length;
  const review = issues.filter((issue) => issue.status === "in-review").length;
  const closed = issues.filter((issue) => issue.status === "closed").length;
  return `${issues.length} issues · open ${open} · review ${review} · closed ${closed}`;
}

function createEmptyMessage(text: string) {
  const message = document.createElement("span");
  message.className = "empty-state";
  message.textContent = text;
  return message;
}
