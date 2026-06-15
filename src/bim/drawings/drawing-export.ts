import type { DrawingDocument } from "./drawing-document.ts";
import { drawingToDxf } from "./annotation-geometry.ts";

export function downloadDrawingDxf(record: DrawingDocument) {
  const dxf = drawingToDxf(record);
  const file = new File([dxf], `${sanitizeFilename(record.name)}.dxf`, { type: "application/dxf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^\p{L}\p{N}_.-]+/gu, "_").slice(0, 80) || "drawing";
}
