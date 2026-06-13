import * as THREE from "three";
import * as OBC from "@thatopen/components";
import type { DrawingDocument, SheetDocument } from "./drawing-document";
import type { DrawingSource, DrawingView } from "./drawing-types";
import type { SheetFormat } from "../sheets/sheet-types";
import { serializeModelIdMap } from "./drawing-selection-sync";

export const DRAWING_STORAGE_KEY = "bim-real-drawings-mvp:v2";
export const DRAWING_STORAGE_SCHEMA_VERSION = 3;

export type StoredDrawingAnnotation =
  | { system: "linear"; pointA: [number, number, number]; pointB: [number, number, number]; offset: number; style: string }
  | { system: "leader"; arrowTip: [number, number, number]; elbow: [number, number, number]; extensionEnd: [number, number, number]; text: string; style: string }
  | { system: "callout"; center: [number, number, number]; halfW: number; halfH: number; elbow: [number, number, number]; extensionEnd: [number, number, number]; text: string; style: string };

export type StoredDrawingRecord = {
  id: string;
  name: string;
  view: DrawingView;
  source: DrawingSource;
  far: number;
  itemCount: number;
  lineCount: number;
  projection: {
    far: number;
    scale: number;
    bounds: OBC.DrawingViewportConfig;
  };
  createdAt: string;
  sourceModelIdMap: Array<[string, number[]]>;
  annotations: StoredDrawingAnnotation[];
};

export type StoredSheetRecord = {
  id: string;
  format: SheetFormat;
  title: string;
  projectName: string;
  drawingId: string;
  createdAt: string;
};

export type StoredDrawingWorkspace = {
  schemaVersion: number;
  projectName: string;
  savedAt: string;
  drawings: StoredDrawingRecord[];
  sheets: StoredSheetRecord[];
};

export function saveDrawingWorkspace(projectName: string, drawings: DrawingDocument[], sheets: SheetDocument[], components: OBC.Components) {
  const payload: StoredDrawingWorkspace = {
    schemaVersion: DRAWING_STORAGE_SCHEMA_VERSION,
    projectName,
    savedAt: new Date().toISOString(),
    drawings: drawings.map((drawing) => serializeDrawing(drawing, components)),
    sheets: sheets.map((sheet) => ({
      id: sheet.id,
      format: sheet.format,
      title: sheet.title,
      projectName: sheet.projectName,
      drawingId: sheet.drawing.id,
      createdAt: sheet.createdAt.toISOString(),
    })),
  };
  localStorage.setItem(DRAWING_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function loadStoredDrawingWorkspace(projectName: string) {
  const raw = localStorage.getItem(DRAWING_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeStoredWorkspace(parsed, projectName);
  } catch (error) {
    console.warn("Drawing persistence parse failed", error);
    return null;
  }
}

export function clearStoredDrawingWorkspace() {
  localStorage.removeItem(DRAWING_STORAGE_KEY);
}

export function replayStoredAnnotations(record: DrawingDocument, annotations: StoredDrawingAnnotation[], components: OBC.Components) {
  const techDrawings = components.get(OBC.TechnicalDrawings);
  for (const annotation of annotations) {
    if (annotation.system === "linear") {
      techDrawings.use(OBC.LinearAnnotations).add(record.drawing, {
        pointA: toVector(annotation.pointA),
        pointB: toVector(annotation.pointB),
        offset: annotation.offset,
        style: annotation.style,
      });
    } else if (annotation.system === "leader") {
      techDrawings.use(OBC.LeaderAnnotations).add(record.drawing, {
        arrowTip: toVector(annotation.arrowTip),
        elbow: toVector(annotation.elbow),
        extensionEnd: toVector(annotation.extensionEnd),
        text: annotation.text,
        style: annotation.style,
      });
    } else {
      techDrawings.use(OBC.CalloutAnnotations).add(record.drawing, {
        center: toVector(annotation.center),
        halfW: annotation.halfW,
        halfH: annotation.halfH,
        elbow: toVector(annotation.elbow),
        extensionEnd: toVector(annotation.extensionEnd),
        text: annotation.text,
        style: annotation.style,
      });
    }
  }
}

function serializeDrawing(record: DrawingDocument, components: OBC.Components): StoredDrawingRecord {
  const techDrawings = components.get(OBC.TechnicalDrawings);
  const linear = techDrawings.use(OBC.LinearAnnotations);
  const leader = techDrawings.use(OBC.LeaderAnnotations);
  const callout = techDrawings.use(OBC.CalloutAnnotations);
  const annotations: StoredDrawingAnnotation[] = [];

  for (const [, item] of record.drawing.annotations.getBySystem(linear)) {
    annotations.push({
      system: "linear",
      pointA: fromVector(item.pointA),
      pointB: fromVector(item.pointB),
      offset: item.offset,
      style: item.style,
    });
  }
  for (const [, item] of record.drawing.annotations.getBySystem(leader)) {
    annotations.push({
      system: "leader",
      arrowTip: fromVector(item.arrowTip),
      elbow: fromVector(item.elbow),
      extensionEnd: fromVector(item.extensionEnd),
      text: item.text,
      style: item.style,
    });
  }
  for (const [, item] of record.drawing.annotations.getBySystem(callout)) {
    annotations.push({
      system: "callout",
      center: fromVector(item.center),
      halfW: item.halfW,
      halfH: item.halfH,
      elbow: fromVector(item.elbow),
      extensionEnd: fromVector(item.extensionEnd),
      text: item.text,
      style: item.style,
    });
  }

  return {
    id: record.id,
    name: record.name,
    view: record.view,
    source: record.source,
    far: record.projection.far,
    itemCount: record.itemCount,
    lineCount: record.lineCount,
    projection: {
      far: record.projection.far,
      scale: record.projection.scale,
      bounds: { ...record.projection.bounds },
    },
    createdAt: record.createdAt.toISOString(),
    sourceModelIdMap: serializeModelIdMap(record.sourceModelIdMap),
    annotations,
  };
}

function normalizeStoredWorkspace(raw: unknown, projectName: string): StoredDrawingWorkspace | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.projectName !== "string" || raw.projectName !== projectName) return null;

  const drawings = Array.isArray(raw.drawings)
    ? raw.drawings.filter(isRecord).map(normalizeStoredDrawingRecord).filter((drawing): drawing is StoredDrawingRecord => drawing !== null)
    : [];
  const sheets = Array.isArray(raw.sheets)
    ? raw.sheets.filter(isRecord).map(normalizeStoredSheetRecord).filter((sheet): sheet is StoredSheetRecord => sheet !== null)
    : [];

  return {
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : DRAWING_STORAGE_SCHEMA_VERSION,
    projectName,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
    drawings,
    sheets,
  };
}

