import { beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimit } from "@/lib/security/rateLimit";
import { addPantryItemSchema, generatePlanSchema, importRecipeSchema } from "@/lib/validation";

describe("rateLimit", () => {
  it("allows up to the limit then blocks until the window resets", () => {
    const k = `t-${Math.random()}`;
    expect(rateLimit(k, 2, 1000, 0)).toBe(true);
    expect(rateLimit(k, 2, 1000, 1)).toBe(true);
    expect(rateLimit(k, 2, 1000, 2)).toBe(false);
    expect(rateLimit(k, 2, 1000, 1001)).toBe(true);
  });
});

describe("validation schemas", () => {
  it("requires a url for import", () => {
    expect(importRecipeSchema.safeParse({ url: "" }).success).toBe(false);
    expect(importRecipeSchema.safeParse({ url: "https://x.com/r" }).success).toBe(true);
  });
  it("requires an ingredient identifier and a valid expiry for pantry items", () => {
    expect(addPantryItemSchema.safeParse({}).success).toBe(false);
    expect(addPantryItemSchema.safeParse({ name: "eggs", expiresAt: "not-a-date" }).success).toBe(false);
    expect(addPantryItemSchema.safeParse({ name: "eggs", expiresAt: "2026-10-01" }).success).toBe(true);
  });
  it("bounds plan parameters", () => {
    expect(generatePlanSchema.safeParse({ days: 0 }).success).toBe(false);
    expect(generatePlanSchema.safeParse({ days: 7, budget: 80 }).success).toBe(true);
    expect(generatePlanSchema.safeParse({}).success).toBe(true);
  });
});

describe("cron reset endpoint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/services/demoReset", () => ({ resetDemoUser: vi.fn().mockResolvedValue({ reset: true }) }));
  });
  const call = async (auth?: string) => {
    const { GET } = await import("@/app/api/cron/reset-demo/route");
    const req = new Request("http://x/api/cron/reset-demo", { headers: auth ? { authorization: auth } : {} });
    return GET(req as never);
  };

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer ")).status).toBe(401);
  });
  it("rejects a wrong secret and accepts the right one", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call("Bearer nope")).status).toBe(401);
    expect((await call("Bearer s3cret")).status).toBe(200);
  });
});
