import type { RawItem } from "./extractors";
import { attr } from "./extractors";

export function countPropertySets(item: RawItem | undefined) {
  if (!item) return 0;
  const names = new Set<string>();
  const seen = new WeakSet<object>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    const record = value as RawItem;
    const name = attr(record, "Name");
    const category = attr(record, "_category");
    if (name.startsWith("Pset_") || name.startsWith("Qto_") || category === "IFCPROPERTYSET") {
      names.add(name || JSON.stringify(record).slice(0, 80));
    }

    for (const nested of Object.values(record)) {
      if (Array.isArray(nested)) nested.forEach(visit);
      else visit(nested);
    }
  };

  visit(item);
  return names.size;
}
