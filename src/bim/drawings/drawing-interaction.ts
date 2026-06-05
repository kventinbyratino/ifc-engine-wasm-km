import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { addDrawingAnnotation, type DrawingAnnotationType } from "./drawing-annotations";
import type { DrawingRecord } from "./drawings-panel";

export type DrawingInteractionController = {
  active: boolean;
  setActive(value: boolean): void;
  dispose(): void;
};

export function createDrawingInteractionController(options: {
  viewport: HTMLElement;
  world: OBC.World;
  components: OBC.Components;
  getActiveDrawing: () => DrawingRecord | null;
  getAnnotationType: () => DrawingAnnotationType;
  getAnnotationText: () => string;
  onAnnotationAdded: (record: DrawingRecord) => void;
  onStatus: (message: string) => void;
}): DrawingInteractionController {
  let active = false;
  const raycaster = new THREE.Raycaster();

  const setActive = (value: boolean) => {
    active = value;
    options.viewport.classList.toggle("is-drawing-annotation-mode", active);
    options.onStatus(active ? "Интерактивные аннотации: кликните по линии/чертежу" : "Интерактивные аннотации выключены");
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!active || event.button !== 0) return;
    const record = options.getActiveDrawing();
    if (!record) {
      options.onStatus("Сначала сгенерируйте чертёж");
      return;
    }

    const hit = pickDrawingPoint(event, options.viewport, options.world, record, raycaster);
    if (!hit) {
      options.onStatus("Клик не попал в плоскость чертежа");
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const annotation = addDrawingAnnotation(record, {
      components: options.components,
      type: options.getAnnotationType(),
      text: options.getAnnotationText(),
      point: hit.point,
      line: hit.line,
    });
    options.onAnnotationAdded(record);
    options.onStatus(`${annotation.text} добавлена интерактивно`);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape" && active) setActive(false);
  };

  options.viewport.addEventListener("pointerdown", onPointerDown, { capture: true });
  window.addEventListener("keydown", onKeyDown);

  return {
    get active() {
      return active;
    },
    setActive,
    dispose() {
      options.viewport.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}

function pickDrawingPoint(
  event: PointerEvent,
  viewportElement: HTMLElement,
  world: OBC.World,
  record: DrawingRecord,
  raycaster: THREE.Raycaster,
) {
  const rect = viewportElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1),
  );
  raycaster.setFromCamera(ndc, world.camera.three);

  const hit = record.drawing.raycast(raycaster.ray, record.viewport ?? null);
  if (hit) return { point: hit.point.clone(), line: hit.line ? hit.line.clone() : null };

  const inverse = new THREE.Matrix4().copy(record.drawing.three.matrixWorld).invert();
  const localRay = new THREE.Ray(
    raycaster.ray.origin.clone().applyMatrix4(inverse),
    raycaster.ray.direction.clone().transformDirection(inverse).normalize(),
  );
  const point = localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!point) return null;
  return { point, line: null };
}
