import { describe, expect, it } from "vitest";
import { denyByDefault } from "../../src/authorization/index.js";

describe("analytics authorization", () => {
  it("fails closed until an upstream trusted authorizer is injected", () => {
    const request = { header: () => "admin" } as never;
    expect(denyByDefault(request, ["analyst", "admin"])).toBe(false);
    expect(denyByDefault(request, ["ingest", "admin"])).toBe(false);
  });
});
