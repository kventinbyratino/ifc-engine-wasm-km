export type PerformanceMarkName = "load-start" | "first-visible" | "load-complete" | string;

export type PerformanceMetricCounts = {
  elementCount: number;
  visibleElementCount: number;
  chunkCount: number;
};

export type PerformanceMetricSnapshot = {
  marks: Record<string, number>;
  counts: PerformanceMetricCounts;
};

export type LoadPerformanceSummary = PerformanceMetricCounts & {
  timeToFirstVisibleMs: number;
  totalLoadMs: number;
};

export type PerformanceBudget = {
  maxTimeToFirstVisibleMs: number;
  maxTotalLoadMs: number;
  minVisibleElementRatio?: number;
};

export type PerformanceBudgetResult = {
  ok: boolean;
  regressions: string[];
};

export function createPerformanceMetricCollector(options: { now?: () => number } = {}) {
  const now = options.now ?? (() => performance.now());
  const marks: Record<string, number> = {};
  let counts: PerformanceMetricCounts = { elementCount: 0, visibleElementCount: 0, chunkCount: 0 };

  return {
    mark(name: PerformanceMarkName, at = now()) {
      marks[name] = at;
    },
    setCounts(next: Partial<PerformanceMetricCounts>) {
      counts = { ...counts, ...normalizeCounts(next) };
    },
    snapshot(): PerformanceMetricSnapshot {
      return { marks: { ...marks }, counts: { ...counts } };
    },
  };
}

export function summarizeLoadPerformance(snapshot: PerformanceMetricSnapshot): LoadPerformanceSummary {
  const loadStart = snapshot.marks["load-start"] ?? 0;
  const firstVisible = snapshot.marks["first-visible"] ?? loadStart;
  const loadComplete = snapshot.marks["load-complete"] ?? firstVisible;
  return {
    ...snapshot.counts,
    timeToFirstVisibleMs: Math.max(0, firstVisible - loadStart),
    totalLoadMs: Math.max(0, loadComplete - loadStart),
  };
}

export function evaluatePerformanceBudget(
  summary: LoadPerformanceSummary,
  budget: PerformanceBudget,
): PerformanceBudgetResult {
  const regressions: string[] = [];
  if (summary.timeToFirstVisibleMs > budget.maxTimeToFirstVisibleMs) regressions.push("time-to-first-visible");
  if (summary.totalLoadMs > budget.maxTotalLoadMs) regressions.push("total-load");
  const minVisibleElementRatio = budget.minVisibleElementRatio ?? 0;
  const visibleRatio = summary.elementCount > 0 ? summary.visibleElementCount / summary.elementCount : 1;
  if (visibleRatio < minVisibleElementRatio) regressions.push("visible-element-ratio");
  return { ok: regressions.length === 0, regressions };
}

function normalizeCounts(next: Partial<PerformanceMetricCounts>) {
  return {
    elementCount: Math.max(0, Math.floor(next.elementCount ?? 0)),
    visibleElementCount: Math.max(0, Math.floor(next.visibleElementCount ?? 0)),
    chunkCount: Math.max(0, Math.floor(next.chunkCount ?? 0)),
  };
}
