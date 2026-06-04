import * as THREE from "three";
import type { DrawingRecord } from "./drawings-panel";

export type DrawingAnnotationType = "linear" | "leader" | "callout" | "label";

export type DrawingAnnotation = {
  id: string;
  type: DrawingAnnotationType;
  text: string;
  createdAt: Date;
};

export type DrawingAnnotationOptions = {
  type: DrawingAnnotationType;
  text?: string;
};

const annotationColor = 0x0f172a;
const extensionColor = 0x475569;

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

  const id = crypto.randomUUID?.() ?? `annotation-${Date.now()}`;
  const annotation: DrawingAnnotation = {
    id,
    type: options.type,
    text: normalizeAnnotationText(options.type, options.text, box),
    createdAt: new Date(),
  };

  const group = new THREE.Group();
  group.name = `annotation:${id}`;
  group.userData.annotation = annotation;

  if (options.type === "linear") addLinearDimension(group, box, annotation.text);
  else if (options.type === "leader") addLeader(group, box, annotation.text);
  else if (options.type === "callout") addCallout(group, box, annotation.text);
  else addLabel(group, box, annotation.text);

  record.drawing.three.add(group);
  record.annotations.push(annotation);
  return annotation;
}

export function clearDrawingAnnotations(record: DrawingRecord) {
  const toRemove: THREE.Object3D[] = [];
  record.drawing.three.traverse((object) => {
    if (object.userData.annotation) toRemove.push(object);
  });

  for (const object of toRemove) {
    object.removeFromParent();
    object.traverse((child) => {
      const mesh = child as THREE.Mesh | THREE.LineSegments | THREE.Line;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose?.();
    });
  }

  record.annotations = [];
}

export function countDrawingAnnotations(record: DrawingRecord) {
  return record.annotations.length;
}

function addLinearDimension(group: THREE.Group, box: THREE.Box3, text: string) {
  const size = box.getSize(new THREE.Vector3());
  const pad = Math.max(size.x, size.y, size.z) * 0.08 || 1;
  const y = box.min.y - pad;
  const z = box.min.z;
  const start = new THREE.Vector3(box.min.x, y, z);
  const end = new THREE.Vector3(box.max.x, y, z);
  const leftExt = [new THREE.Vector3(box.min.x, box.min.y, z), start];
  const rightExt = [new THREE.Vector3(box.max.x, box.min.y, z), end];
  addPolyline(group, [start, end], annotationColor, "annotation_dimension");
  addPolyline(group, leftExt, extensionColor, "annotation_extension");
  addPolyline(group, rightExt, extensionColor, "annotation_extension");
  addText(group, text, start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, -pad * 0.15, 0)), pad * 0.45);
}

function addLeader(group: THREE.Group, box: THREE.Box3, text: string) {
  const size = box.getSize(new THREE.Vector3());
  const pad = Math.max(size.x, size.y, size.z) * 0.1 || 1;
  const target = box.getCenter(new THREE.Vector3());
  const elbow = new THREE.Vector3(box.max.x + pad, box.max.y + pad * 0.35, target.z);
  const label = new THREE.Vector3(box.max.x + pad * 1.8, box.max.y + pad * 0.35, target.z);
  addPolyline(group, [target, elbow, label], annotationColor, "annotation_leader");
  addText(group, text, label, pad * 0.42);
}

function addCallout(group: THREE.Group, box: THREE.Box3, text: string) {
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.035 || 0.5;
  const center = new THREE.Vector3(box.min.x + size.x * 0.18, box.max.y + radius * 1.8, box.min.z);
  addCircle(group, center, radius, annotationColor, "annotation_callout");
  addText(group, text, center.clone().add(new THREE.Vector3(radius * 1.9, 0, 0)), radius * 1.5);
}

function addLabel(group: THREE.Group, box: THREE.Box3, text: string) {
  const size = box.getSize(new THREE.Vector3());
  const pad = Math.max(size.x, size.y, size.z) * 0.08 || 1;
  const position = new THREE.Vector3(box.min.x, box.max.y + pad, box.min.z);
  addText(group, text, position, pad * 0.5);
}

function addPolyline(group: THREE.Group, points: THREE.Vector3[], color: number, layer: string) {
  const vertices: number[] = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    vertices.push(...points[index].toArray(), ...points[index + 1].toArray());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({ color, depthTest: false });
  const line = new THREE.LineSegments(geometry, material);
  line.userData.layer = layer;
  group.add(line);
}

function addCircle(group: THREE.Group, center: THREE.Vector3, radius: number, color: number, layer: string) {
  const points: THREE.Vector3[] = [];
  const segments = 48;
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, center.z));
  }
  addPolyline(group, points, color, layer);
}

function addText(group: THREE.Group, text: string, position: THREE.Vector3, size: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const width = Math.max(256, text.length * 18);
  canvas.width = width;
  canvas.height = 96;
  if (context) {
    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0f172a";
    context.font = "600 34px system-ui, -apple-system, Segoe UI, sans-serif";
    context.textBaseline = "middle";
    context.fillText(text, 12, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(size * (canvas.width / canvas.height), size, 1);
  sprite.userData.dxfText = text;
  sprite.userData.dxfTextSize = size;
  sprite.userData.layer = "annotation_text";
  group.add(sprite);
}

function normalizeAnnotationText(type: DrawingAnnotationType, text: string | undefined, box: THREE.Box3) {
  const value = text?.trim();
  if (value) return value;
  if (type === "linear") {
    const width = Math.abs(box.max.x - box.min.x);
    return `${formatMeters(width)} м`;
  }
  if (type === "leader") return "Выноска";
  if (type === "callout") return "A-01";
  return "Подпись";
}

function formatMeters(value: number) {
  return Number(value.toFixed(value >= 10 ? 2 : 3)).toString();
}
