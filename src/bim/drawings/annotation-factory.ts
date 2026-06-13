import * as THREE from "three";
import * as OBC from "@thatopen/components";
import type { DrawingDocument } from "./drawing-document";
import type { DrawingAnnotation, DrawingAnnotationType } from "./drawing-annotations";
import { getDrawingFootprintBox } from "./annotation-geometry";

export function getDrawingAnnotationTypeLabel(type: DrawingAnnotationType) {
  const labels: Record<DrawingAnnotationType, string> = {
    linear: "Размер",
    leader: "Выноска",
    callout: "Маркер",
    label: "Подпись",
  };
  return labels[type];
}

export function createDrawingAnnotation(options: {
  components: OBC.Components;
  record: DrawingDocument;
  type: DrawingAnnotationType;
  text?: string;
  point?: THREE.Vector3;
  line?: THREE.Line3 | null;
}) {
  const box = getDrawingFootprintBox(options.record);
  if (box.isEmpty()) throw new Error("Нельзя добавить аннотацию: чертёж пустой");

  const text = normalizeAnnotationText(options.type, options.text, box, options.line);
  const point = options.point ?? box.getCenter(new THREE.Vector3());

  if (options.type === "linear") {
    const dimension = createLinearAnnotation(options.components, options.record, box, point, options.line ?? null);
    return toUiAnnotation(dimension.uuid, "linear", text);
  }

  if (options.type === "callout") {
    const callout = createCalloutAnnotation(options.components, options.record, box, point, text);
    return toUiAnnotation(callout.uuid, "callout", text);
  }

  const leader = createLeaderAnnotation(options.components, options.record, box, point, text, options.type === "label");
  return toUiAnnotation(leader.uuid, options.type, text);
}

export function normalizeAnnotationText(type: DrawingAnnotationType, text: string | undefined, box: THREE.Box3, line?: THREE.Line3 | null) {
  const value = text?.trim();
  if (value) return value;
  if (type === "linear") {
    const width = line ? line.start.distanceTo(line.end) : Math.abs(box.max.x - box.min.x);
    return `${formatMeters(width)} м`;
  }
  if (type === "leader") return "Выноска";
  if (type === "callout") return "A-01";
  return "Подпись";
}

function createLinearAnnotation(
  components: OBC.Components,
  record: DrawingDocument,
  box: THREE.Box3,
  point: THREE.Vector3,
  line: THREE.Line3 | null,
) {
  const system = components.get(OBC.TechnicalDrawings).use(OBC.LinearAnnotations);
  const sourceLine = line ?? defaultDimensionLine(box, point);
  const size = box.getSize(new THREE.Vector3());
  const offset = Math.max(size.x, size.z, 1) * 0.08;
  return system.add(record.drawing, {
    pointA: sourceLine.start.clone(),
    pointB: sourceLine.end.clone(),
    offset,
    style: system.activeStyle,
  });
}

function createLeaderAnnotation(
  components: OBC.Components,
  record: DrawingDocument,
  box: THREE.Box3,
  point: THREE.Vector3,
  text: string,
  isLabel: boolean,
) {
  const system = components.get(OBC.TechnicalDrawings).use(OBC.LeaderAnnotations);
  const size = box.getSize(new THREE.Vector3());
  const pad = Math.max(size.x, size.z, 1) * 0.08;
  const elbow = isLabel ? point.clone().add(new THREE.Vector3(pad * 0.5, 0, -pad * 0.2)) : point.clone().add(new THREE.Vector3(pad, 0, -pad * 0.6));
  const extensionEnd = elbow.clone().add(new THREE.Vector3(pad * 1.35, 0, 0));
  return system.add(record.drawing, {
    arrowTip: point.clone(),
    elbow,
    extensionEnd,
    text,
    style: system.activeStyle,
  });
}

function createCalloutAnnotation(components: OBC.Components, record: DrawingDocument, box: THREE.Box3, point: THREE.Vector3, text: string) {
  const system = components.get(OBC.TechnicalDrawings).use(OBC.CalloutAnnotations);
  const size = box.getSize(new THREE.Vector3());
  const pad = Math.max(size.x, size.z, 1) * 0.06;
  return system.add(record.drawing, {
    center: point.clone(),
    halfW: pad,
    halfH: pad * 0.55,
    elbow: point.clone().add(new THREE.Vector3(pad * 1.4, 0, -pad)),
    extensionEnd: point.clone().add(new THREE.Vector3(pad * 2.5, 0, -pad)),
    text,
    style: system.activeStyle,
  });
}

function defaultDimensionLine(box: THREE.Box3, point: THREE.Vector3) {
  const size = box.getSize(new THREE.Vector3());
  const length = Math.max(size.x * 0.35, 1);
  return new THREE.Line3(
    new THREE.Vector3(point.x - length / 2, 0, point.z),
    new THREE.Vector3(point.x + length / 2, 0, point.z),
  );
}

function toUiAnnotation(id: string, type: DrawingAnnotationType, text: string): DrawingAnnotation {
  return { id, type, text, createdAt: new Date() };
}

function formatMeters(value: number) {
  return Number(value.toFixed(value >= 10 ? 2 : 3)).toString();
}
