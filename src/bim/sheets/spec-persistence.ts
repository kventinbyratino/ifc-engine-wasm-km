import type { SheetSpecBlock } from "./sheet-types.ts";
import type { SpecificationRow } from "../specs/spec-generator.ts";

export type StoredSpecBlock = {
  id: string;
  title: string;
  order: number;
  rows: SpecificationRow[];
};

export function serializeSpecBlocks(blocks: SheetSpecBlock[]): StoredSpecBlock[] {
  return blocks.map((block) => ({
    id: block.id,
    title: block.title,
    order: block.order,
    rows: block.rows.map((row) => ({ category: row.category, storey: row.storey, count: row.count })),
  }));
}

export function normalizeStoredSpecBlocks(raw: unknown): StoredSpecBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map(normalizeStoredSpecBlock)
    .filter((block): block is StoredSpecBlock => block !== null)
    .sort((a, b) => a.order - b.order);
}

function normalizeStoredSpecBlock(raw: Record<string, unknown>): StoredSpecBlock | null {
  if (typeof raw.id !== "string" || typeof raw.title !== "string" || typeof raw.order !== "number") return null;
  const rows = Array.isArray(raw.rows)
    ? raw.rows.filter(isRecord).map(normalizeSpecRow).filter((row): row is SpecificationRow => row !== null)
    : [];
  return { id: raw.id, title: raw.title, order: raw.order, rows };
}

function normalizeSpecRow(raw: Record<string, unknown>): SpecificationRow | null {
  if (typeof raw.category !== "string" || typeof raw.storey !== "string" || typeof raw.count !== "number") return null;
  return { category: raw.category, storey: raw.storey, count: raw.count };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
