import { getProfileCapabilities } from "../profiles/index.ts";
import type { BimAppContext, BimDomElements, BimIfcOverrideStore, BimIssueStore, BimViewer, BimWorkspace } from "./app-context.ts";

export interface BimAppContextFactoryOptions {
  dom: BimDomElements;
  viewer: BimViewer;
  workspace: BimWorkspace;
  issueStore: BimIssueStore;
  ifcOverrideStore: BimIfcOverrideStore;
  syncIfcOverrideState: () => void;
  savePropertyOverride: BimAppContext["savePropertyOverride"];
  setStatus: BimAppContext["setStatus"];
  setBusy: BimAppContext["setBusy"];
  setProgress: BimAppContext["setProgress"];
  startOperation: BimAppContext["startOperation"];
  finishOperation: BimAppContext["finishOperation"];
  showToast: BimAppContext["showToast"];
  showError: BimAppContext["showError"];
}

export function createBimAppContext(options: BimAppContextFactoryOptions): BimAppContext {
  const {
    dom,
    viewer,
    workspace,
    issueStore,
    ifcOverrideStore,
    syncIfcOverrideState,
    savePropertyOverride,
    setStatus,
    setBusy,
    setProgress,
    startOperation,
    finishOperation,
    showToast,
    showError,
  } = options;

  return {
    dom,
    viewer,
    workspace,
    issueStore,
    ifcOverrideStore,
    syncIfcOverrideState,
    savePropertyOverride,
    getCapabilities: () => getProfileCapabilities(workspace.viewer.activeProfile),
    setStatus,
    setBusy,
    setProgress,
    startOperation,
    finishOperation,
    showToast,
    showError,
  };
}
