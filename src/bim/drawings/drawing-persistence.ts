import * as THREE from "three";
import * as OBC from "@thatopen/components";
import type { DrawingRecord, DrawingSource, DrawingView } from "./drawings-panel";
import type { SheetFormat, SheetRecord } from "../sheets/sheet-types";

export const DRAWING_STORAGE_KEY = "bim-real-drawings-mvp:v1";

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
  projectName: string;
  savedAt: string;
  drawings: StoredDrawingRecord[];
  sheets: StoredSheetRecord[];
};

export function saveDrawingWorkspace(projectName: string, drawings: DrawingRecord[], sheets: SheetRecord[], components: OBC.Components) {
  const payload: StoredDrawingWorkspace = {
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
  const parsed = JSON.parse(raw) as StoredDrawingWorkspace;
  return parsed.projectName === projectName ? parsed : null;
}

export function clearStoredDrawingWorkspace() {
  localStorage.removeItem(DRAWING_STORAGE_KEY);
}

export function replayStoredAnnotations(record: DrawingRecord, annotations: StoredDrawingAnnotation[], components: OBC.Components) {
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

function serializeDrawing(record: DrawingRecord, components: OBC.Components): StoredDrawingRecord {
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
    annotations,
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
