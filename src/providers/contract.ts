import type { EnrichedAnalyticsEvent } from "../types/index.js";
import { ProviderDispatchError } from "../errors/index.js";

export interface AnalyticsProvider {
  readonly name: string;
  readonly supportsIdempotency: true;
  /** Must be idempotent by event.eventId to make retries and multi-instance delivery safe. */
  track(event: EnrichedAnalyticsEvent): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
  deleteOlderThan(cutoff: string): Promise<void>;
}

export class ProviderDispatcher {
  constructor(private readonly providers: AnalyticsProvider[]) {
    if (providers.length === 0) {
      throw new Error("At least one analytics provider must be configured");
    }
  }

  async track(event: EnrichedAnalyticsEvent): Promise<void> {
    const outcomes = await Promise.all(
      this.providers.map(async (provider) => {
        try {
        await provider.track(event);
          return { provider: provider.name, failed: false };
        } catch {
          return { provider: provider.name, failed: true };
        }
      }),
    );
    const failedProviders = outcomes.filter((outcome) => outcome.failed).map((outcome) => outcome.provider);
    if (failedProviders.length > 0) {
      throw new ProviderDispatchError(failedProviders);
    }
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.runProviderOperation((provider) => provider.deleteByUser(userId));
  }

  async deleteOlderThan(cutoff: string): Promise<void> {
    await this.runProviderOperation((provider) => provider.deleteOlderThan(cutoff));
  }

  private async runProviderOperation(
    operation: (provider: AnalyticsProvider) => Promise<void>,
  ): Promise<void> {
    const outcomes = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          await operation(provider);
          return { provider: provider.name, failed: false };
        } catch {
          return { provider: provider.name, failed: true };
        }
      }),
    );
    const failedProviders = outcomes.filter((outcome) => outcome.failed).map((outcome) => outcome.provider);
    if (failedProviders.length > 0) {
      throw new ProviderDispatchError(failedProviders);
    }
  }
}