function normalizeStoredDrawingRecord(raw: Record<string, unknown>): StoredDrawingRecord | null {
  if (typeof raw.id !== "string" || typeof raw.name !== "string" || typeof raw.view !== "string" || typeof raw.source !== "string") return null;
  if (typeof raw.far !== "number" || typeof raw.itemCount !== "number" || typeof raw.lineCount !== "number") return null;
  if (!isRecord(raw.projection) || typeof raw.projection.far !== "number" || typeof raw.projection.scale !== "number" || !isRecord(raw.projection.bounds)) return null;
  if (typeof raw.createdAt !== "string") return null;

  const annotations = Array.isArray(raw.annotations)
    ? raw.annotations.filter(isRecord).map(normalizeStoredAnnotation).filter((annotation): annotation is StoredDrawingAnnotation => annotation !== null)
    : [];

  return {
    id: raw.id,
    name: raw.name,
    view: raw.view as DrawingView,
    source: raw.source as DrawingSource,
    far: raw.far,
    itemCount: raw.itemCount,
    lineCount: raw.lineCount,
    projection: {
      far: raw.projection.far,
      scale: raw.projection.scale,
      bounds: normalizeViewportBounds(raw.projection.bounds),
    },
    createdAt: raw.createdAt,
    sourceModelIdMap: normalizeStoredModelIdMapEntries(raw.sourceModelIdMap),
    annotations,
  };
}

function normalizeStoredSheetRecord(raw: Record<string, unknown>): StoredSheetRecord | null {
  if (typeof raw.id !== "string" || typeof raw.title !== "string" || typeof raw.projectName !== "string" || typeof raw.drawingId !== "string") return null;
  if (typeof raw.format !== "string" || typeof raw.createdAt !== "string") return null;
  return {
    id: raw.id,
    format: raw.format as SheetFormat,
    title: raw.title,
    projectName: raw.projectName,
    drawingId: raw.drawingId,
    createdAt: raw.createdAt,
  };
}

function normalizeStoredAnnotation(raw: Record<string, unknown>): StoredDrawingAnnotation | null {
  if (raw.system === "linear") {
    if (!isVectorTuple(raw.pointA) || !isVectorTuple(raw.pointB) || typeof raw.offset !== "number" || typeof raw.style !== "string") return null;
    return { system: "linear", pointA: raw.pointA, pointB: raw.pointB, offset: raw.offset, style: raw.style };
  }

  if (raw.system === "leader") {
    if (!isVectorTuple(raw.arrowTip) || !isVectorTuple(raw.elbow) || !isVectorTuple(raw.extensionEnd) || typeof raw.text !== "string" || typeof raw.style !== "string") return null;
    return { system: "leader", arrowTip: raw.arrowTip, elbow: raw.elbow, extensionEnd: raw.extensionEnd, text: raw.text, style: raw.style };
  }

  if (raw.system === "callout") {
    if (!isVectorTuple(raw.center) || !isVectorTuple(raw.elbow) || !isVectorTuple(raw.extensionEnd) || typeof raw.halfW !== "number" || typeof raw.halfH !== "number" || typeof raw.text !== "string" || typeof raw.style !== "string") return null;
    return { system: "callout", center: raw.center, halfW: raw.halfW, halfH: raw.halfH, elbow: raw.elbow, extensionEnd: raw.extensionEnd, text: raw.text, style: raw.style };
  }

  return null;
}

function normalizeStoredModelIdMapEntries(raw: unknown): Array<[string, number[]]> {
  if (!Array.isArray(raw)) return [];
  const result: Array<[string, number[]]> = [];

  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [modelId, ids] = entry as [unknown, unknown];
    if (typeof modelId !== "string" || !Array.isArray(ids)) continue;
    const validIds = ids.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    result.push([modelId, [...new Set(validIds)].sort((a, b) => a - b)]);
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVectorTuple(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

function normalizeViewportBounds(raw: unknown): OBC.DrawingViewportConfig {
  if (!isRecord(raw)) {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }

  return {
    left: typeof raw.left === "number" ? raw.left : 0,
    right: typeof raw.right === "number" ? raw.right : 0,
    top: typeof raw.top === "number" ? raw.top : 0,
    bottom: typeof raw.bottom === "number" ? raw.bottom : 0,
  };
}

function fromVector(value: THREE.Vector3): [number, number, number] {
  return [round(value.x), round(value.y), round(value.z)];
}

function toVector(value: [number, number, number]) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function round(value: number) {
  return Number(value.toFixed(6));
}
