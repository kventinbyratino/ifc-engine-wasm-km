import type { LoadingElement } from "../types.ts";
import { requiredElement } from "./dom-helpers.ts";

export function getClashDom() {
  return {
    clashPanel: requiredElement<HTMLElement>("clashPanel"),
    clashSummary: requiredElement<HTMLElement>("clashSummary"),
    closeClashPanelBtn: requiredElement<HTMLButtonElement>("closeClashPanelBtn"),
    clashGroupASelect: requiredElement<HTMLSelectElement>("clashGroupASelect"),
    clashGroupBSelect: requiredElement<HTMLSelectElement>("clashGroupBSelect"),
    clashToleranceInput: requiredElement<HTMLInputElement>("clashToleranceInput"),
    runClashBtn: requiredElement<LoadingElement>("runClashBtn"),
    clearClashBtn: requiredElement<HTMLButtonElement>("clearClashBtn"),
    clashOutput: requiredElement<HTMLDivElement>("clashOutput"),
  };
}
