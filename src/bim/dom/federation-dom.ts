import { requiredElement } from "./dom-helpers.ts";

export function getFederationDom() {
  return {
    federationBtn: requiredElement<HTMLButtonElement>("federationBtn"),
    federationPanel: requiredElement<HTMLElement>("federationPanel"),
    closeFederationPanelBtn: requiredElement<HTMLButtonElement>("closeFederationPanelBtn"),
    federationSummary: requiredElement<HTMLElement>("federationSummary"),
    federationOutput: requiredElement<HTMLDivElement>("federationOutput"),
  };
}
