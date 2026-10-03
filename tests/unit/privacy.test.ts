import { describe, expect, it } from "vitest";
import { ForbiddenDataError } from "../../src/errors/index.js";
import { assertPrivacySafe, pseudonymise } from "../../src/privacy/policy.js";
import type { AnalyticsEvent } from "../../src/types/index.js";

const TEST_PSEUDONYMISATION_KEY = "test-only-pseudonym-key-not-a-secret-0001";

const event: AnalyticsEvent = {
  eventId: "11111111-1111-4111-8111-111111111111",
  eventType: "profile.viewed",
  version: 1,
  occurredAt: "2026-01-01T00:00:00.000Z",
  actor: { type: "customer", userId: "customer-1" },
  userId: "customer-1",
  platform: "web",
  application: "marketplace-web",
  environment: "test",
  properties: { region: "NG-LA" },
  consent: { analytics: true },
};

describe("privacy policy", () => {
  it("rejects secrets and sensitive payload fields", () => {
    expect(() =>
      assertPrivacySafe({ ...event, properties: { password: "not allowed" } }),
    ).toThrow(ForbiddenDataError);
    expect(() =>
      assertPrivacySafe({ ...event, properties: { nested: { privateMessage: "not allowed" } } }),
    ).toThrow(ForbiddenDataError);
    expect(() =>
      assertPrivacySafe({ ...event, properties: { coordinates: { lat: 6.5, lng: 3.3 } } }),
    ).toThrow(ForbiddenDataError);
    expect(() =>
      assertPrivacySafe({ ...event, properties: { supportField: "private.person@example.test" } }),
    ).toThrow(ForbiddenDataError);
    expect(() =>
      assertPrivacySafe({ ...event, properties: { supportField: "4242 4242 4242 4242" } }),
    ).toThrow(ForbiddenDataError);
    expect(() =>
      assertPrivacySafe({ ...event, properties: { region: "6.5244, 3.3792" } }),
    ).toThrow(ForbiddenDataError);
    expect(() =>
      assertPrivacySafe({ ...event, properties: { region: "Lagos" } }),
    ).toThrow(ForbiddenDataError);
  });

  it("pseudonymises deterministically without exposing the source identifier", () => {
    const first = pseudonymise("customer-1", TEST_PSEUDONYMISATION_KEY);
    expect(first).toBe(pseudonymise("customer-1", TEST_PSEUDONYMISATION_KEY));
    expect(first).not.toContain("customer-1");
    expect(first).toHaveLength(64);
    expect(() => pseudonymise("customer-1", undefined)).toThrowError(
      expect.objectContaining({ code: "PSEUDONYMISATION_NOT_CONFIGURED" }),
    );
  });
});
