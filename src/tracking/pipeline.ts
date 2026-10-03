import { requireAnalyticsConsent } from "../consent/index.js";
import { enrichEvent } from "../enrichment/index.js";
import { AnalyticsError, DuplicateEventConflictError } from "../errors/index.js";
import { assertPrivacySafe, pseudonymiseEvent } from "../privacy/policy.js";
import { assertCompatibleEventVersion } from "../schemas/compatibility.js";
import type { ProviderDispatcher } from "../providers/index.js";
import type { AnalyticsEvent, EnrichedAnalyticsEvent } from "../types/index.js";
import type { EventStore } from "../integrations/event-store.js";

export class TrackingPipeline {
  private readonly inFlight = new Map<
    string,
    Promise<{ event: EnrichedAnalyticsEvent; duplicate: boolean }>
  >();

  constructor(
    private readonly store: EventStore,
    private readonly dispatcher: ProviderDispatcher,
    private readonly onDropped?: (event: AnalyticsEvent, reason: string) => void,
    private readonly pseudonymisationKey?: string,
  ) {}

  async track(event: AnalyticsEvent): Promise<EnrichedAnalyticsEvent> {
    const result = await this.trackWithStatus(event);
    return result.event;
  }

  private async trackWithStatus(
    event: AnalyticsEvent,
  ): Promise<{ event: EnrichedAnalyticsEvent; duplicate: boolean }> {
    assertCompatibleEventVersion(event.eventType, event.version);
    assertPrivacySafe(event);
    requireAnalyticsConsent(event);
    const safeEvent = pseudonymiseEvent(event, this.pseudonymisationKey);
    const enriched = enrichEvent(safeEvent);
    const existing = this.store.get(event.eventId);
    if (existing && !isEquivalentEvent(existing, enriched)) {
      throw new DuplicateEventConflictError(event.eventId);
    }
    if (existing) return { event: existing, duplicate: true };

    const pending = this.inFlight.get(event.eventId);
    if (pending) {
      const result = await pending;
      if (!isEquivalentEvent(result.event, enriched)) {
        throw new DuplicateEventConflictError(event.eventId);
      }
      return { event: result.event, duplicate: true };
    }

    const operation = (async () => {
      await this.dispatcher.track(enriched);
      const appended = this.store.append(enriched);
      if (!appended) {
        const stored = this.store.get(event.eventId);
        if (!stored) {
          throw new AnalyticsError(
            "EVENT_STORE_CONFLICT",
            "The event store rejected an event without returning the existing event",
            503,
          );
        }
        if (!isEquivalentEvent(stored, enriched)) {
          throw new DuplicateEventConflictError(event.eventId);
        }
        return { event: stored, duplicate: true };
      }
      return { event: enriched, duplicate: false };
    })();
    this.inFlight.set(event.eventId, operation);
    try {
      return await operation;
    } finally {
      if (this.inFlight.get(event.eventId) === operation) {
        this.inFlight.delete(event.eventId);
      }
    }
  }

  async trackBatch(events: AnalyticsEvent[]): Promise<{
    accepted: EnrichedAnalyticsEvent[];
    dropped: number;
    duplicates: number;
  }> {
    const batchEventIds = new Map<string, string>();
    for (const event of events) {
      assertCompatibleEventVersion(event.eventType, event.version);
      assertPrivacySafe(event);
      const fingerprint = canonicalJson(event as unknown as Record<string, unknown>);
      const previous = batchEventIds.get(event.eventId);
      if (previous && previous !== fingerprint) {
        throw new DuplicateEventConflictError(event.eventId);
      }
      batchEventIds.set(event.eventId, fingerprint);
    }

    const accepted: EnrichedAnalyticsEvent[] = [];
    let dropped = 0;
    let duplicates = 0;
    for (const event of events) {
      try {
        const result = await this.trackWithStatus(event);
        if (result.duplicate) duplicates += 1;
        else accepted.push(result.event);
      } catch (error) {
        if (error instanceof AnalyticsError && error.code === "CONSENT_REQUIRED") {
          this.onDropped?.(event, "consent");
          dropped += 1;
          continue;
        }
        throw error;
      }
    }
    return { accepted, dropped, duplicates };
  }
}

function isEquivalentEvent(
  existing: EnrichedAnalyticsEvent,
  incoming: EnrichedAnalyticsEvent,
): boolean {
  return canonicalJson(eventIdentity(existing)) === canonicalJson(eventIdentity(incoming));
}

function eventIdentity(event: EnrichedAnalyticsEvent): Record<string, unknown> {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    version: event.version,
    occurredAt: event.occurredAt,
    actor: event.actor,
    anonymousId: event.anonymousId,
    userId: event.userId,
    sessionId: event.sessionId,
    platform: event.platform,
    application: event.application,
    environment: event.environment,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    properties: event.properties,
    consent: event.consent,
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
    .join(",")}}`;
}
