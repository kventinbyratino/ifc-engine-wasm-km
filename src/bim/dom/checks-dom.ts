import type { LoadingElement } from "../types";
import { requiredElement } from "./dom-helpers";

export function getChecksDom() {
  return {
    checksPanel: requiredElement<HTMLElement>("checksPanel"),
    checksSummary: requiredElement<HTMLElement>("checksSummary"),
    closeChecksPanelBtn: requiredElement<HTMLButtonElement>("closeChecksPanelBtn"),
    runChecksBtn: requiredElement<LoadingElement>("runChecksBtn"),
    idsFileInput: requiredElement<HTMLInputElement>("idsFileInput"),
    idsTitleInput: requiredElement<HTMLInputElement>("idsTitleInput"),
    idsSpecNameInput: requiredElement<HTMLInputElement>("idsSpecNameInput"),
    idsEntityInput: requiredElement<HTMLInputElement>("idsEntityInput"),
    idsPsetInput: requiredElement<HTMLInputElement>("idsPsetInput"),
    idsPropertyInput: requiredElement<HTMLInputElement>("idsPropertyInput"),
    addIdsRequirementBtn: requiredElement<HTMLButtonElement>("addIdsRequirementBtn"),
    saveIdsBtn: requiredElement<HTMLButtonElement>("saveIdsBtn"),
    exportChecksCsvBtn: requiredElement<HTMLButtonElement>("exportChecksCsvBtn"),
    exportChecksJsonBtn: requiredElement<HTMLButtonElement>("exportChecksJsonBtn"),
    checksOutput: requiredElement<HTMLDivElement>("checksOutput"),
  };
}
