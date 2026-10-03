import { describe, expect, it } from "vitest";
import { requireAnalyticsConsent } from "../../src/consent/index.js";
import type { AnalyticsEvent } from "../../src/types/index.js";

const event: AnalyticsEvent = {
  eventId: "55555555-5555-4555-8555-555555555555",
  eventType: "feature.used",
  version: 1,
  occurredAt: "2026-01-01T00:00:00.000Z",
  actor: { type: "anonymous" },
  platform: "web",
  application: "marketplace-web",
  environment: "test",
  properties: {},
  consent: { analytics: false },
};

describe("consent enforcement", () => {
  it("blocks forwarding when analytics consent is false", () => {
    expect(() => requireAnalyticsConsent(event)).toThrow("Analytics consent was not granted");
  });
});
