import { describe, expect, it } from "vitest";
import { ProviderDispatchError } from "../../src/errors/index.js";
import { InMemoryEventStore } from "../../src/integrations/event-store.js";
import { createProviderDispatcher, type AnalyticsProvider, ProviderDispatcher } from "../../src/providers/index.js";
import { TrackingPipeline } from "../../src/tracking/pipeline.js";
import type { AnalyticsEvent } from "../../src/types/index.js";

const TEST_PSEUDONYMISATION_KEY = "test-only-pseudonym-key-not-a-secret-0001";

const event: AnalyticsEvent = {
  eventId: "33333333-3333-4333-8333-333333333333",
  eventType: "booking.completed",
  version: 1,
  occurredAt: "2026-01-01T00:00:00.000Z",
  actor: { type: "professional", userId: "professional-3" },
  userId: "professional-3",
  platform: "api",
  application: "booking-service",
  environment: "test",
  properties: { lifecycleStage: "repeat" },
  consent: { analytics: true },
};

describe("tracking pipeline", () => {
  it("validates, pseudonymises, enriches, stores, and forwards an event", async () => {
    const store = new InMemoryEventStore();
    const { dispatcher, memory } = createProviderDispatcher();
    const pipeline = new TrackingPipeline(store, dispatcher, undefined, TEST_PSEUDONYMISATION_KEY);
    const processed = await pipeline.track(event);

    expect(processed.userId).not.toBe(event.userId);
    expect(processed.enrichment.category).toBe("booking");
    expect(store.all()).toHaveLength(1);
    expect(memory.snapshot()).toHaveLength(1);
  });

  it("drops events that do not have analytics consent", async () => {
    const store = new InMemoryEventStore();
    const { dispatcher } = createProviderDispatcher();
    const pipeline = new TrackingPipeline(store, dispatcher, undefined, TEST_PSEUDONYMISATION_KEY);
    const result = await pipeline.trackBatch([{ ...event, consent: { analytics: false } }]);

    expect(result).toEqual({ accepted: [], dropped: 1, duplicates: 0 });
    expect(store.all()).toHaveLength(0);
  });

  it("does not forward or store the same event twice", async () => {
    const store = new InMemoryEventStore();
    const { dispatcher, memory } = createProviderDispatcher();
    const pipeline = new TrackingPipeline(store, dispatcher, undefined, TEST_PSEUDONYMISATION_KEY);
    const result = await pipeline.trackBatch([event, event]);

    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates).toBe(1);
    expect(store.all()).toHaveLength(1);
    expect(memory.snapshot()).toHaveLength(1);
  });

  it("rejects reuse of an event id with different data", async () => {
    const store = new InMemoryEventStore();
    const { dispatcher } = createProviderDispatcher();
    const pipeline = new TrackingPipeline(store, dispatcher, undefined, TEST_PSEUDONYMISATION_KEY);
    await pipeline.track(event);

    await expect(pipeline.track({ ...event, eventType: "booking.started" })).rejects.toMatchObject({
      code: "DUPLICATE_EVENT_CONFLICT",
    });
  });

  it("deduplicates concurrent submissions with the same event id", async () => {
    const store = new InMemoryEventStore();
    const { dispatcher, memory } = createProviderDispatcher();
    const pipeline = new TrackingPipeline(store, dispatcher, undefined, TEST_PSEUDONYMISATION_KEY);
    const results = await Promise.all([pipeline.trackBatch([event]), pipeline.trackBatch([event])]);

    expect(results.flatMap((result) => result.accepted)).toHaveLength(1);
    expect(results.reduce((sum, result) => sum + result.duplicates, 0)).toBe(1);
    expect(store.all()).toHaveLength(1);
    expect(memory.snapshot()).toHaveLength(1);
  });

  it("treats an atomic store insert rejected by another instance as a duplicate", async () => {
    class ConcurrentWriteStore extends InMemoryEventStore {
      override append(incoming: Parameters<InMemoryEventStore["append"]>[0]): boolean {
        super.append(incoming);
        return false;
      }
    }

    const store = new ConcurrentWriteStore();
    const { dispatcher } = createProviderDispatcher();
    const pipeline = new TrackingPipeline(store, dispatcher, undefined, TEST_PSEUDONYMISATION_KEY);
    const result = await pipeline.trackBatch([event]);

    expect(result).toEqual({ accepted: [], dropped: 0, duplicates: 1 });
    expect(store.all()).toHaveLength(1);
  });

  it("preflights the whole batch before mutating storage", async () => {
    const store = new InMemoryEventStore();
    const { dispatcher } = createProviderDispatcher();
    const pipeline = new TrackingPipeline(store, dispatcher, undefined, TEST_PSEUDONYMISATION_KEY);

    await expect(
      pipeline.trackBatch([
        event,
        { ...event, eventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", properties: { email: "private@example.test" } },
      ]),
    ).rejects.toMatchObject({ code: "FORBIDDEN_DATA" });
    expect(store.all()).toHaveLength(0);
  });

  it("does not persist an event when a provider fails", async () => {
    const failingProvider: AnalyticsProvider = {
      name: "failing-provider",
      supportsIdempotency: true,
      track: async () => {
        throw new Error("provider offline");
      },
      deleteByUser: async () => undefined,
      deleteOlderThan: async () => undefined,
    };
    const store = new InMemoryEventStore();
    const pipeline = new TrackingPipeline(
      store,
      new ProviderDispatcher([failingProvider]),
      undefined,
      TEST_PSEUDONYMISATION_KEY,
    );

    await expect(pipeline.track(event)).rejects.toBeInstanceOf(ProviderDispatchError);
    expect(store.all()).toHaveLength(0);
  });
});
