import type * as OBC from "@thatopen/components";

export type ModelIdMap = OBC.ModelIdMap;

export type LoadingElement = HTMLElement & { loading?: boolean; disabled?: boolean };

export type FragmentRecord = {
  id: string;
  name: string;
  filename: string;
  size_bytes: number;
  created_at: string;
};

export type IfcExample = {
  name: string;
  filename: string;
  sizeBytes: number;
};

export type Profile = "pending" | "km" | "bim";

export type ProfileCapabilities = {
  dataBrowser: boolean;
  drawings: boolean;
  dxf: boolean;
  issues: boolean;
  qaQc: boolean;
};
