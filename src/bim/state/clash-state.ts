import type { ClashRecord } from "../clash/clash-types";

export type ClashWorkspaceState = {
  clashes: ClashRecord[];
};

export function createClashState(): ClashWorkspaceState {
  return {
    clashes: [],
  };
}

export function getClashCount(clashState: ClashWorkspaceState) {
  return clashState.clashes.length;
}
