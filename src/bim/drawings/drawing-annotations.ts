import * as THREE from "three";
import * as OBC from "@thatopen/components";
import type { DrawingRecord } from "./drawings-panel";

export type DrawingAnnotationType = "linear" | "leader" | "callout" | "label";

export type DrawingAnnotation = {
  id: string;
  type: DrawingAnnotationType;
  text: string;
  createdAt: Date;
};

export type DrawingAnnotationOptions = {
  components: OBC.Components;
  type: DrawingAnnotationType;
  text?: string;
  point?: THREE.Vector3;
  line?: THREE.Line3 | null;
};

export function getDrawingAnnotationTypeLabel(type: DrawingAnnotationType) {
  const labels: Record<DrawingAnnotationType, string> = {
    linear: "Размер",
    leader: "Выноска",
    callout: "Маркер",
    label: "Подпись",
  };
  return labels[type];
}

export function addDrawingAnnotation(record: DrawingRecord, options: DrawingAnnotationOptions) {
  const box = new THREE.Box3().setFromObject(record.drawing.three);
  if (box.isEmpty()) throw new Error("Нельзя добавить аннотацию: чертёж пустой");

  const text = normalizeAnnotationText(options.type, options.text, box, options.line);
  const point = options.point ?? box.getCenter(new THREE.Vector3());

  if (options.type === "linear") {
    const dimension = createLinearAnnotation(options.components, record, box, point, options.line ?? null);
    syncDrawingAnnotations(options.components, record);
    return toUiAnnotation(dimension.uuid, "linear", text);
  }

  if (options.type === "callout") {
    const callout = createCalloutAnnotation(options.components, record, box, point, text);
    syncDrawingAnnotations(options.components, record);
    return toUiAnnotation(callout.uuid, "callout", text);
  }

  const leader = createLeaderAnnotation(options.components, record, box, point, text, options.type === "label");
  syncDrawingAnnotations(options.components, record);
  return toUiAnnotation(leader.uuid, options.type, text);
}

export function clearDrawingAnnotations(record: DrawingRecord, components: OBC.Components) {
  const techDrawings = components.get(OBC.TechnicalDrawings);
  techDrawings.use(OBC.LinearAnnotations).clear([record.drawing]);
  techDrawings.use(OBC.LeaderAnnotations).clear([record.drawing]);
  techDrawings.use(OBC.CalloutAnnotations).clear([record.drawing]);
  record.annotations = [];
}

export function deleteDrawingAnnotation(record: DrawingRecord, components: OBC.Components, annotationId: string) {
  const techDrawings = components.get(OBC.TechnicalDrawings);
  const linear = techDrawings.use(OBC.LinearAnnotations);
  const leader = techDrawings.use(OBC.LeaderAnnotations);
  const callout = techDrawings.use(OBC.CalloutAnnotations);

  if (record.drawing.annotations.getBySystem(linear).has(annotationId)) linear.delete(record.drawing, [annotationId]);
  else if (record.drawing.annotations.getBySystem(leader).has(annotationId)) leader.delete(record.drawing, [annotationId]);
  else if (record.drawing.annotations.getBySystem(callout).has(annotationId)) callout.delete(record.drawing, [annotationId]);
  else throw new Error("Аннотация не найдена");

  return syncDrawingAnnotations(components, record);
}

export function updateDrawingAnnotationText(record: DrawingRecord, components: OBC.Components, annotationId: string, text: string) {
  const value = text.trim();
  if (!value) throw new Error("Текст аннотации пустой");

  const techDrawings = components.get(OBC.TechnicalDrawings);
  const leader = techDrawings.use(OBC.LeaderAnnotations);
  const callout = techDrawings.use(OBC.CalloutAnnotations);

  if (record.drawing.annotations.getBySystem(leader).has(annotationId)) leader.update(record.drawing, [annotationId], { text: value });
  else if (record.drawing.annotations.getBySystem(callout).has(annotationId)) callout.update(record.drawing, [annotationId], { text: value });
  else throw new Error("Текст можно редактировать только у выносок, маркеров и подписей");

  return syncDrawingAnnotations(components, record);
}

export function syncDrawingAnnotations(components: OBC.Components, record: DrawingRecord) {
  const techDrawings = components.get(OBC.TechnicalDrawings);
  const linear = techDrawings.use(OBC.LinearAnnotations);
  const leader = techDrawings.use(OBC.LeaderAnnotations);
  const callout = techDrawings.use(OBC.CalloutAnnotations);
  const annotations: DrawingAnnotation[] = [];

  for (const [id, item] of record.drawing.annotations.getBySystem(linear)) {
    annotations.push(toUiAnnotation(id, "linear", formatMeters(item.pointA.distanceTo(item.pointB))));
  }
  for (const [id, item] of record.drawing.annotations.getBySystem(leader)) {
    annotations.push(toUiAnnotation(id, item.text.startsWith("Подпись") ? "label" : "leader", item.text));
  }
  for (const [id, item] of record.drawing.annotations.getBySystem(callout)) {
    annotations.push(toUiAnnotation(id, "callout", item.text));
  }

  record.annotations = annotations;
  return annotations;
}

export function countDrawingAnnotations(record: DrawingRecord) {
  return record.annotations.length;
}

function createLinearAnnotation(
  components: OBC.Components,
  record: DrawingRecord,
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
  record: DrawingRecord,
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

function createCalloutAnnotation(components: OBC.Components, record: DrawingRecord, box: THREE.Box3, point: THREE.Vector3, text: string) {
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

function normalizeAnnotationText(type: DrawingAnnotationType, text: string | undefined, box: THREE.Box3, line?: THREE.Line3 | null) {
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

function formatMeters(value: number) {
  return Number(value.toFixed(value >= 10 ? 2 : 3)).toString();
}
