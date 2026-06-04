import type { IfcExample } from "./types";

export const IFC_EXAMPLES: IfcExample[] = [
  { name: "Renga House", filename: "Renga_House.ifc", sizeBytes: 1_317_373 },
];

export const MAX_IFC_BYTES = 200 * 1024 * 1024;
export const MAX_FRAGMENT_BYTES = 100 * 1024 * 1024;
export const APP_BASE = window.location.pathname.startsWith("/ifc-engine-wasm/") ? "/ifc-engine-wasm" : "";
export const API_BASE = "/ifc-engine-wasm/api";
