export type SheetViewportFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SheetViewportHandle =
  | "move"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

export function cloneSheetViewportFrame(frame: SheetViewportFrame): SheetViewportFrame {
  return { ...frame };
}

export function normalizeSheetViewportFrame(frame: Partial<SheetViewportFrame>, bounds: SheetViewportFrame, minSize = 24): SheetViewportFrame {
  const width = clampNumber(frame.width ?? bounds.width, minSize, bounds.width);
  const height = clampNumber(frame.height ?? bounds.height, minSize, bounds.height);
  const maxX = Math.max(bounds.x, bounds.x + bounds.width - width);
  const maxY = Math.max(bounds.y, bounds.y + bounds.height - height);
  const x = clampNumber(frame.x ?? bounds.x, bounds.x, maxX);
  const y = clampNumber(frame.y ?? bounds.y, bounds.y, maxY);
  return { x, y, width, height };
}

export function applySheetViewportDrag(options: {
  frame: SheetViewportFrame;
  bounds: SheetViewportFrame;
  handle: SheetViewportHandle;
  deltaX: number;
  deltaY: number;
  minSize?: number;
}): SheetViewportFrame {
  const minSize = Math.max(24, Math.floor(options.minSize ?? 24));
  const { frame, bounds } = options;
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;

  let next = { ...frame };
  if (options.handle === "move") {
    next.x = frame.x + options.deltaX;
    next.y = frame.y + options.deltaY;
  } else {
    if (options.handle.includes("w")) {
      next.x = frame.x + options.deltaX;
      next.width = frame.width - options.deltaX;
    }
    if (options.handle.includes("e")) {
      next.width = frame.width + options.deltaX;
    }
    if (options.handle.includes("n")) {
      next.y = frame.y + options.deltaY;
      next.height = frame.height - options.deltaY;
    }
    if (options.handle.includes("s")) {
      next.height = frame.height + options.deltaY;
    }
  }

  next.width = Math.max(minSize, next.width);
  next.height = Math.max(minSize, next.height);

  if (next.x < bounds.x) {
    if (options.handle !== "move" && options.handle.includes("w")) {
      next.width -= bounds.x - next.x;
    }
    next.x = bounds.x;
  }
  if (next.y < bounds.y) {
    if (options.handle !== "move" && options.handle.includes("n")) {
      next.height -= bounds.y - next.y;
    }
    next.y = bounds.y;
  }

  if (next.x + next.width > bounds.x + bounds.width) {
    if (options.handle !== "move" && options.handle.includes("e")) {
      next.width = bounds.x + bounds.width - next.x;
    } else {
      next.x = bounds.x + bounds.width - next.width;
    }
  }
  if (next.y + next.height > bounds.y + bounds.height) {
    if (options.handle !== "move" && options.handle.includes("s")) {
      next.height = bounds.y + bounds.height - next.y;
    } else {
      next.y = bounds.y + bounds.height - next.height;
    }
  }

  next.width = Math.max(minSize, Math.min(next.width, bounds.width));
  next.height = Math.max(minSize, Math.min(next.height, bounds.height));
  next.x = clampNumber(next.x, bounds.x, bounds.x + bounds.width - next.width);
  next.y = clampNumber(next.y, bounds.y, bounds.y + bounds.height - next.height);
  return next;
}

function clampNumber(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}
