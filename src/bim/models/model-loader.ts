export function createModelId(name: string) {
  const clean = name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${clean || "model"}_${suffix}`;
}

export async function loadIfcModel(options: {
  file: File;
  ifcLoader: any;
  onProgress: (value: number, process: string) => void;
}) {
  const { file, ifcLoader, onProgress } = options;
  const buffer = new Uint8Array(await file.arrayBuffer());
  const modelId = createModelId(file.name);

  const loadingModel = ifcLoader.load(buffer, true, modelId, {
    userData: { sourceName: file.name, sourceType: "ifc" },
    instanceCallback: (importer: { addAllAttributes: () => void; addAllRelations: () => void }) => {
      importer.addAllAttributes();
      importer.addAllRelations();
    },
    processData: {
      progressCallback: (value: number, data: { process: string }) => {
        onProgress(value, data.process);
      },
    },
  });
  loadingModel.catch((error: unknown) => console.error(error));
  await loadingModel;

  return { modelId, sourceName: file.name };
}

export async function loadFragBuffer(options: {
  buffer: ArrayBuffer;
  name: string;
  fragments: any;
  camera: unknown;
  onProgress: (value: number, stage: string) => void;
}) {
  const { buffer, name, fragments, camera, onProgress } = options;
  const modelId = createModelId(name);
  const loadingModel = fragments.core.load(buffer, {
    modelId,
    camera,
    raw: true,
    userData: { sourceName: name, sourceType: "frag" },
    onProgress: (event: { stage: string; progress: number }) => {
      const value = event.stage === "done" ? 1 : event.progress;
      onProgress(value, event.stage);
    },
  });
  loadingModel.catch((error: unknown) => console.error(error));
  await loadingModel;
  await fragments.core.update(true);

  return { modelId, sourceName: name };
}
