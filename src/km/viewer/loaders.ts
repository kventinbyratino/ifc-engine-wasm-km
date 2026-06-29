import type { BimViewerContext as KmViewerContext } from "../../bim/viewer/viewer.ts";
import { loadFragBuffer as loadKmFragBuffer, loadIfcModel as loadKmIfcModel } from "../../bim/models/model-loader.ts";

export type KmViewerLoaderAdapters = {
  loadIfcModel?: typeof loadKmIfcModel;
  loadFragBuffer?: typeof loadKmFragBuffer;
};

export function bindKmViewerLoaders(
  viewer: Pick<KmViewerContext, "ifcLoader" | "fragments" | "world">,
  adapters: Required<KmViewerLoaderAdapters> = {
    loadIfcModel: loadKmIfcModel,
    loadFragBuffer: loadKmFragBuffer,
  },
) {
  return {
    loadIfcModel: (options: Omit<Parameters<typeof loadKmIfcModel>[0], "ifcLoader">) =>
      adapters.loadIfcModel({
        ...options,
        ifcLoader: viewer.ifcLoader,
      }),
    loadFragBuffer: (options: Omit<Parameters<typeof loadKmFragBuffer>[0], "fragments" | "camera">) =>
      adapters.loadFragBuffer({
        ...options,
        fragments: viewer.fragments,
        camera: viewer.world.camera,
      }),
  };
}
