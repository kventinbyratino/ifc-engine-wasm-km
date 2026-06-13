export type DrawingView = "plan" | "front" | "right" | "back" | "left" | "section";
export type DrawingSource = "all" | "selection" | "filtered";

export type DrawingProjection = {
  far: number;
  bounds: import("@thatopen/components").DrawingViewportConfig;
  scale: number;
};
