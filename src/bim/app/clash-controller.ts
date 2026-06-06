import { countSelection } from "../selection/selection";
import { detectHardClashes } from "../clash/clash-detector";
import type { ClashRecord } from "../clash/clash-types";
import { getClashGroupOptions, selectClashGroup, summarizeFederatedModels } from "../federation/federation";
import { BBoxIndex } from "../spatial/bbox-index";
import { fillClashGroupSelect, renderClashPanel } from "../ui/clash-panel";
import { createMessage } from "../ui/dom-utils";
import type { ModelIdMap } from "../types";
import type { BimAppContext } from "./app-context";

export interface ClashControllerHooks {
  canUseCoordination: () => boolean;
  rebuildDataIndex: () => Promise<void>;
  applySearchHighlight: (modelIdMap: ModelIdMap) => Promise<void>;
  fitToItems: (modelIdMap: ModelIdMap) => Promise<void>;
  renderIssues: () => void;
  captureCamera: () => { position: [number, number, number]; target: [number, number, number] };
}

export function createClashController(ctx: BimAppContext, hooks: ClashControllerHooks) {
  const { workspace, issueStore } = ctx;
  const { fragments } = ctx.viewer;
  const bboxIndex = new BBoxIndex();
  const {
    selectionCount,
    issuesPanel,
    clashPanel,
    clashSummary,
    clashGroupASelect,
    clashGroupBSelect,
    clashToleranceInput,
    runClashBtn,
    clashOutput,
  } = ctx.dom;

  function toggleClashPanel() {
    if (clashPanel.hidden) {
      openClashPanel();
      return;
    }
    closeClashPanel();
  }

  function openClashPanel() {
    if (!hooks.canUseCoordination()) {
      clashPanel.hidden = true;
      ctx.setStatus("Federation / Clash доступны только в профиле BIM");
      return;
    }

    clashPanel.hidden = false;
    if (workspace.elementIndex.length === 0 && fragments.list.size > 0) {
      void hooks.rebuildDataIndex().then(() => renderClash());
      return;
    }
    refreshClashSelectors();
    renderClash();
  }

  function closeClashPanel() {
    clashPanel.hidden = true;
  }

  function refreshClashSelectors() {
    const models = summarizeFederatedModels(workspace.elementIndex);
    const groups = getClashGroupOptions(workspace.elementIndex);
    fillClashGroupSelect(clashGroupASelect, { models, ...groups });
    fillClashGroupSelect(clashGroupBSelect, { models, ...groups });
  }

  function renderClash() {
    renderClashPanel({
      models: summarizeFederatedModels(workspace.elementIndex),
      clashes: workspace.clashes,
      output: clashOutput,
      summary: clashSummary,
      onSelect: (clash) => void selectClash(clash),
      onCreateIssue: createIssueFromClash,
    });
  }

  async function runClashDetection() {
    if (!hooks.canUseCoordination()) return;
    if (fragments.list.size === 0) return;

    runClashBtn.loading = true;
    try {
      clashPanel.hidden = false;
      if (workspace.elementIndex.length === 0) {
        clashSummary.textContent = "Сначала индексируем элементы...";
        await hooks.rebuildDataIndex();
      }

      const groupA = selectClashGroup(workspace.elementIndex, clashGroupASelect.value);
      const groupB = selectClashGroup(workspace.elementIndex, clashGroupBSelect.value);
      const tolerance = Math.max(0, Number(clashToleranceInput.value) || 0);
      clashSummary.textContent = `Проверка пар: ${Math.min(groupA.length, 250)} × ${Math.min(groupB.length, 250)}`;

      const result = await detectHardClashes(fragments, {
        groupA,
        groupB,
        tolerance,
        limit: 250,
        bboxIndex,
      });
      workspace.clashes = result.clashes;
      renderClash();
      ctx.setStatus(`Clash detection: ${result.clashes.length} найдено, ${result.checkedPairs} пар`);
    } catch (error) {
      console.error(error);
      clashSummary.textContent = "Ошибка clash detection";
      clashOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      runClashBtn.loading = false;
    }
  }

  async function selectClash(clash: ClashRecord) {
    await hooks.applySearchHighlight(clash.modelIdMap);
    await hooks.fitToItems(clash.modelIdMap);
    workspace.activeSelection = clash.modelIdMap;
    selectionCount.textContent = String(countSelection(clash.modelIdMap));
  }

  function createIssueFromClash(clash: ClashRecord) {
    const issue = issueStore.create({
      title: `Clash: ${clash.title}`,
      description: clash.description,
      priority: clash.severity === "critical" ? "critical" : clash.severity === "warning" ? "high" : "medium",
      source: "manual",
      record: clash.a,
      camera: hooks.captureCamera(),
    });
    issuesPanel.hidden = false;
    hooks.renderIssues();
    ctx.setStatus(`Issue создан из clash: ${issue.title}`);
  }

  return {
    toggleClashPanel,
    openClashPanel,
    closeClashPanel,
    refreshClashSelectors,
    renderClash,
    runClashDetection,
    clearBBoxIndex: () => bboxIndex.clear(),
  };
}
