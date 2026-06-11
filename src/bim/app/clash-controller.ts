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
      ctx.showToast("Federation / Clash доступны только в профиле BIM", "error");
      return;
    }

    clashPanel.hidden = false;
    if (workspace.data.elementIndex.length === 0 && fragments.list.size > 0) {
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
    const models = summarizeFederatedModels(workspace.data.elementIndex);
    const groups = getClashGroupOptions(workspace.data.elementIndex);
    fillClashGroupSelect(clashGroupASelect, { models, ...groups });
    fillClashGroupSelect(clashGroupBSelect, { models, ...groups });
  }

  function renderClash() {
    renderClashPanel({
      models: summarizeFederatedModels(workspace.data.elementIndex),
      clashes: workspace.clash.clashes,
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
    let signal: AbortSignal | null = null;
    try {
      clashPanel.hidden = false;
      if (workspace.data.elementIndex.length === 0) {
        clashSummary.textContent = "Сначала индексируем элементы...";
        await hooks.rebuildDataIndex();
      }

      const activeSignal = ctx.startOperation("Clash detection");
      signal = activeSignal;
      const groupA = selectClashGroup(workspace.data.elementIndex, clashGroupASelect.value);
      const groupB = selectClashGroup(workspace.data.elementIndex, clashGroupBSelect.value);
      const tolerance = Math.max(0, Number(clashToleranceInput.value) || 0);
      clashSummary.textContent = `Проверка пар: ${Math.min(groupA.length, 250)} × ${Math.min(groupB.length, 250)}`;

      const result = await detectHardClashes(fragments, {
        groupA,
        groupB,
        tolerance,
        limit: 250,
        bboxIndex,
        signal: activeSignal,
      });
      workspace.clash.clashes = result.clashes;
      renderClash();
      ctx.setStatus(`Clash detection: ${result.clashes.length} найдено, ${result.checkedPairs} пар`);
      ctx.showToast(`Clash detection: ${result.clashes.length} найдено`, "success");
    } catch (error) {
      console.error(error);
      if (isAbortError(error)) {
        clashSummary.textContent = "Clash detection отменён";
        clashOutput.replaceChildren(createMessage("Операция отменена."));
        ctx.setStatus("Clash detection отменён");
        ctx.showToast("Clash detection отменён", "info");
        return;
      }
      clashSummary.textContent = "Ошибка clash detection";
      clashOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      runClashBtn.loading = false;
      if (signal) ctx.finishOperation(signal);
    }
  }

  async function selectClash(clash: ClashRecord) {
    await hooks.applySearchHighlight(clash.modelIdMap);
    await hooks.fitToItems(clash.modelIdMap);
    workspace.viewer.activeSelection = clash.modelIdMap;
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
    ctx.showToast(`Issue создан из clash: ${issue.title}`, "success");
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
