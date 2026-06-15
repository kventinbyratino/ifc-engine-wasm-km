import type { DrawingBuildOptions, DrawingRecord } from "./drawings-panel.ts";
import {
  createTechnicalDrawing,
  disposeDrawing,
  fitCameraToDrawing,
  getDrawingSourceLabel,
  getDrawingViewLabel,
} from "./drawings-panel.ts";

export type { DrawingBuildOptions, DrawingRecord };

export async function createFloorPlanDrawing(options: Omit<DrawingBuildOptions, "view">): Promise<DrawingRecord> {
  return createTechnicalDrawing({ ...options, view: "plan" });
}

export { createTechnicalDrawing, disposeDrawing, fitCameraToDrawing, getDrawingSourceLabel, getDrawingViewLabel };
