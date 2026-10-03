import pino from "pino";

export const telemetry = pino({
  name: "marketplace-analytics",
  level: process.env.NODE_ENV === "test" ? "silent" : "info",
});

export function recordPipelineMetric(
  // These are analytics-service pipeline counters only, not platform monitoring.
  metric: "events.accepted" | "events.dropped" | "events.deleted",
  value: number,
): void {
  telemetry.info({ metric, value }, "analytics pipeline metric");
}
