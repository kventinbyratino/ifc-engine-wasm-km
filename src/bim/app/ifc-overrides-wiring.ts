import { renderSelectedProperties } from "../properties/properties-panel.ts";
import { createIfcOverrideStore } from "../ifc-overrides/override-store.ts";
import type { IfcPropertyOverrideDraft } from "../ifc-overrides/override-types.ts";
import type { BimDomElements, BimViewer, BimWorkspace } from "./app-context.ts";

export interface IfcOverridesWiringOptions {
  dom: BimDomElements;
  viewer: BimViewer;
  workspace: BimWorkspace;
  showToast: (message: string, type?: "info" | "success" | "error") => void;
}

export function createIfcOverridesWiring({ dom, viewer, workspace, showToast }: IfcOverridesWiringOptions) {
  const ifcOverrideStore = createIfcOverrideStore();

  const syncIfcOverrideState = () => {
    const snapshot = ifcOverrideStore.snapshot();
    workspace.ifcOverrides = snapshot;
    workspace.data.pendingIfcOverrideCount = snapshot.pendingCount;
  };

  async function renderPropertiesPanel() {
    await renderSelectedProperties({
      components: viewer.components,
      modelIdMap: workspace.viewer.activeSelection,
      output: dom.propertiesOutput,
      overrideState: workspace.ifcOverrides,
      onSaveOverride: savePropertyOverride,
      onRemoveOverride: removeOverride,
      onClearOverrides: clearOverrides,
    });
  }

  async function savePropertyOverride(draft: IfcPropertyOverrideDraft) {
    ifcOverrideStore.setPropertyOverride(draft);
    syncIfcOverrideState();
    await renderPropertiesPanel();
    showToast(`Saved pending override for ${draft.propertySet}.${draft.propertyName}`, "success");
  }

  async function removeOverride(key: string) {
    const removed = ifcOverrideStore.remove(key);
    syncIfcOverrideState();
    await renderPropertiesPanel();
    showToast(removed ? "Pending override отменён" : "Pending override не найден", removed ? "success" : "error");
  }

  async function clearOverrides() {
    ifcOverrideStore.clear();
    syncIfcOverrideState();
    await renderPropertiesPanel();
    showToast("Все pending overrides сброшены", "success");
  }

  syncIfcOverrideState();

  return {
    ifcOverrideStore,
    syncIfcOverrideState,
    savePropertyOverride,
    removeOverride,
    clearOverrides,
  };
}
