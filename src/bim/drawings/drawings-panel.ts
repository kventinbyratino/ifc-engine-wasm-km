import * as THREE from "three";
import * as OBC from "@thatopen/components";
import type { ModelIdMap } from "../types";
import { countSelection, isEmptySelection } from "../selection/selection";
import type { DrawingAnnotation } from "./drawing-annotations";

export type DrawingView = "plan" | "front" | "right" | "back" | "left" | "section";
export type DrawingSource = "all" | "selection" | "filtered";

export type DrawingProjection = {
  far: number;
  bounds: OBC.DrawingViewportConfig;
  scale: number;
};

export type DrawingRecord = {
  id: string;
  name: string;
  view: DrawingView;
  source: DrawingSource;
  itemCount: number;
  lineCount: number;
  annotations: DrawingAnnotation[];
  createdAt: Date;
  drawing: OBC.TechnicalDrawing;
  viewport: OBC.DrawingViewport | null;
  projection: DrawingProjection;
};

export type DrawingBuildOptions = {
  components: OBC.Components;
  world: OBC.World;
  fragments: OBC.FragmentsManager;
  modelIdMap: ModelIdMap;
  view: DrawingView;
  source: DrawingSource;
  far: number;
  name?: string;
  onProgress?: (message: string, progress?: number) => void;
};

export function getDrawingSourceLabel(source: DrawingSource) {
  const labels: Record<DrawingSource, string> = {
    all: "вся модель",
    selection: "выборка",
    filtered: "фильтр Data Browser",
  };
  return labels[source];
}

export function getDrawingViewLabel(view: DrawingView) {
  const labels: Record<DrawingView, string> = {
    plan: "План",
    front: "Фасад спереди",
    right: "Фасад справа",
    back: "Фасад сзади",
    left: "Фасад слева",
    section: "Разрез",
  };
  return labels[view];
}

