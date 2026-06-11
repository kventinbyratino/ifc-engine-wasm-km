import * as THREE from "three";
import { isEmptySelection } from "../selection/selection";
import type { HealthCheckIssue } from "../checks/check-types";
import type { BimElementRecord } from "../data/element-index";
import type { BimIssue } from "../issues/issue-types";
import { exportIssuesBcfLikeJson, exportIssuesJson } from "../issues/bcf-export";
import { renderIssuesPanel } from "../ui/issues-panel";
import type { BimAppContext } from "./app-context";

export interface IssuesControllerHooks {
  canUseIssues: () => boolean;
  rebuildDataIndex: () => Promise<void>;
  selectDataRecord: (record: BimElementRecord) => Promise<void>;
}

export function createIssuesController(ctx: BimAppContext, hooks: IssuesControllerHooks) {
  const { workspace, issueStore } = ctx;
  const { world } = ctx.viewer;
  const { issuesPanel, issuesSummary, issuesOutput } = ctx.dom;

  function toggleIssuesPanel() {
    if (issuesPanel.hidden) {
      openIssuesPanel();
      return;
    }
    closeIssuesPanel();
  }

  function openIssuesPanel() {
    if (!hooks.canUseIssues()) {
      issuesPanel.hidden = true;
      ctx.setStatus("Issues / BCF доступны только в профиле BIM");
      ctx.showToast("Issues / BCF доступны только в профиле BIM", "error");
      return;
    }

    issuesPanel.hidden = false;
    renderIssues();
  }

  function closeIssuesPanel() {
    issuesPanel.hidden = true;
  }

  function renderIssues() {
    renderIssuesPanel({
      issues: issueStore.list(),
      output: issuesOutput,
      summary: issuesSummary,
      onSelect: selectIssue,
      onStatusChange: (issue, status) => {
        issueStore.updateStatus(issue.id, status);
        renderIssues();
        ctx.showToast(`Статус issue: ${status}`, "success");
      },
      onDelete: (issue) => {
        issueStore.remove(issue.id);
        renderIssues();
        ctx.showToast(`Issue удалён: ${issue.title}`, "success");
      },
    });
  }

  async function createIssueFromSelection() {
    if (!hooks.canUseIssues()) return;
    if (isEmptySelection(workspace.viewer.activeSelection)) {
      issuesSummary.textContent = "Сначала выберите элемент";
      ctx.showToast("Сначала выберите элемент", "error");
      return;
    }

    if (workspace.data.elementIndex.length === 0) await hooks.rebuildDataIndex();
    const record = findRecordInSelection();
    if (!record) {
      issuesSummary.textContent = "Выбранный элемент не найден в BIM Data Index";
      ctx.showToast("Выбранный элемент не найден в BIM Data Index", "error");
      return;
    }

    const issue = issueStore.create({
      title: `Замечание: ${record.name || record.category}`,
      description: `${record.category} #${record.localId}`,
      priority: "medium",
      source: "manual",
      record,
      camera: captureCamera(),
    });
    issuesPanel.hidden = false;
    renderIssues();
    ctx.setStatus(`Issue создан: ${issue.title}`);
    ctx.showToast(`Issue создан: ${issue.title}`, "success");
  }

  function createIssueFromHealthCheck(healthIssue: HealthCheckIssue) {
    const priority = healthIssue.severity === "critical" ? "critical" : healthIssue.severity === "warning" ? "medium" : "low";
    const issue = issueStore.create({
      title: healthIssue.title,
      description: healthIssue.description,
      priority,
      source: "health-check",
      record: healthIssue.record,
      camera: captureCamera(),
    });
    issuesPanel.hidden = false;
    renderIssues();
    ctx.setStatus(`Issue создан из проверки: ${issue.title}`);
    ctx.showToast(`Issue создан из проверки: ${issue.title}`, "success");
  }

  async function selectIssue(issue: BimIssue) {
    const record = workspace.data.elementIndex.find((item) => item.modelId === issue.modelId && item.localId === issue.localId) ?? {
      modelId: issue.modelId,
      localId: issue.localId,
      name: issue.elementName,
      category: issue.ifcClass,
      globalId: issue.globalId,
      typeName: "",
      storey: "",
      number: "",
      materialName: "",
      psetCount: 0,
      searchable: "",
    };
    await hooks.selectDataRecord(record);
  }

  function findRecordInSelection() {
    for (const record of workspace.data.elementIndex) {
      if (workspace.viewer.activeSelection[record.modelId]?.has(record.localId)) return record;
    }
    return null;
  }

  function captureCamera() {
    const position = world.camera.three.position;
    const target = world.camera.controls.getTarget(new THREE.Vector3());
    return {
      position: [position.x, position.y, position.z] as [number, number, number],
      target: [target.x, target.y, target.z] as [number, number, number],
    };
  }

  return {
    toggleIssuesPanel,
    openIssuesPanel,
    closeIssuesPanel,
    renderIssues,
    createIssueFromSelection,
    createIssueFromHealthCheck,
    exportIssuesJson,
    exportIssuesBcfLikeJson,
    captureCamera,
  };
}
