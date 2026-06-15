import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

export type ModelLike = {
  object?: THREE.Object3D;
  useCamera?: (camera: THREE.Camera) => void;
  modelId?: string;
};

export type MaterialLike = {
  opacity?: number;
  transparent?: boolean;
  needsUpdate?: boolean;
  isLodMaterial?: boolean;
};

export type BimViewerContext = Awaited<ReturnType<typeof createBimViewer>>;

export const searchHighlightStyle = {
  color: new THREE.Color("#18b86f"),
  opacity: 1,
  transparent: false,
  renderedFaces: 0,
};

export const dimHighlightStyle = {
  color: new THREE.Color("#9aa6af"),
  opacity: 0.2,
  transparent: true,
  renderedFaces: 0,
};

export function applyModelVisibility(model: ModelLike | null | undefined, visible: boolean) {
  if (!model?.object) return;
  model.object.visible = visible;
}

export function applyModelOpacity(model: ModelLike | null | undefined, opacity: number) {
  if (!model?.object) return;
  const normalized = Math.max(0, Math.min(1, opacity));
  model.object.traverse((child) => {
    const candidate = child as THREE.Mesh & { material?: MaterialLike | MaterialLike[] };
    const materials = candidate.material;
    if (!materials) return;
    for (const material of Array.isArray(materials) ? materials : [materials]) {
      if (typeof material.opacity === "number") material.opacity = normalized;
      if (typeof material.transparent === "boolean") material.transparent = normalized < 1;
      if (typeof material.needsUpdate === "boolean") material.needsUpdate = true;
    }
  });
}

export async function createBimViewer(options: {
  viewport: HTMLDivElement;
  workerUrl: string;
  appBase: string;
}) {
  BUI.Manager.init();
  CUI.Manager.init();

  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBF.PostproductionRenderer
  >();

  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = new THREE.Color("#f3f5f8");
  world.renderer = new OBF.PostproductionRenderer(components, options.viewport);
  world.camera = new OBC.OrthoPerspectiveCamera(components);
  await world.camera.controls.setLookAt(24, 18, 24, 0, 0, 0);

  components.init();
  components.get(OBC.Grids).create(world);
  components.get(OBC.Raycasters).get(world);

  const fragments = components.get(OBC.FragmentsManager);
  const fragmentsWorkerUrl = await createFragmentsWorkerUrl(options.workerUrl);
  fragments.init(fragmentsWorkerUrl);

  const ifcLoader = components.get(OBC.IfcLoader);
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: `${options.appBase}/web-ifc/`,
      absolute: true,
    },
  });

  const highlighter = components.get(OBF.Highlighter);
  highlighter.setup({
    world,
    selectMaterialDefinition: {
      color: new THREE.Color("#00a7b5"),
      opacity: 0.95,
      transparent: false,
      renderedFaces: 0,
    },
  });

  const hider = components.get(OBC.Hider);

  return { components, world, fragments, ifcLoader, highlighter, hider };
}

async function createFragmentsWorkerUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не удалось загрузить worker fragments");
  const workerBlob = await response.blob();
  const workerFile = new File([workerBlob], "worker.mjs", { type: "text/javascript" });
  return URL.createObjectURL(workerFile);
}
