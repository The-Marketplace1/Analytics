import { AnalyticsError } from "../errors/index.js";
import type { AnalyticsEvent } from "../types/index.js";

export function requireAnalyticsConsent(event: AnalyticsEvent): void {
  if (!event.consent.analytics) {
    throw new AnalyticsError("CONSENT_REQUIRED", "Analytics consent was not granted", 202);
  }
}
