import type { AnalyticsReport, EnrichedAnalyticsEvent, Environment } from "../types/index.js";

interface SummaryOptions {
  from?: string;
  to?: string;
  environment?: Environment;
}

export function summarize(
  events: EnrichedAnalyticsEvent[],
  options: SummaryOptions = {},
): AnalyticsReport {
  const from = options.from ?? "1970-01-01T00:00:00.000Z";
  const to = options.to ?? new Date().toISOString();
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime > toTime) {
    throw new Error("Report date range must contain valid dates with from <= to");
  }
  const filtered = events.filter((event) => {
    const timestamp = Date.parse(event.occurredAt);
    return (
      timestamp >= fromTime &&
      timestamp <= toTime &&
      (!options.environment || event.environment === options.environment)
    );
  });

  const eventCounts: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  const actors = new Set<string>();
  const sessions = new Set<string>();
  const bookingStarters = new Set<string>();
  const bookingCompleters = new Set<string>();
  let bookingStarted = 0;
  let bookingCompleted = 0;

  for (const event of filtered) {
    eventCounts[event.eventType] = (eventCounts[event.eventType] ?? 0) + 1;
    byPlatform[event.platform] = (byPlatform[event.platform] ?? 0) + 1;
    if (event.userId || event.anonymousId) actors.add(event.userId ?? event.anonymousId ?? event.eventId);
    if (event.sessionId) sessions.add(event.sessionId);
    const funnelActor = event.userId ?? event.anonymousId ?? event.sessionId ?? event.eventId;
    if (event.eventType === "booking.started") {
      bookingStarted += 1;
      bookingStarters.add(funnelActor);
    }
    if (event.eventType === "booking.completed") {
      bookingCompleted += 1;
      bookingCompleters.add(funnelActor);
    }
  }
  const convertedActors = [...bookingCompleters].filter((actor) => bookingStarters.has(actor)).length;

  return {
    from,
    to,
    ...(options.environment ? { environment: options.environment } : {}),
    eventCount: filtered.length,
    uniqueActors: actors.size,
    uniqueSessions: sessions.size,
    eventCounts,
    funnel: {
      bookingStarted,
      bookingCompleted,
      bookingConversionRate: bookingStarters.size === 0 ? 0 : convertedActors / bookingStarters.size,
    },
    byPlatform,
  };
}
