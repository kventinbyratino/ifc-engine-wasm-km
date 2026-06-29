import type { BimViewerContext as KmViewerContext, MaterialLike, ModelLike } from "../../bim/viewer/viewer.ts";
import { applyModelOpacity, applyModelVisibility, createBimViewer, getViewerCameraQuery, searchHighlightStyle, dimHighlightStyle } from "../../bim/viewer/viewer.ts";
import { loadFragBuffer as loadKmFragBuffer, loadIfcModel as loadKmIfcModel } from "../../bim/models/model-loader.ts";
import { bindKmViewerLoaders } from "./loaders.ts";

export {
  applyModelOpacity,
  applyModelVisibility,
  getViewerCameraQuery,
  searchHighlightStyle,
  dimHighlightStyle,
  type KmViewerContext,
  type MaterialLike,
  type ModelLike,
};

export const createKmViewer = createBimViewer;
export const loadIfcModel = loadKmIfcModel;
export const loadFragBuffer = loadKmFragBuffer;

export type KmViewerLoaders = ReturnType<typeof bindKmViewerLoaders>;
export type KmViewerCore = Awaited<ReturnType<typeof createKmViewerCore>>;

export async function createKmViewerCore(options: Parameters<typeof createKmViewer>[0]) {
  const viewer = await createKmViewer(options);
  return {
    viewer,
    ...bindKmViewerLoaders(viewer),
  };
}
