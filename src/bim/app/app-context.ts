import type { getDomElements } from "../dom";
import type { createIssueStore } from "../issues/issues-store";
import type { getProfileCapabilities } from "../profiles";
import type { createWorkspaceState } from "../state/workspace-state";
import type { createBimViewer } from "../viewer/viewer";

export type BimDomElements = ReturnType<typeof getDomElements>;
export type BimViewer = Awaited<ReturnType<typeof createBimViewer>>;
export type BimWorkspace = ReturnType<typeof createWorkspaceState>;
export type BimIssueStore = ReturnType<typeof createIssueStore>;
export type ProfileCapabilities = ReturnType<typeof getProfileCapabilities>;

export interface BimAppContext {
  dom: BimDomElements;
  viewer: BimViewer;
  workspace: BimWorkspace;
  issueStore: BimIssueStore;
  getCapabilities: () => ProfileCapabilities;
  setStatus: (message: string) => void;
  setBusy: (isBusy: boolean, message?: string) => void;
  setProgress: (value: number) => void;
  startOperation: (message: string) => AbortSignal;
  finishOperation: (signal: AbortSignal) => void;
  showToast: (message: string, type?: "info" | "success" | "error") => void;
  showError: (error: unknown) => void;
};
