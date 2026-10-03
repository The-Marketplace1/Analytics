import { afterEach, describe, expect, it } from "vitest";
import { createAnalyticsContext } from "../../src/api/context.js";
import type { EventStore } from "../../src/integrations/event-store.js";
import type { AnalyticsProvider } from "../../src/providers/contracts.js";

const TEST_PSEUDONYMISATION_KEY = "test-only-pseudonym-key-not-a-secret-0001";
const originalNodeEnvironment = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnvironment;
});

describe("production integration boundaries", () => {
  it("refuses ephemeral storage, in-memory providers, or missing trusted authorization", () => {
    process.env.NODE_ENV = "production";
    expect(() =>
      createAnalyticsContext({ pseudonymisationKey: TEST_PSEUDONYMISATION_KEY }),
    ).toThrow("injected durable EventStore");
  });

  it("accepts durable host-owned adapters without creating a database", () => {
    process.env.NODE_ENV = "production";
    const store: EventStore = {
      durability: "durable",
      append: () => true,
      get: () => undefined,
      all: () => [],
      deleteByUser: () => 0,
      deleteOlderThan: () => 0,
    };
    const provider: AnalyticsProvider = {
      name: "host-owned-provider",
      supportsIdempotency: true,
      track: async () => undefined,
      deleteByUser: async () => undefined,
      deleteOlderThan: async () => undefined,
    };

    expect(() =>
      createAnalyticsContext({
        store,
        providers: [provider],
        authorize: () => true,
        pseudonymisationKey: TEST_PSEUDONYMISATION_KEY,
      }),
    ).not.toThrow();
  });
});
