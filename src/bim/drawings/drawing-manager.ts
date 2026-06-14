import type { DrawingBuildOptions, DrawingRecord } from "./drawings-panel";
import {
  createTechnicalDrawing,
  disposeDrawing,
  fitCameraToDrawing,
  getDrawingSourceLabel,
  getDrawingViewLabel,
} from "./drawings-panel";

export type { DrawingBuildOptions, DrawingRecord };

export async function createFloorPlanDrawing(options: Omit<DrawingBuildOptions, "view">): Promise<DrawingRecord> {
  return createTechnicalDrawing({ ...options, view: "plan" });
}

export { createTechnicalDrawing, disposeDrawing, fitCameraToDrawing, getDrawingSourceLabel, getDrawingViewLabel };
