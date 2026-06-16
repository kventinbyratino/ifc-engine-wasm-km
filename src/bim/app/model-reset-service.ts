import type { BimAppContext } from "./app-context.ts";

export interface ModelResetServiceOptions {
  ctx: BimAppContext;
  clearSearch: () => Promise<void>;
  clearDrawings: () => void;
  renderIssues: () => void;
  renderClash: () => void;
  clearBBoxIndex: () => void;
  resetDataIndex: () => void;
  resetChecks: () => void;
  setActiveShareRecord: (record: null) => void;
  refreshModelState: () => void;
}

export function createModelResetService({
  ctx,
  clearSearch,
  clearDrawings,
  renderIssues,
  renderClash,
  clearBBoxIndex,
  resetDataIndex,
  resetChecks,
  setActiveShareRecord,
  refreshModelState,
}: ModelResetServiceOptions) {
  const { workspace, issueStore } = ctx;
  const { fragments } = ctx.viewer;
  const { fileName, searchPanel, saveFragmentBtn } = ctx.dom;

  async function clearModels(options: { keepStatus?: boolean } = {}) {
    for (const [modelId] of fragments.list) {
      await fragments.core.disposeModel(modelId);
    }
    await ctx.viewer.highlighter.clear("select");
    await clearSearch();
    searchPanel.hidden = true;
    saveFragmentBtn.hidden = true;
    setActiveShareRecord(null);
    clearDrawings();
    issueStore.clear();
    renderIssues();
    workspace.clash.clashes = [];
    renderClash();
    clearBBoxIndex();
    resetDataIndex();
    resetChecks();
    fileName.textContent = "-";
    if (!options.keepStatus) ctx.setStatus("Загрузите IFC");
    refreshModelState();
  }

  return {
    clearModels,
  };
}
