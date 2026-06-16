import { loadStoredFederationWorkspace, restoreFederationState, type StoredFederationWorkspace } from "../federation/federation-persistence.ts";
import { loadStoredFederationSnapshot, restoreFederationSnapshot } from "../federation/federation-snapshot.ts";
import type { FederationLoadSource } from "../federation/federation-registry.ts";
import type { BimAppContext, BimWorkspace } from "./app-context.ts";

export function restoreStoredFederationState(workspace: BimWorkspace) {
  const storedFederationSnapshot = loadStoredFederationSnapshot();
  const storedFederationWorkspace = storedFederationSnapshot?.federation ?? loadStoredFederationWorkspace();
  if (storedFederationWorkspace) {
    restoreFederationState(workspace.federation, storedFederationWorkspace);
  }
  if (storedFederationSnapshot) {
    restoreFederationSnapshot(workspace, storedFederationSnapshot);
  }
  return { storedFederationSnapshot, storedFederationWorkspace };
}

export interface FederationWorkspaceRestorerOptions {
  ctx: BimAppContext;
  storedFederationWorkspace: StoredFederationWorkspace | null;
  fragmentId?: string | null;
  apiBase: string;
  fetchExampleBlob: (reference: string) => Promise<Blob>;
  loadIfc: (file: File, source?: FederationLoadSource) => Promise<void>;
  loadFragBuffer: (buffer: ArrayBuffer, name: string, source?: FederationLoadSource) => Promise<unknown>;
  refreshFederationRegistry: () => void;
}

export function createFederationWorkspaceRestorer({
  ctx,
  storedFederationWorkspace,
  fragmentId,
  apiBase,
  fetchExampleBlob,
  loadIfc,
  loadFragBuffer,
  refreshFederationRegistry,
}: FederationWorkspaceRestorerOptions) {
  return async function restoreFederationWorkspace() {
    if (!storedFederationWorkspace || fragmentId) return;
    const restorableModels = storedFederationWorkspace.models.filter((model) => model.source.restorable);
    if (restorableModels.length === 0) return;

    ctx.setStatus("Восстановление federation");
    try {
      for (const model of restorableModels) {
        if (model.source.kind === "ifc") {
          const blob = await fetchExampleBlob(model.source.reference);
          await loadIfc(new File([blob], model.source.label, { type: "application/octet-stream" }), model.source);
          continue;
        }

        const response = await fetch(`${apiBase}/fragments/${model.source.reference}/download`);
        if (!response.ok) throw new Error(`Не удалось восстановить fragment ${model.source.label}`);
        await loadFragBuffer(await response.arrayBuffer(), model.source.label, model.source);
      }
      refreshFederationRegistry();
      ctx.showToast(`Восстановлено моделей: ${restorableModels.length}`, "success");
    } catch (error) {
      ctx.showError(error);
    }
  };
}
