import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    ingredient: { findUnique: vi.fn(), upsert: vi.fn() },
    pantryItem: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: mocks.db }));
vi.mock("@/lib/currentUser", () => ({ getCurrentUserId: async () => "demo-user" }));

import { POST as scan } from "@/app/api/pantry/scan/route";

const post = (body: unknown, ip: string) =>
  new Request("http://localhost/api/pantry/scan", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

let ipCounter = 0;
const freshIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  mocks.db.ingredient.findUnique.mockResolvedValue(null);
  mocks.db.ingredient.upsert.mockResolvedValue({ id: "ing1", name: "Beans", category: "other", slug: "scan-123456789012" });
  mocks.db.pantryItem.upsert.mockResolvedValue({
    id: "p1", ingredientId: "ing1", expiresAt: null, ingredient: { name: "Beans", category: "other", slug: "scan-123456789012" },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/pantry/scan: the barcode can never change where the server connects", () => {
  it.each([
    "../../etc/passwd",
    "123456/../../admin",
    "12345678901234567890",
    "12345",
    "abcdef1234",
    "1234567890 1",
    "123456789012.json?evil=1",
    "http://169.254.169.254/",
    "١٢٣٤٥٦٧٨", // non-ASCII digits
    "",
  ])("rejects %j without making any outbound request", async (barcode) => {
    const res = await scan(post({ barcode }, freshIp()) as never);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-string and missing barcodes and malformed JSON", async () => {
    expect((await scan(post({ barcode: 123456789012 }, freshIp()) as never)).status).toBe(400);
    expect((await scan(post({}, freshIp()) as never)).status).toBe(400);
    const bad = new Request("http://localhost/api/pantry/scan", { method: "POST", body: "{not json", headers: { "x-forwarded-for": freshIp() } });
    expect((await scan(bad as never)).status).toBe(400);
  });

  it("looks up a valid barcode on the one fixed host, with a timeout and no redirect following", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 1, product: { product_name: "Black Beans" } }), { status: 200 }));
    const res = await scan(post({ barcode: "123456789012" }, freshIp()) as never);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://world.openfoodfacts.org/api/v2/product/123456789012.json");
    expect(new URL(calledUrl).hostname).toBe("world.openfoodfacts.org");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not call the third party at all for a barcode already in the catalog", async () => {
    mocks.db.ingredient.findUnique.mockResolvedValue({ id: "ing1", name: "Beans", category: "other", slug: "s" });
    await scan(post({ barcode: "123456789012" }, freshIp()) as never);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a clean 404 when the third party is down or slow (no crash, no hang)", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted", "TimeoutError"));
    const res = await scan(post({ barcode: "123456789012" }, freshIp()) as never);
    expect(res.status).toBe(404);
  });

  it("truncates an over-long third-party product name before storing it", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 1, product: { product_name: "A".repeat(5000) } }), { status: 200 }));
    await scan(post({ barcode: "123456789012" }, freshIp()) as never);
    expect(mocks.db.ingredient.upsert.mock.calls[0][0].create.name.length).toBeLessThanOrEqual(120);
  });

  it("rejects an invalid expiry date instead of failing in the database", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 1, product: { product_name: "Beans" } }), { status: 200 }));
    expect((await scan(post({ barcode: "123456789012", expiresAt: "not-a-date" }, freshIp()) as never)).status).toBe(400);
  });

  it("is rate-limited per client", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 0 }), { status: 200 }));
    const ip = "203.0.113.200";
    let last = 0;
    for (let i = 0; i < 35; i++) last = (await scan(post({ barcode: "123456789012" }, ip) as never)).status;
    expect(last).toBe(429);
  });
});
