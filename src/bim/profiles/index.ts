import type { Profile, ProfileCapabilities } from "../types.ts";
import { bimProfileCapabilities } from "./bim.ts";
import { kmProfileCapabilities } from "./km.ts";

const pendingProfileCapabilities: ProfileCapabilities = {
  dataBrowser: false,
  coordination: false,
  drawings: false,
  dxf: false,
  issues: false,
  qaQc: false,
};

export function getProfileCapabilities(profile: Profile): ProfileCapabilities {
  if (profile === "bim") return bimProfileCapabilities;
  if (profile === "km") return kmProfileCapabilities;
  return pendingProfileCapabilities;
}
