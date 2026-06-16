import { countSelection } from "../selection/selection.ts";
import { detectHardClashes } from "../clash/clash-detector.ts";
import type { ClashRecord } from "../clash/clash-types.ts";
import { getClashGroupOptions, selectClashGroup, summarizeFederatedModels } from "../federation/federation.ts";
import { applyFederationFilters } from "../federation/federation-filters.ts";
import { BBoxIndex } from "../spatial/bbox-index.ts";
import { fillClashGroupSelect, renderClashPanel } from "../ui/clash-panel.ts";
import { createMessage } from "../ui/dom-utils.ts";
import type { ModelIdMap } from "../types.ts";
import type { BimAppContext } from "./app-context.ts";
import { logControllerError } from "../ui/controller-errors.ts";

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
    const federatedRecords = applyFederationFilters(
      workspace.data.elementIndex,
      models,
      workspace.federation.filters,
    );
    const groups = getClashGroupOptions(federatedRecords);
    fillClashGroupSelect(clashGroupASelect, { models: summarizeFederatedModels(federatedRecords), ...groups });
    fillClashGroupSelect(clashGroupBSelect, { models: summarizeFederatedModels(federatedRecords), ...groups });
  }

  function renderClash() {
    const models = summarizeFederatedModels(workspace.data.elementIndex);
    const federatedRecords = applyFederationFilters(
      workspace.data.elementIndex,
      models,
      workspace.federation.filters,
    );
    renderClashPanel({
      models: summarizeFederatedModels(federatedRecords),
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
      const models = summarizeFederatedModels(workspace.data.elementIndex);
      const federatedRecords = applyFederationFilters(
        workspace.data.elementIndex,
        models,
        workspace.federation.filters,
      );
      const groupA = selectClashGroup(federatedRecords, clashGroupASelect.value);
      const groupB = selectClashGroup(federatedRecords, clashGroupBSelect.value);
      const tolerance = Math.max(0, Number(clashToleranceInput.value) || 0);
      clashSummary.textContent = `Проверка пар: ${Math.min(groupA.length, 250)} × ${Math.min(groupB.length, 250)}`;

      const result = await detectHardClashes(fragments, {
        groupA,
        groupB,
        tolerance,
        limit: 250,
        bboxIndex,
        signal: activeSignal,
        crossModelOnly: true,
      });
      workspace.clash.clashes = result.clashes;
      renderClash();
      ctx.setStatus(`Clash detection: ${result.clashes.length} найдено, ${result.checkedPairs} пар`);
      ctx.showToast(`Clash detection: ${result.clashes.length} найдено`, "success");
    } catch (error) {
      logControllerError(error);
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
