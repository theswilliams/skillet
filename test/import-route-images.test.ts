import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeFetchHtml: vi.fn(),
  db: {
    ingredient: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    recipe: { findUnique: vi.fn(), create: vi.fn() },
    recipeIngredient: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: mocks.db }));
vi.mock("@/lib/currentUser", () => ({ getCurrentUserId: async () => "demo-user" }));
vi.mock("@/lib/serialize", () => ({ serializeRecipe: (r: unknown) => r }));

// Wrap the real safeFetch module so only the network call (safeFetchHtml) is replaced: URL
// validation stays real for the route-level tests below.
vi.mock("@/lib/security/safeFetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/safeFetch")>();
  return {
    ...actual,
    safeFetchHtml: (url: URL, headers: Record<string, string>, deps?: unknown) => {
      // Real syntax/IP-literal validation first, exactly like the real function's first step.
      actual.assertSafeUrl(url);
      return mocks.safeFetchHtml(url, headers, deps);
    },
  };
});

import { POST as importRecipe } from "@/app/api/recipes/import/route";
import { ALLOWED_IMAGE_HOSTS, isAllowedImageUrl } from "@/lib/imageHosts";

const post = (body: unknown, ip = "203.0.113.9") =>
  new Request("http://localhost/api/recipes/import", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

const recipePage = (image: string) => `<html><head><script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Test Pasta",
  image,
  recipeIngredient: ["200 g pasta", "1 tbsp olive oil"],
  recipeInstructions: ["Boil pasta."],
  recipeYield: "2",
})}</script></head></html>`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.recipe.findUnique.mockResolvedValue(null);
  mocks.db.ingredient.findFirst.mockResolvedValue({ id: "ing", name: "pasta" });
  mocks.db.ingredient.findMany.mockResolvedValue([]);
  mocks.db.recipe.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "r1", ...data, ingredients: [] }));
});

describe("POST /api/recipes/import: SSRF at the HTTP boundary", () => {
  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://2130706433/",
    "file:///etc/passwd",
    "ftp://example.com/",
    "https://user:pass@example.com/",
    "http://example.com:8080/",
  ])("returns 422 and makes no outbound request for %s", async (url) => {
    const res = await importRecipe(post({ url }, `198.51.100.${Math.floor(Math.random() * 200)}`) as never);
    expect(res.status).toBe(422);
    expect(mocks.safeFetchHtml).not.toHaveBeenCalled();
    expect(mocks.db.recipe.create).not.toHaveBeenCalled();
  });

  it("does not reveal internal details in the error message", async () => {
    const res = await importRecipe(post({ url: "http://169.254.169.254/" }, "198.51.100.201") as never);
    const body = await res.json();
    expect(body.error).toBe("That address isn't allowed.");
  });

  it("rejects malformed bodies with 400", async () => {
    expect((await importRecipe(post({}, "198.51.100.202") as never)).status).toBe(400);
    expect((await importRecipe(post({ url: 42 }, "198.51.100.203") as never)).status).toBe(400);
  });

  it("rate-limits repeated imports from one client", async () => {
    let last = 200;
    for (let i = 0; i < 12; i++) last = (await importRecipe(post({ url: "http://127.0.0.1/" }, "198.51.100.250") as never)).status;
    expect(last).toBe(429);
  });

  it("imports a public page and passes the fetch through the guarded fetcher", async () => {
    mocks.safeFetchHtml.mockResolvedValue({
      html: recipePage("https://upload.wikimedia.org/wikipedia/commons/a/a1/pasta.jpg"),
      finalUrl: new URL("https://93.184.216.34/pasta"),
      status: 200,
    });
    const res = await importRecipe(post({ url: "https://93.184.216.34/pasta" }, "198.51.100.204") as never);
    expect(res.status).toBeLessThan(300);
    expect(mocks.safeFetchHtml).toHaveBeenCalledTimes(1);
  });
});

