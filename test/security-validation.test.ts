import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertPublicHttpUrl, isPrivateAddress, safeFetchHtml, MAX_BODY_BYTES } from "@/lib/security/safeFetch";
import { rateLimit } from "@/lib/security/rateLimit";
import { addPantryItemSchema, generatePlanSchema, importRecipeSchema } from "@/lib/validation";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("assertPublicHttpUrl", () => {
  it("rejects non-http schemes, localhost and private literals", async () => {
    await expect(assertPublicHttpUrl(new URL("file:///etc/passwd"))).rejects.toThrow();
    await expect(assertPublicHttpUrl(new URL("http://localhost:3000/x"))).rejects.toThrow();
    await expect(assertPublicHttpUrl(new URL("http://169.254.169.254/latest/meta-data"))).rejects.toThrow();
    await expect(assertPublicHttpUrl(new URL("http://[::1]/"))).rejects.toThrow();
  });
  it("accepts a public IP literal", async () => {
    await expect(assertPublicHttpUrl(new URL("https://93.184.216.34/recipe"))).resolves.toBeUndefined();
  });
});

describe("safeFetchHtml", () => {
  const html = (body: string, type = "text/html; charset=utf-8") =>
    new Response(body, { status: 200, headers: { "content-type": type } });
  const u = (s: string) => new URL(s);
  const ok = "https://93.184.216.34/a";

  it("returns the page body", async () => {
    const f = vi.fn().mockResolvedValue(html("<p>hi</p>"));
    const r = await safeFetchHtml(u(ok), {}, f as never);
    expect(r.html).toBe("<p>hi</p>");
  });
  it("blocks a redirect to a private address", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }));
    await expect(safeFetchHtml(u(ok), {}, f as never)).rejects.toThrow(/isn't allowed/);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("stops after too many redirects", async () => {
    const f = vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://93.184.216.34/b" } }));
    await expect(safeFetchHtml(u(ok), {}, f as never)).rejects.toThrow(/redirects/);
  });
  it("rejects non-HTML content types", async () => {
    const f = vi.fn().mockResolvedValue(html("{}", "application/json"));
    await expect(safeFetchHtml(u(ok), {}, f as never)).rejects.toThrow(/web page/);
  });
  it("rejects bodies over the size cap", async () => {
    const f = vi.fn().mockResolvedValue(html("x".repeat(MAX_BODY_BYTES + 10)));
    await expect(safeFetchHtml(u(ok), {}, f as never)).rejects.toThrow(/too large/);
  });
  it("reports non-OK statuses without a body", async () => {
    const f = vi.fn().mockResolvedValue(new Response("nope", { status: 403 }));
    const r = await safeFetchHtml(u(ok), {}, f as never);
    expect(r).toMatchObject({ html: "", status: 403 });
  });
});

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
