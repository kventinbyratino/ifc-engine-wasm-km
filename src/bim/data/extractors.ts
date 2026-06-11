export type RawItem = Record<string, unknown>;

export function attr(item: RawItem | undefined, key: string) {
  const value = item?.[key];
  if (value === undefined || value === null) return "";
  if (typeof value === "object" && value !== null && "value" in value) {
    const nested = (value as { value?: unknown }).value;
    return nested === undefined || nested === null ? "" : String(nested);
  }
  return String(value);
}

export function findStorey(item: RawItem | undefined) {
  if (!item) return "";
  const direct = attr(item, "Storey") || attr(item, "Building Storey") || attr(item, "Level");
  if (direct) return direct;
  if (attr(item, "_category") === "IFCBUILDINGSTOREY") return attr(item, "Name");

  const seen = new WeakSet<object>();
  const visit = (value: unknown): string => {
    if (!value || typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);

    if (Array.isArray(value)) {
      for (const entry of value) {
        const result = visit(entry);
        if (result) return result;
      }
      return "";
    }

    const record = value as RawItem;
    if (attr(record, "_category") === "IFCBUILDINGSTOREY") return attr(record, "Name");
    for (const nested of Object.values(record)) {
      const result = visit(nested);
      if (result) return result;
    }
    return "";
  };

  return visit(item);
}

export function findMaterial(item: RawItem | undefined) {
  if (!item) return "";
  return attr(item, "Material") || attr(item, "MaterialName") || attr(item, "RelatingMaterial") || "";
}

export function stringifyValues(value: unknown) {
  const chunks: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (entry: unknown) => {
    if (entry === null || entry === undefined) return;
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      chunks.push(String(entry));
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (typeof entry !== "object" || seen.has(entry)) return;
    seen.add(entry);
    Object.entries(entry as RawItem).forEach(([key, nested]) => {
      chunks.push(key);
      visit(nested);
    });
  };

  visit(value);
  return chunks.join(" ");
}
