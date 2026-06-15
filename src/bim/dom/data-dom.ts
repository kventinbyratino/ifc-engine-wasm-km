import type { LoadingElement } from "../types.ts";
import { requiredElement } from "./dom-helpers.ts";

export function getDataDom() {
  return {
    dataPanel: requiredElement<HTMLElement>("dataPanel"),
    dataSummary: requiredElement<HTMLElement>("dataSummary"),
    closeDataPanelBtn: requiredElement<HTMLButtonElement>("closeDataPanelBtn"),
    dataSearchInput: requiredElement<HTMLInputElement>("dataSearchInput"),
    dataCategoryFilter: requiredElement<HTMLSelectElement>("dataCategoryFilter"),
    dataStoreyFilter: requiredElement<HTMLSelectElement>("dataStoreyFilter"),
    highlightFilteredBtn: requiredElement<LoadingElement>("highlightFilteredBtn"),
    exportCsvBtn: requiredElement<HTMLButtonElement>("exportCsvBtn"),
    exportJsonBtn: requiredElement<HTMLButtonElement>("exportJsonBtn"),
    exportIfcBtn: requiredElement<HTMLButtonElement>("exportIfcBtn"),
    dataTableOutput: requiredElement<HTMLDivElement>("dataTableOutput"),
  };
}
