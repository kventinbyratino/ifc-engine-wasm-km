export type TelemetrySeverity = "info" | "warning" | "error";

export interface TelemetryEvent {
  name: string;
  timestamp: string;
  severity: TelemetrySeverity;
  payload: Record<string, unknown>;
}

export interface TelemetryOptions {
  enabled?: boolean;
  maxEvents?: number;
  now?: () => string;
  send?: (event: TelemetryEvent) => void;
}

export interface Telemetry {
  track: (name: string, payload?: Record<string, unknown>, severity?: TelemetrySeverity) => void;
  trackError: (name: string, error: unknown, payload?: Record<string, unknown>) => void;
  getEvents: () => TelemetryEvent[];
  clear: () => void;
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorName: typeof error,
    errorMessage: String(error),
  };
}

export function createTelemetry(options: TelemetryOptions = {}): Telemetry {
  const enabled = options.enabled ?? true;
  const maxEvents = Math.max(0, options.maxEvents ?? 200);
  const now = options.now ?? (() => new Date().toISOString());
  const events: TelemetryEvent[] = [];

  function retain(event: TelemetryEvent) {
    if (maxEvents === 0) return;
    events.push(event);
    while (events.length > maxEvents) events.shift();
  }

  function track(name: string, payload: Record<string, unknown> = {}, severity: TelemetrySeverity = "info") {
    if (!enabled) return;
    const event: TelemetryEvent = {
      name,
      timestamp: now(),
      severity,
      payload: { ...payload },
    };
    retain(event);
    options.send?.(event);
  }

  function trackError(name: string, error: unknown, payload: Record<string, unknown> = {}) {
    track(name, { ...payload, ...sanitizeError(error) }, "error");
  }

  return {
    track,
    trackError,
    getEvents: () => events.map((event) => ({
      ...event,
      payload: { ...event.payload },
    })),
    clear: () => {
      events.splice(0, events.length);
    },
  };
}

export const appTelemetry = createTelemetry({
  send: (event) => {
    if (event.severity === "error") {
      console.warn("[telemetry]", event.name, event.payload);
    }
  },
});
