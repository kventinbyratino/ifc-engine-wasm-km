import * as THREE from "three";
import * as OBC from "@thatopen/components";
import type { DrawingDocument } from "./drawing-document";
import { createDrawingAnnotation, getDrawingAnnotationTypeLabel } from "./annotation-factory";

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

export { getDrawingAnnotationTypeLabel };

export function addDrawingAnnotation(record: DrawingDocument, options: DrawingAnnotationOptions) {
  const annotation = createDrawingAnnotation({
    components: options.components,
    record,
    type: options.type,
    text: options.text,
    point: options.point,
    line: options.line,
  });
  syncDrawingAnnotations(options.components, record);
  return annotation;
}

export function clearDrawingAnnotations(record: DrawingDocument, components: OBC.Components) {
  const techDrawings = components.get(OBC.TechnicalDrawings);
  techDrawings.use(OBC.LinearAnnotations).clear([record.drawing]);
  techDrawings.use(OBC.LeaderAnnotations).clear([record.drawing]);
  techDrawings.use(OBC.CalloutAnnotations).clear([record.drawing]);
  record.annotations = [];
}

export function deleteDrawingAnnotation(record: DrawingDocument, components: OBC.Components, annotationId: string) {
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

export function updateDrawingAnnotationText(record: DrawingDocument, components: OBC.Components, annotationId: string, text: string) {
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

export function syncDrawingAnnotations(components: OBC.Components, record: DrawingDocument) {
  const techDrawings = components.get(OBC.TechnicalDrawings);
  const linear = techDrawings.use(OBC.LinearAnnotations);
  const leader = techDrawings.use(OBC.LeaderAnnotations);
  const callout = techDrawings.use(OBC.CalloutAnnotations);
  const annotations: DrawingAnnotation[] = [];

  for (const [id, item] of record.drawing.annotations.getBySystem(linear)) {
    annotations.push({ id, type: "linear", text: formatMeters(item.pointA.distanceTo(item.pointB)), createdAt: new Date() });
  }
  for (const [id, item] of record.drawing.annotations.getBySystem(leader)) {
    annotations.push({ id, type: item.text.startsWith("Подпись") ? "label" : "leader", text: item.text, createdAt: new Date() });
  }
  for (const [id, item] of record.drawing.annotations.getBySystem(callout)) {
    annotations.push({ id, type: "callout", text: item.text, createdAt: new Date() });
  }

  record.annotations = annotations;
  return annotations;
}

export function countDrawingAnnotations(record: DrawingDocument) {
  return record.annotations.length;
}

function formatMeters(value: number) {
  return Number(value.toFixed(value >= 10 ? 2 : 3)).toString();
}
