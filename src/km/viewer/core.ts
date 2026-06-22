export {
  applyModelOpacity,
  applyModelVisibility,
  createBimViewer as createKmViewer,
  getViewerCameraQuery,
  searchHighlightStyle,
  dimHighlightStyle,
  type BimViewerContext as KmViewerContext,
  type MaterialLike,
  type ModelLike,
} from "../../bim/viewer/viewer.ts";

export { loadIfcModel, loadFragBuffer } from "../../bim/models/model-loader.ts";
