import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createApp } from "../../src/app/index.js";
import type { AnalyticsRole } from "../../src/types/index.js";

const TEST_PSEUDONYMISATION_KEY = "test-only-pseudonym-key-not-a-secret-0001";
const testAuthorizer = (
  request: import("express").Request,
  roles: readonly AnalyticsRole[],
) => roles.includes(request.header("x-test-principal-role") as AnalyticsRole);

describe("end-to-end analytics flow", () => {
  it("ingests product events and returns a product conversion report", async () => {
    const { app } = createApp({
      authorize: testAuthorizer,
      pseudonymisationKey: TEST_PSEUDONYMISATION_KEY,
    });
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");

    const events = ["started", "completed"].map((stage, index) => ({
      eventId: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index + 1}`,
      eventType: `booking.${stage}`,
      version: 1,
      occurredAt: "2026-01-15T00:00:00.000Z",
      actor: { type: "customer", userId: "e2e-user" },
      userId: "e2e-user",
      sessionId: "e2e-session",
      platform: "web",
      application: "marketplace-web",
      environment: "production",
      properties: { region: "NG-LA" },
      consent: { analytics: true },
    }));

    const ingestion = await fetch(`http://127.0.0.1:${address.port}/v1/events/batch`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-principal-role": "ingest" },
      body: JSON.stringify({ events }),
    });
    expect(ingestion.status).toBe(202);

    const report = await fetch(`http://127.0.0.1:${address.port}/v1/reports/summary?environment=production`, {
      headers: { "x-test-principal-role": "analyst" },
    });
    expect(report.status).toBe(200);
    await expect(report.json()).resolves.toMatchObject({
      eventCount: 2,
      uniqueActors: 1,
      funnel: { bookingStarted: 1, bookingCompleted: 1, bookingConversionRate: 1 },
    });

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
