import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createApp } from "../../src/app/index.js";

describe("health endpoint", () => {
  it("reports a ready analytics pipeline", async () => {
    const { app } = createApp();
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "analytics",
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
