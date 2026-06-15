import type { FederationLoadSource, FederationLoadKind, FederationLoadOrigin } from "../federation/federation-registry.ts";

export function createModelId(name: string) {
  const clean = name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${clean || "model"}_${suffix}`;
}

export async function loadIfcModel(options: {
  file: File;
  ifcLoader: any;
  onProgress: (value: number, process: string) => void;
  source?: Partial<FederationLoadSource> & { kind?: FederationLoadKind };
}) {
  const { file, ifcLoader, onProgress } = options;
  const buffer = new Uint8Array(await file.arrayBuffer());
  const modelId = createModelId(file.name);
  const source = normalizeLoadSource({
    kind: "ifc",
    label: file.name,
    reference: file.name,
    origin: "upload",
    restorable: false,
    ...options.source,
  });

  const loadingModel = ifcLoader.load(buffer, true, modelId, {
    userData: {
      sourceName: file.name,
      sourceType: "ifc",
      federationSource: source,
    },
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

  return { modelId, sourceName: file.name, source };
}

export async function loadFragBuffer(options: {
  buffer: ArrayBuffer;
  name: string;
  fragments: any;
  camera: unknown;
  onProgress: (value: number, stage: string) => void;
  source?: Partial<FederationLoadSource> & { kind?: FederationLoadKind };
}) {
  const { buffer, name, fragments, camera, onProgress } = options;
  const modelId = createModelId(name);
  const source = normalizeLoadSource({
    kind: "frag",
    label: name,
    reference: name,
    origin: "upload",
    restorable: false,
    ...options.source,
  });
  const loadingModel = fragments.core.load(buffer, {
    modelId,
    camera,
    raw: true,
    userData: {
      sourceName: name,
      sourceType: "frag",
      federationSource: source,
    },
    onProgress: (event: { stage: string; progress: number }) => {
      const value = event.stage === "done" ? 1 : event.progress;
      onProgress(value, event.stage);
    },
  });
  loadingModel.catch((error: unknown) => console.error(error));
  await loadingModel;
  await fragments.core.update(true);

  return { modelId, sourceName: name, source };
}

function normalizeLoadSource(source: Partial<FederationLoadSource> & { kind: FederationLoadKind; label: string; reference: string; origin?: FederationLoadOrigin; restorable?: boolean }): FederationLoadSource {
  return {
    kind: source.kind,
    origin: source.origin ?? "upload",
    label: source.label,
    reference: source.reference,
    restorable: source.restorable ?? false,
  };
}
