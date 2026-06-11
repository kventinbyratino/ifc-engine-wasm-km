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
  let pendingDimensionPoint: THREE.Vector3 | null = null;
  const raycaster = new THREE.Raycaster();

  const setActive = (value: boolean) => {
    active = value;
    if (!active) pendingDimensionPoint = null;
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

    const annotationType = options.getAnnotationType();
    if (annotationType === "linear" && !hit.line) {
      const point = snapPoint(hit.point, record);
      if (!pendingDimensionPoint) {
        pendingDimensionPoint = point;
        options.onStatus("Первая точка размера выбрана. Кликните вторую точку.");
        return;
      }
      hit.line = new THREE.Line3(pendingDimensionPoint, point);
      hit.point = pendingDimensionPoint.clone().lerp(point, 0.5);
      pendingDimensionPoint = null;
    }

    const annotation = addDrawingAnnotation(record, {
      components: options.components,
      type: annotationType,
      text: options.getAnnotationText(),
      point: snapPoint(hit.point, record),
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
  if (hit) return { point: snapToLine(hit.point.clone(), hit.line), line: hit.line ? hit.line.clone() : null };

  const inverse = new THREE.Matrix4().copy(record.drawing.three.matrixWorld).invert();
  const localRay = new THREE.Ray(
    raycaster.ray.origin.clone().applyMatrix4(inverse),
    raycaster.ray.direction.clone().transformDirection(inverse).normalize(),
  );
  const point = localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!point) return null;
  return { point, line: null };
}

function snapPoint(point: THREE.Vector3, record: DrawingRecord) {
  const threshold = estimateSnapThreshold(record);
  let nearest = point.clone();
  let nearestDistance = threshold;
  record.drawing.three.updateWorldMatrix(true, true);
  record.drawing.three.traverse((object) => {
    if (!(object instanceof THREE.LineSegments)) return;
    const position = object.geometry.getAttribute("position");
    for (let index = 0; index < position.count; index++) {
      const candidate = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      const distance = candidate.distanceTo(point);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
  });
  return nearest;
}

function snapToLine(point: THREE.Vector3, line: THREE.Line3 | null) {
  if (!line) return point;
  const distanceToStart = point.distanceTo(line.start);
  const distanceToEnd = point.distanceTo(line.end);
  return (distanceToStart < distanceToEnd ? line.start : line.end).clone();
}

function estimateSnapThreshold(record: DrawingRecord) {
  const width = Math.abs(record.projection.bounds.right - record.projection.bounds.left);
  const height = Math.abs(record.projection.bounds.top - record.projection.bounds.bottom);
  return Math.max(width, height, 1) * 0.025;
}
