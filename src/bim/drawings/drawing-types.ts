export type DrawingView = "plan" | "front" | "right" | "back" | "left" | "section";
export type DrawingSource = "all" | "selection" | "filtered";
export type DrawingProjectionLinkStatus = "linked" | "unlinked";
export type DrawingProjectionSyncStatus = "linked" | "unlinked" | "off-screen";

export type DrawingProjectionSourceRef = {
  id: string;
  projectionType: DrawingView;
  status: DrawingProjectionLinkStatus;
  source: {
    modelId: string;
    localId: number;
  } | null;
};

export type DrawingProjection = {
  far: number;
  bounds: import("@thatopen/components").DrawingViewportConfig;
  scale: number;
  sourceRefs: DrawingProjectionSourceRef[];
};
