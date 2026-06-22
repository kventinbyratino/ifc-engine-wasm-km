import type { Profile } from "../../bim/types.ts";
import type { IfcExample } from "../../bim/types.ts";

export const IFC_EXAMPLES: IfcExample[] = [
  { name: "Renga House", filename: "Renga_House.ifc", sizeBytes: 1_317_373 },
];

export const MAX_IFC_BYTES = 200 * 1024 * 1024;
export const MAX_FRAGMENT_BYTES = 100 * 1024 * 1024;

export const APP_BASE = "/blue/km";
export const API_BASE = "/ifc-engine-wasm/api";
export const WEB_IFC_BASE = `${APP_BASE}/web-ifc/`;

export const KM_PROFILE_ID = "km";
export const KM_PROFILE_NAME = "IFC Engine KM";
export const KM_PROFILE_PATH = `${APP_BASE}/`;
export const KM_VIEWER_PATH = `${APP_BASE}/viewer`;
export const BIM_PROFILE_PATH = "/ifc-engine-wasm/bim/";

export function trimTrailingSlash(path: string) {
  return path.replace(/\/+$/, "");
}

export function createProfilePath(profile: Profile) {
  if (profile === "bim") return BIM_PROFILE_PATH;
  return KM_PROFILE_PATH;
}

export function createShareUrl(profile: Profile, fragmentId: string, origin = window.location.origin) {
  const profileSegment = profile === "bim" ? "bim" : "viewer";
  const url = new URL(`${APP_BASE}/${profileSegment}/`, origin);
  url.searchParams.set("fragment", fragmentId);
  return url.toString();
}