describe("imported recipe images", () => {
  const importWithImage = async (image: string, ip: string) => {
    mocks.safeFetchHtml.mockResolvedValue({ html: recipePage(image), finalUrl: new URL("https://93.184.216.34/pasta"), status: 200 });
    await importRecipe(post({ url: "https://93.184.216.34/pasta" }, ip) as never);
    return mocks.db.recipe.create.mock.calls.at(-1)?.[0].data.imageUrl as string | null;
  };

  it("keeps an image from an allow-listed host", async () => {
    expect(await importWithImage("https://upload.wikimedia.org/wikipedia/commons/a/a1/pasta.jpg", "198.51.100.205")).toMatch(/upload\.wikimedia\.org/);
  });

  it.each([
    "https://tracker.evil.example/pixel.gif",
    "http://upload.wikimedia.org/x.jpg",
    "https://upload.wikimedia.org.evil.example/x.jpg",
    "http://169.254.169.254/latest/meta-data",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
  ])("drops the image %s so visitors' browsers never load it", async (image) => {
    expect(await importWithImage(image, "198.51.100.206")).toBeNull();
  });
});

describe("image allowlist and Next.js config", () => {
  it("isAllowedImageUrl is strict about scheme, host and credentials", () => {
    expect(isAllowedImageUrl("https://upload.wikimedia.org/a.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://user@upload.wikimedia.org/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://wikimedia.org/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("not a url")).toBe(false);
    expect(isAllowedImageUrl(null)).toBe(false);
  });

  it("next.config has no wildcard image host and matches the allowlist exactly", async () => {
    const config = (await import("../next.config")).default;
    const patterns = config.images?.remotePatterns ?? [];
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      const host = (p as { hostname: string }).hostname;
      expect(host).not.toMatch(/\*/);
      expect((p as { protocol?: string }).protocol).toBe("https");
    }
    expect(patterns.map((p) => (p as { hostname: string }).hostname).sort()).toEqual([...ALLOWED_IMAGE_HOSTS].sort());
  });

  it("the CSP header restricts img-src to self and the allowlist only", async () => {
    const config = (await import("../next.config")).default;
    const headers = await config.headers!();
    const csp = headers[0].headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).toMatch(/^img-src 'self'/);
    expect(csp).not.toMatch(/\*|https:(?!\/\/upload)/);
    for (const host of ALLOWED_IMAGE_HOSTS) expect(csp).toContain(`https://${host}`);
  });

  it("every seeded recipe photo is served from an allow-listed host (so nothing breaks)", () => {
    const src = readFileSync("prisma/data/images.ts", "utf8");
    const urls = [...src.matchAll(/https?:\/\/[^"'\s)]+/g)].map((m) => m[0]);
    expect(urls.length).toBeGreaterThan(200);
    const bad = urls.filter((x) => !isAllowedImageUrl(x));
    expect(bad).toEqual([]);
  });
});

describe("import size bounds", () => {
  it("caps ingredient lines and instruction steps written from one page", async () => {
    const many = Array.from({ length: 500 }, (_, i) => `${i + 1} g ingredient number ${i}`);
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Huge",
      recipeIngredient: many,
      recipeInstructions: Array.from({ length: 500 }, (_, i) => `Step ${i}`),
    })}</script>`;
    mocks.safeFetchHtml.mockResolvedValue({ html, finalUrl: new URL("https://93.184.216.34/huge"), status: 200 });
    const { fetchAndParseRecipe, MAX_INGREDIENT_LINES, MAX_INSTRUCTION_STEPS } = await import("@/lib/services/recipeImport");
    const parsed = await fetchAndParseRecipe("https://93.184.216.34/huge");
    expect(parsed.ingredientLines).toHaveLength(MAX_INGREDIENT_LINES);
    expect(parsed.instructions.length).toBeLessThanOrEqual(MAX_INSTRUCTION_STEPS);
  });
});

describe("baseline security headers", () => {
  it("applies nosniff, framing and referrer protection to every route", async () => {
    const { SECURITY_HEADERS } = await import("@/lib/securityHeaders");
    const config = (await import("../next.config")).default;
    const all = (await config.headers!()).find((r) => r.source === "/:path*")!;
    expect(all.headers).toEqual(SECURITY_HEADERS);
    const v = (k: string) => SECURITY_HEADERS.find((h) => h.key === k)?.value;
    expect(v("X-Content-Type-Options")).toBe("nosniff");
    expect(v("X-Frame-Options")).toBe("DENY");
    expect(v("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(v("Permissions-Policy")).toMatch(/camera=\(self\)/);
  });
});
