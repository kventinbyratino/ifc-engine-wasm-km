import type * as OBC from "@thatopen/components";
import type { DrawingAnnotation } from "./drawing-annotations.ts";
import type { DrawingProjection, DrawingSource, DrawingView } from "./drawing-types.ts";
import type { SheetFormat, SheetSpecBlock } from "../sheets/sheet-types.ts";
import type { SheetViewportFrame } from "../sheets/sheet-viewport-frame.ts";
import type { ModelIdMap } from "../types.ts";
import { cloneModelIdMap } from "./drawing-selection-sync.ts";

export interface DrawingDocument {
  id: string;
  name: string;
  view: DrawingView;
  source: DrawingSource;
  itemCount: number;
  lineCount: number;
  annotations: DrawingAnnotation[];
  createdAt: Date;
  drawing: OBC.TechnicalDrawing;
  viewport: OBC.DrawingViewport | null;
  projection: DrawingProjection;
  sourceModelIdMap: ModelIdMap;
  sheets: SheetDocument[];
}

export interface SheetDocument {
  id: string;
  format: SheetFormat;
  title: string;
  projectName: string;
  drawing: DrawingDocument;
  createdAt: Date;
  specBlocks: SheetSpecBlock[];
  viewportFrame: SheetViewportFrame;
}

export function createDrawingDocument(document: Omit<DrawingDocument, "sheets"> & { sheets?: SheetDocument[] }): DrawingDocument {
  return {
    ...document,
    sourceModelIdMap: cloneModelIdMap(document.sourceModelIdMap),
    sheets: document.sheets ? [...document.sheets] : [],
  };
}

export function createSheetDocument(options: {
  format: SheetFormat;
  drawing: DrawingDocument;
  projectName?: string;
  title?: string;
  id?: string;
  createdAt?: Date;
  specBlocks?: SheetSpecBlock[];
  viewportFrame?: SheetViewportFrame;
}): SheetDocument {
  return {
    id: options.id || `sheet-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    format: options.format,
    title: options.title || options.drawing.name,
    projectName: options.projectName || "BIM Manager Workbench",
    drawing: options.drawing,
    createdAt: options.createdAt || new Date(),
    specBlocks: options.specBlocks ? [...options.specBlocks] : [],
    viewportFrame: options.viewportFrame ? { ...options.viewportFrame } : { x: 0, y: 0, width: 0, height: 0 },
  };
}

export function attachSheetDocument(drawing: DrawingDocument, sheet: SheetDocument) {
  if (!drawing.sheets.some((item) => item.id === sheet.id)) drawing.sheets.unshift(sheet);
  return drawing.sheets;
}

export function removeSheetDocumentsForDrawing(drawing: DrawingDocument) {
  drawing.sheets = [];
}

export function replaceDrawingAnnotations(drawing: DrawingDocument, annotations: DrawingAnnotation[]) {
  drawing.annotations = [...annotations];
  return drawing.annotations;
}

export function getDrawingDocumentStats(drawings: DrawingDocument[]) {
  const totalLines = drawings.reduce((sum, record) => sum + record.lineCount, 0);
  const totalAnnotations = drawings.reduce((sum, record) => sum + record.annotations.length, 0);
  const totalSheets = drawings.reduce((sum, record) => sum + record.sheets.length, 0);
  return {
    drawingCount: drawings.length,
    sheetCount: totalSheets,
    totalLines,
    totalAnnotations,
  };
}
