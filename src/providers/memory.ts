import type { EnrichedAnalyticsEvent } from "../types/index.js";
import type { AnalyticsProvider } from "./contracts.js";

export class MemoryAnalyticsProvider implements AnalyticsProvider {
  readonly name = "memory";
  readonly supportsIdempotency = true as const;
  private readonly events: EnrichedAnalyticsEvent[] = [];

  async track(event: EnrichedAnalyticsEvent): Promise<void> {
    if (this.events.some((stored) => stored.eventId === event.eventId)) return;
    this.events.push(event);
  }

  async deleteByUser(userId: string): Promise<void> {
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (event && (event.userId === userId || event.actor.userId === userId)) {
        this.events.splice(index, 1);
      }
    }
  }

  async deleteOlderThan(cutoff: string): Promise<void> {
    const cutoffTime = Date.parse(cutoff);
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (event && Date.parse(event.occurredAt) < cutoffTime) {
        this.events.splice(index, 1);
      }
    }
  }

  snapshot(): EnrichedAnalyticsEvent[] {
    return this.events.map((event) => ({
      ...event,
      properties: { ...event.properties },
      enrichment: { ...event.enrichment },
      actor: { ...event.actor },
    }));
  }
}
