import type { LoadingElement } from "../types";
import { requiredElement } from "./dom-helpers";

export function getDrawingsDom() {
  return {
    drawingsPanel: requiredElement<HTMLElement>("drawingsPanel"),
    drawingsSummary: requiredElement<HTMLElement>("drawingsSummary"),
    closeDrawingsPanelBtn: requiredElement<HTMLButtonElement>("closeDrawingsPanelBtn"),
    drawingSourceSelect: requiredElement<HTMLSelectElement>("drawingSourceSelect"),
    drawingViewSelect: requiredElement<HTMLSelectElement>("drawingViewSelect"),
    drawingFarInput: requiredElement<HTMLInputElement>("drawingFarInput"),
    sheetFormatSelect: requiredElement<HTMLSelectElement>("sheetFormatSelect"),
    annotationTypeSelect: requiredElement<HTMLSelectElement>("annotationTypeSelect"),
    annotationTextInput: requiredElement<HTMLInputElement>("annotationTextInput"),
    addAnnotationBtn: requiredElement<LoadingElement>("addAnnotationBtn"),
    interactiveAnnotationBtn: requiredElement<HTMLButtonElement>("interactiveAnnotationBtn"),
    clearAnnotationsBtn: requiredElement<HTMLButtonElement>("clearAnnotationsBtn"),
    createSheetBtn: requiredElement<LoadingElement>("createSheetBtn"),
    placeSpecsBtn: requiredElement<HTMLButtonElement>("placeSpecsBtn"),
    exportSheetSvgBtn: requiredElement<HTMLButtonElement>("exportSheetSvgBtn"),
    exportSheetPngBtn: requiredElement<LoadingElement>("exportSheetPngBtn"),
    exportSheetPdfBtn: requiredElement<HTMLButtonElement>("exportSheetPdfBtn"),
    exportSheetDxfBtn: requiredElement<HTMLButtonElement>("exportSheetDxfBtn"),
    exportSpecsBtn: requiredElement<HTMLButtonElement>("exportSpecsBtn"),
    generateDrawingBtn: requiredElement<LoadingElement>("generateDrawingBtn"),
    drawingStudioBtn: requiredElement<HTMLButtonElement>("drawingStudioBtn"),
    clearDrawingsBtn: requiredElement<HTMLButtonElement>("clearDrawingsBtn"),
    drawingPreview: requiredElement<HTMLDivElement>("drawingPreview"),
    drawingsOutput: requiredElement<HTMLDivElement>("drawingsOutput"),
  };
}
