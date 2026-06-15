import {
  removeFederationModel as removeFederationModelFromState,
  setFederationModelOpacity,
  setFederationModelVisibility,
  type FederationModelRecord,
  type FederationRegistryState,
  noteFederationAction as noteFederationActionInState,
} from "./federation-registry.ts";

export function getFederationModelById(state: FederationRegistryState, modelId: string) {
  return state.models.find((model) => model.modelId === modelId) ?? null;
}

export function toggleFederationModelVisibility(state: FederationRegistryState, modelId: string) {
  const model = getFederationModelById(state, modelId);
  if (!model) return;
  setFederationModelVisibility(state, modelId, !model.visible);
}

export function isolateFederationModel(state: FederationRegistryState, modelId: string) {
  for (const model of state.models) {
    setFederationModelVisibility(state, model.modelId, model.modelId === modelId);
  }
}

export function restoreFederationVisibility(state: FederationRegistryState) {
  for (const model of state.models) {
    setFederationModelVisibility(state, model.modelId, true);
  }
}

export function updateFederationModelOpacity(state: FederationRegistryState, modelId: string, opacity: number) {
  setFederationModelOpacity(state, modelId, opacity);
}

export function removeFederationModel(state: FederationRegistryState, modelId: string) {
  removeFederationModelFromState(state, modelId);
}

export function noteFederationAction(state: FederationRegistryState, action: string) {
  noteFederationActionInState(state, action);
}

export function cloneFederationModels(models: FederationModelRecord[]) {
  return models.map((model) => ({ ...model, source: { ...model.source } }));
}
