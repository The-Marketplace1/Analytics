import { describe, expect, it } from "vitest";
import { MemoryAnalyticsProvider, ProviderDispatcher, type AnalyticsProvider } from "../../src/providers/index.js";
import type { EnrichedAnalyticsEvent } from "../../src/types/index.js";

const storedEvent: EnrichedAnalyticsEvent = {
  eventId: "44444444-4444-4444-8444-444444444444",
  eventType: "registration.completed",
  version: 1,
  occurredAt: "2026-01-01T00:00:00.000Z",
  actor: { type: "customer", userId: "hashed-user" },
  userId: "hashed-user",
  platform: "web",
  application: "marketplace-web",
  environment: "test",
  properties: {},
  consent: { analytics: true },
  enrichment: { productArea: "account", category: "account" },
};

describe("memory provider", () => {
  it("stores and deletes pseudonymised events through the provider boundary", async () => {
    const provider = new MemoryAnalyticsProvider();
    await provider.track(storedEvent);
    expect(provider.snapshot()).toHaveLength(1);
    await provider.deleteByUser("hashed-user");
    expect(provider.snapshot()).toHaveLength(0);
  });

  it("enforces retention through the provider boundary", async () => {
    const provider = new MemoryAnalyticsProvider();
    await provider.track(storedEvent);
    await provider.deleteOlderThan("2026-02-01T00:00:00.000Z");
    expect(provider.snapshot()).toHaveLength(0);
  });

  it("fans out through the provider contract and reports each failed provider", async () => {
    const successful: AnalyticsProvider = {
      name: "provider-a",
      supportsIdempotency: true,
      track: async () => undefined,
      deleteByUser: async () => undefined,
      deleteOlderThan: async () => undefined,
    };
    const failing: AnalyticsProvider = {
      name: "provider-b",
      supportsIdempotency: true,
      track: async () => {
        throw new Error("offline");
      },
      deleteByUser: async () => undefined,
      deleteOlderThan: async () => undefined,
    };
    const dispatcher = new ProviderDispatcher([successful, failing]);

    await expect(dispatcher.track(storedEvent)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      message: expect.stringContaining("provider-b"),
    });
  });
});
