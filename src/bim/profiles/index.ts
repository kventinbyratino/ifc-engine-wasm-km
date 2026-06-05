import type { Profile, ProfileCapabilities } from "../types";
import { bimProfileCapabilities } from "./bim";
import { kmProfileCapabilities } from "./km";

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
