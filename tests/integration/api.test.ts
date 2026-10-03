import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp } from "../../src/app/index.js";
import type { AnalyticsRole } from "../../src/types/index.js";

const TEST_PSEUDONYMISATION_KEY = "test-only-pseudonym-key-not-a-secret-0001";
const testAuthorizer = (
  request: import("express").Request,
  roles: readonly AnalyticsRole[],
) => roles.includes(request.header("x-test-principal-role") as AnalyticsRole);

const validEvent = {
  eventId: "22222222-2222-4222-8222-222222222222",
  eventType: "booking.started",
  version: 1,
  occurredAt: "2026-01-01T00:00:00.000Z",
  actor: { type: "customer", userId: "customer-2" },
  userId: "customer-2",
  sessionId: "session-2",
  platform: "web",
  application: "marketplace-web",
  environment: "test",
  properties: { region: "NG-LA" },
  consent: { analytics: true },
};

let server: Server | undefined;
let runningApp: ReturnType<typeof createApp> | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
  runningApp = undefined;
});

async function request(path: string, init?: RequestInit): Promise<Response> {
  runningApp ??= createApp({
    authorize: testAuthorizer,
    pseudonymisationKey: TEST_PSEUDONYMISATION_KEY,
  });
  server ??= createServer(runningApp.app);
  if (server.listening === false) {
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", () => resolve()));
  }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-test-principal-role": "admin",
      ...(init?.headers ?? {}),
    },
  });
}

describe("analytics API", () => {
  it("accepts a validated event batch and exposes authorised reporting", async () => {
    const ingestion = await request("/v1/events/batch", {
      method: "POST",
      body: JSON.stringify({ events: [validEvent] }),
    });
    expect(ingestion.status).toBe(202);
    expect(await ingestion.json()).toEqual({
      accepted: [validEvent.eventId],
      dropped: 0,
      duplicates: 0,
    });

    const report = await request("/v1/reports/summary", {
      headers: { "x-test-principal-role": "analyst" },
    });
    expect(report.status).toBe(200);
    await expect(report.json()).resolves.toMatchObject({
      eventCount: 1,
      uniqueActors: 1,
      funnel: { bookingStarted: 1, bookingCompleted: 0 },
    });
  });

  it("supports idempotent ingestion and authorised deletion", async () => {
    const first = await request("/v1/events/batch", {
      method: "POST",
      body: JSON.stringify({ events: [validEvent] }),
    });
    expect(first.status).toBe(202);

    const duplicate = await request("/v1/events/batch", {
      method: "POST",
      body: JSON.stringify({ events: [validEvent] }),
    });
    expect(duplicate.status).toBe(202);
    await expect(duplicate.json()).resolves.toMatchObject({ accepted: [], duplicates: 1 });

    const deletion = await request("/v1/privacy/deletion-requests", {
      method: "POST",
      headers: { "x-test-principal-role": "admin" },
      body: JSON.stringify({ userId: validEvent.userId }),
    });
    expect(deletion.status).toBe(202);
    await expect(deletion.json()).resolves.toEqual({ deleted: 1 });
  });

  it("does not expose reporting to end users", async () => {
    const response = await request("/v1/reports/summary", {
      headers: { "x-test-principal-role": "customer" },
    });
    expect(response.status).toBe(403);
  });

  it("keeps retention administration behind the admin boundary", async () => {
    const response = await request("/v1/privacy/retention/purge", {
      method: "POST",
      headers: { "x-test-principal-role": "analyst" },
    });
    expect(response.status).toBe(403);
  });

  it("does not trust a client-supplied analytics role header", async () => {
    const app = createApp({ pseudonymisationKey: TEST_PSEUDONYMISATION_KEY });
    const untrustedServer = createServer(app.app);
    await new Promise<void>((resolve) => untrustedServer.listen(0, "127.0.0.1", () => resolve()));
    const address = untrustedServer.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/reports/summary`, {
      headers: { "x-analytics-role": "admin" },
    });
    expect(response.status).toBe(403);
    await new Promise<void>((resolve) => untrustedServer.close(() => resolve()));
  });
});