export function renderDrawingList(options: {
  records: DrawingRecord[];
  output: HTMLElement;
  onSelect: (record: DrawingRecord) => void;
  onExport: (record: DrawingRecord) => void;
  onAnnotate: (record: DrawingRecord) => void;
  onDelete: (record: DrawingRecord) => void;
}) {
  if (options.records.length === 0) {
    options.output.innerHTML = `<span class="empty-state">Чертежей пока нет. Сгенерируйте проекцию.</span>`;
    return;
  }

  const list = document.createElement("div");
  list.className = "drawing-list";

  for (const record of options.records) {
    const card = document.createElement("article");
    card.className = "drawing-card";
    card.innerHTML = `
      <div class="drawing-card-main">
        <strong>${escapeHtml(record.name)}</strong>
        <span>${escapeHtml(getDrawingViewLabel(record.view))} · ${record.itemCount} эл. · ${record.lineCount} линий · ${record.annotations.length} анн.</span>
        <small>${record.createdAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "drawing-card-actions";

    const select = document.createElement("button");
    select.type = "button";
    select.textContent = "Показать";
    select.onclick = () => options.onSelect(record);

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "DXF";
    exportButton.onclick = () => options.onExport(record);

    const annotate = document.createElement("button");
    annotate.type = "button";
    annotate.textContent = "Аннотация";
    annotate.onclick = () => options.onAnnotate(record);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "drawing-danger";
    remove.textContent = "Удалить";
    remove.onclick = () => options.onDelete(record);

    actions.append(select, annotate, exportButton, remove);
    card.append(actions);
    list.append(card);
  }

  options.output.replaceChildren(list);
}

export function downloadDrawingDxf(record: DrawingRecord) {
  const dxf = drawingToDxf(record);
  const file = new File([dxf], `${sanitizeFilename(record.name)}.dxf`, { type: "application/dxf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function createTechnicalDrawing(options: DrawingBuildOptions): Promise<DrawingRecord> {
  if (isEmptySelection(options.modelIdMap)) throw new Error("Нет элементов для проекции");

  const itemCount = countSelection(options.modelIdMap);
  const techDrawings = options.components.get(OBC.TechnicalDrawings);
  const drawing = techDrawings.create(options.world);
  const box = await options.fragments.getBBoxes(options.modelIdMap).then(unionBoxes);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const far = Math.max(options.far, 1);

  drawing.far = far;
  drawing.orientTo(directionForView(options.view));
  drawing.three.position.copy(originForView(options.view, center, size, far));
  drawing.layers.create("visible", { material: new THREE.LineBasicMaterial({ color: 0x101820 }) });
  drawing.layers.create("hidden", {
    material: new THREE.LineDashedMaterial({ color: 0x9aa6af, dashSize: 0.18, gapSize: 0.08 }),
  });

  options.onProgress?.("Проекция видимых/скрытых граней", 0.05);
  await drawing.addProjectionFromItems(options.modelIdMap, {
    layers: { visible: "visible", hidden: "hidden" },
    onProgress: options.onProgress,
  });

  const lineCount = countDrawingLines(drawing);
  const bounds = createDrawingViewportBounds(drawing);
  const viewport = drawing.viewports.create({ ...bounds, name: options.name || getDrawingViewLabel(options.view) });
  viewport.helperVisible = true;
  const record: DrawingRecord = {
    id: drawing.uuid,
    name: options.name || `${getDrawingViewLabel(options.view)} · ${getDrawingSourceLabel(options.source)}`,
    view: options.view,
    source: options.source,
    itemCount,
    lineCount,
    annotations: [],
    createdAt: new Date(),
    drawing,
    viewport,
    projection: {
      far,
      bounds,
      scale: viewport.drawingScale,
    },
  };
  return record;
}

export function disposeDrawing(record: DrawingRecord) {
  record.drawing.dispose();
}

export async function fitCameraToDrawing(world: OBC.World, record: DrawingRecord) {
  const box = new THREE.Box3().setFromObject(record.drawing.three);
  if (box.isEmpty()) return;
  const camera = world.camera as OBC.OrthoPerspectiveCamera;
  await camera.controls.fitToBox(box, true, {
    paddingLeft: 1.4,
    paddingRight: 1.4,
    paddingTop: 1.4,
    paddingBottom: 1.4,
  });
}

function directionForView(view: DrawingView) {
  if (view === "front") return new THREE.Vector3(0, 0, -1);
  if (view === "back") return new THREE.Vector3(0, 0, 1);
  if (view === "right") return new THREE.Vector3(-1, 0, 0);
  if (view === "left") return new THREE.Vector3(1, 0, 0);
  if (view === "section") return new THREE.Vector3(-1, 0, 0);
  return new THREE.Vector3(0, -1, 0);
}

function originForView(view: DrawingView, center: THREE.Vector3, size: THREE.Vector3, far: number) {
  const origin = center.clone();
  if (view === "front") origin.z = center.z + size.z / 2 + far * 0.02;
  else if (view === "back") origin.z = center.z - size.z / 2 - far * 0.02;
  else if (view === "right" || view === "section") origin.x = center.x + size.x / 2 + far * 0.02;
  else if (view === "left") origin.x = center.x - size.x / 2 - far * 0.02;
  else origin.y = center.y + size.y / 2 + far * 0.02;
  return origin;
}

function createDrawingViewportBounds(drawing: OBC.TechnicalDrawing): OBC.DrawingViewportConfig {
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

function unionBoxes(boxes: THREE.Box3[]) {
  const result = new THREE.Box3();
  for (const box of boxes) result.union(box);
  return result;
}

function countDrawingLines(drawing: OBC.TechnicalDrawing) {
  let count = 0;
  drawing.three.traverse((object) => {
    if (!(object instanceof THREE.LineSegments)) return;
    const position = object.geometry.getAttribute("position");
    count += Math.floor(position.count / 2);
  });
  return count;
}

function drawingToDxf(record: DrawingRecord) {
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

function sanitizeFilename(name: string) {
  return name.replace(/[^\p{L}\p{N}_.-]+/gu, "_").slice(0, 80) || "drawing";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
