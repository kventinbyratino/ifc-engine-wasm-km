import * as THREE from "three";
import type * as OBC from "@thatopen/components";
import type { DrawingDocument } from "./drawing-document";

export function getDrawingFootprintBox(record: DrawingDocument) {
  const box = new THREE.Box3().setFromObject(record.drawing.three);
  return box;
}

export function countDrawingLines(record: DrawingDocument) {
  let count = 0;
  record.drawing.three.traverse((object) => {
    if (!(object instanceof THREE.LineSegments)) return;
    const position = object.geometry.getAttribute("position");
    count += Math.floor(position.count / 2);
  });
  return count;
}

export function createDrawingViewportBounds(drawing: OBC.TechnicalDrawing): OBC.DrawingViewportConfig {
  const box = new THREE.Box3().setFromObject(drawing.three);
  if (box.isEmpty()) return { left: -5, right: 5, top: 5, bottom: -5, scale: 100 };
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const pad = Math.max(size.x, size.z, 1) * 0.08;
  const left = center.x - size.x / 2 - pad;
  const right = center.x + size.x / 2 + pad;
  const top = -box.min.z + pad;
  const bottom = -box.max.z - pad;
  const width = Math.max(right - left, 0.001);
  const height = Math.max(top - bottom, 0.001);
  const targetPaperWidthMm = 360;
  const targetPaperHeightMm = 240;
  const scale = Math.max(1, Math.ceil(Math.max((width * 1000) / targetPaperWidthMm, (height * 1000) / targetPaperHeightMm) / 10) * 10);
  return { left, right, top, bottom, scale };
}

export function drawingToDxf(record: DrawingDocument) {
  const lines: Array<{ start: THREE.Vector3; end: THREE.Vector3; layer: string }> = [];
  const texts: Array<{ position: THREE.Vector3; text: string; size: number; layer: string }> = [];
  record.drawing.three.updateWorldMatrix(true, true);
  record.drawing.three.traverse((object) => {
    if (object instanceof THREE.Sprite && typeof object.userData.dxfText === "string") {
      texts.push({
        position: object.getWorldPosition(new THREE.Vector3()),
        text: object.userData.dxfText,
        size: Number(object.userData.dxfTextSize) || 1,
        layer: typeof object.userData.layer === "string" ? object.userData.layer : "annotation_text",
      });
      return;
    }

    if (!(object instanceof THREE.LineSegments)) return;
    const position = object.geometry.getAttribute("position");
    const layer = typeof object.userData?.layer === "string" ? object.userData.layer : "0";
    for (let index = 0; index + 1 < position.count; index += 2) {
      const start = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      const end = new THREE.Vector3().fromBufferAttribute(position, index + 1).applyMatrix4(object.matrixWorld);
      lines.push({ start, end, layer });
    }
  });

  const body = lines.flatMap((line) => [
    "0", "LINE",
    "8", sanitizeLayer(line.layer),
    "10", formatDxfNumber(line.start.x),
    "20", formatDxfNumber(line.start.z),
    "30", formatDxfNumber(line.start.y),
    "11", formatDxfNumber(line.end.x),
    "21", formatDxfNumber(line.end.z),
    "31", formatDxfNumber(line.end.y),
  ]);

  const textBody = texts.flatMap((text) => [
    "0", "TEXT",
    "8", sanitizeLayer(text.layer),
    "10", formatDxfNumber(text.position.x),
    "20", formatDxfNumber(text.position.z),
    "30", formatDxfNumber(text.position.y),
    "40", formatDxfNumber(text.size),
    "1", sanitizeDxfText(text.text),
  ]);

  return [
    "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1027", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES", ...body, ...textBody, "0", "ENDSEC", "0", "EOF", "",
  ].join("\n");
}

function formatDxfNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(5)).toString();
}

function sanitizeLayer(layer: string) {
  return layer.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "0";
}

function sanitizeDxfText(text: string) {
  return text.replace(/[\r\n]+/g, " ").slice(0, 255);
}
