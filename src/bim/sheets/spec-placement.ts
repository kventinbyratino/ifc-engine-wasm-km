import type { SpecificationRow } from "../specs/spec-generator.ts";

export type SheetSpecBlock = {
  id: string;
  title: string;
  rows: SpecificationRow[];
  order: number;
};

export function createSpecBlock(params: {
  id?: string;
  title: string;
  rows: SpecificationRow[];
  order?: number;
}): SheetSpecBlock {
  return {
    id: params.id || `spec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: params.title,
    rows: [...params.rows],
    order: params.order ?? 0,
  };
}

export function createSpecBlocksFromRows(
  rows: SpecificationRow[],
  options: { title?: string; maxRowsPerBlock?: number; idPrefix?: string } = {},
): SheetSpecBlock[] {
  if (rows.length === 0) return [];

  const title = options.title?.trim() || "Спецификация";
  const maxRowsPerBlock = Math.max(1, options.maxRowsPerBlock ?? 12);
  const idPrefix = options.idPrefix?.trim() || "spec-block";
  const chunks = chunkRows(rows, maxRowsPerBlock);
  const total = chunks.length;

  return chunks.map((chunk, index) => ({
    id: `${idPrefix}-${index + 1}`,
    title: total > 1 ? `${title} ${index + 1}/${total}` : title,
    rows: chunk,
    order: index,
  }));
}

export function addSpecBlock(blocks: SheetSpecBlock[], block: SheetSpecBlock, index = blocks.length) {
  const next = [...blocks.filter((item) => item.id !== block.id)];
  const safeIndex = Math.max(0, Math.min(index, next.length));
  next.splice(safeIndex, 0, { ...block, rows: [...block.rows] });
  return normalizeSpecBlockOrder(next);
}

export function removeSpecBlock(blocks: SheetSpecBlock[], blockId: string) {
  return normalizeSpecBlockOrder(blocks.filter((block) => block.id !== blockId));
}

export function moveSpecBlock(blocks: SheetSpecBlock[], blockId: string, index: number) {
  const next = [...blocks];
  const currentIndex = next.findIndex((block) => block.id === blockId);
  if (currentIndex < 0) return normalizeSpecBlockOrder(next);
  const [block] = next.splice(currentIndex, 1);
  const safeIndex = Math.max(0, Math.min(index, next.length));
  next.splice(safeIndex, 0, block);
  return normalizeSpecBlockOrder(next);
}

export function normalizeSpecBlockOrder(blocks: SheetSpecBlock[]) {
  return blocks.map((block, index) => ({ ...block, order: index }));
}

function chunkRows(rows: SpecificationRow[], size: number) {
  const chunks: SpecificationRow[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}
