import type { EnrichedAnalyticsEvent } from "../types/index.js";

export interface EventStore {
  readonly durability: "ephemeral" | "durable";
  /** Must atomically reject an eventId already present in a durable implementation. */
  append(event: EnrichedAnalyticsEvent): boolean;
  get(eventId: string): EnrichedAnalyticsEvent | undefined;
  all(): EnrichedAnalyticsEvent[];
  deleteByUser(userId: string): number;
  deleteOlderThan(cutoff: string): number;
}

export class InMemoryEventStore implements EventStore {
  readonly durability = "ephemeral" as const;
  private readonly events: EnrichedAnalyticsEvent[] = [];

  append(event: EnrichedAnalyticsEvent): boolean {
    if (this.events.some((storedEvent) => storedEvent.eventId === event.eventId)) {
      return false;
    }
    this.events.push(event);
    return true;
  }

  get(eventId: string): EnrichedAnalyticsEvent | undefined {
    const event = this.events.find((storedEvent) => storedEvent.eventId === eventId);
    return event ? cloneEvent(event) : undefined;
  }

  all(): EnrichedAnalyticsEvent[] {
    return this.events.map((event) => ({
      ...event,
      properties: { ...event.properties },
      enrichment: { ...event.enrichment },
      actor: { ...event.actor },
    }));
  }

  deleteByUser(userId: string): number {
    let deleted = 0;
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (event && (event.userId === userId || event.actor.userId === userId)) {
        this.events.splice(index, 1);
        deleted += 1;
      }
    }
    return deleted;
  }

  deleteOlderThan(cutoff: string): number {
    const cutoffTime = Date.parse(cutoff);
    let deleted = 0;
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (event && Date.parse(event.occurredAt) < cutoffTime) {
        this.events.splice(index, 1);
        deleted += 1;
      }
    }
    return deleted;
  }
}

function cloneEvent(event: EnrichedAnalyticsEvent): EnrichedAnalyticsEvent {
  return {
    ...event,
    properties: { ...event.properties },
    enrichment: { ...event.enrichment },
    actor: { ...event.actor },
  };
}
