import { InMemoryEventStore } from "../integrations/event-store.js";
import type { EventStore } from "../integrations/event-store.js";
import { MemoryAnalyticsProvider } from "../providers/memory.js";
import { ProviderDispatcher, type AnalyticsProvider } from "../providers/contracts.js";
import { createRetentionPolicy } from "../retention/index.js";
import { TrackingPipeline } from "../tracking/pipeline.js";
import { denyByDefault, type AnalyticsAuthorizer } from "../authorization/index.js";

export interface AnalyticsDependencies {
  store?: EventStore;
  providers?: AnalyticsProvider[];
  authorize?: AnalyticsAuthorizer;
  pseudonymisationKey?: string;
}

export function createAnalyticsContext(dependencies: AnalyticsDependencies = {}) {
  const production = process.env.NODE_ENV === "production";
  const pseudonymisationKey =
    dependencies.pseudonymisationKey ?? process.env.ANALYTICS_PSEUDONYMISATION_KEY;

  if (
    production &&
    (!dependencies.store ||
      dependencies.store.durability !== "durable" ||
      !dependencies.providers?.length ||
      dependencies.providers.some((provider) => provider instanceof MemoryAnalyticsProvider) ||
      dependencies.providers.some((provider) => provider.supportsIdempotency !== true) ||
      !dependencies.authorize ||
      !pseudonymisationKey ||
      Buffer.byteLength(pseudonymisationKey, "utf8") < 32)
  ) {
    throw new Error(
      "Production Analytics requires an injected durable EventStore, provider, authorizer, and a pseudonymisation key of at least 32 bytes",
    );
  }

  const memory = dependencies.providers
    ? dependencies.providers.find(
        (provider): provider is MemoryAnalyticsProvider => provider instanceof MemoryAnalyticsProvider,
      )
    : new MemoryAnalyticsProvider();
  const store = dependencies.store ?? new InMemoryEventStore();
  const providers = dependencies.providers ?? (memory ? [memory] : []);
  const dispatcher = new ProviderDispatcher(providers);
  const authorizer = dependencies.authorize ?? denyByDefault;
  const pipeline = new TrackingPipeline(store, dispatcher, undefined, pseudonymisationKey);
  const retentionPolicy = createRetentionPolicy();
  return { store, memory, dispatcher, pipeline, retentionPolicy, authorizer, pseudonymisationKey };
}

export type AnalyticsContext = ReturnType<typeof createAnalyticsContext>;
