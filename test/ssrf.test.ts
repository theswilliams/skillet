import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_BODY_BYTES,
  MAX_REDIRECTS,
  TOTAL_TIMEOUT_MS,
  UnsafeUrlError,
  assertSafeUrl,
  createGuardedLookup,
  isBlockedAddress,
  safeFetchHtml,
  type Transport,
  type TransportResponse,
} from "@/lib/security/safeFetch";

// ---- helpers -------------------------------------------------------------------------------
const PUBLIC = "https://93.184.216.34/recipe"; // public IP literal: needs no DNS
const u = (s: string) => new URL(s);

async function* chunks(...parts: (string | Uint8Array)[]) {
  for (const p of parts) yield typeof p === "string" ? new TextEncoder().encode(p) : p;
}
function response(
  over: { status?: number; type?: string; body?: string; headers?: TransportResponse["headers"] } = {},
): TransportResponse {
  return {
    status: over.status ?? 200,
    headers: over.headers ?? { "content-type": over.type ?? "text/html; charset=utf-8" },
    body: Object.assign(chunks(over.body ?? "<html></html>"), { destroy: vi.fn() }),
  };
}
const redirect = (to: string): TransportResponse => ({
  status: 302,
  headers: { location: to },
  body: Object.assign(chunks(""), { destroy: vi.fn() }),
});
const transportOf = (...responses: TransportResponse[]) => {
  const t = vi.fn<Transport>();
  responses.forEach((r) => t.mockResolvedValueOnce(r));
  return t;
};

// ---- address classification ---------------------------------------------------------------
describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1", "127.255.255.254", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255",
    "192.168.0.1", "192.168.255.255", "169.254.169.254", "169.254.0.1", "0.0.0.0", "100.64.0.1",
    "100.127.255.255", "224.0.0.1", "255.255.255.255", "240.0.0.1", "198.18.0.1", "192.0.2.5",
    "::", "::1", "fc00::1", "fd00:ec2::254", "fe80::1", "febf::1", "fec0::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.1.2.3", "::ffff:169.254.169.254",
    "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:db8::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2",
  ])("blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(["93.184.216.34", "8.8.8.8", "1.1.1.1", "172.32.0.1", "172.15.255.255", "100.63.255.255", "11.0.0.1", "2606:4700:4700::1111", "2a00:1450:4001:80b::200e"])(
    "allows public %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(false),
  );

  it("refuses anything that is not an IP address", () => {
    expect(isBlockedAddress("example.com")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

// ---- URL syntax -----------------------------------------------------------------------------
describe("assertSafeUrl", () => {
  it.each([
    "http://localhost/", "http://localhost:3000/x", "http://LOCALHOST/", "http://localhost./", "http://foo.localhost/",
    "http://127.0.0.1/", "http://127.1/", "http://2130706433/", "http://0x7f000001/", "http://0x7f.1/", "http://0177.0.0.1/", "http://0/",
    "http://[::1]/", "http://[::]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/", "http://[fd00::1]/",
    "http://10.0.0.5/", "http://172.16.5.5/", "http://192.168.1.1/", "http://100.64.1.1/",
    "http://169.254.169.254/latest/meta-data/", "http://[fd00:ec2::254]/", "http://metadata.google.internal/", "http://printer.local/", "http://db.internal/",
  ])("rejects %s", (raw) => expect(() => assertSafeUrl(u(raw))).toThrow(UnsafeUrlError));

  it.each(["file:///etc/passwd", "ftp://example.com/x", "gopher://example.com/", "javascript:alert(1)", "data:text/html,hi", "ws://example.com/"])(
    "rejects the protocol in %s",
    (raw) => expect(() => assertSafeUrl(u(raw))).toThrow(/http\/https|isn't allowed/),
  );

  it("rejects embedded credentials and non-web ports", () => {
    expect(() => assertSafeUrl(u("https://user:pw@example.com/"))).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl(u("https://good.example.com@127.0.0.1/"))).toThrow(UnsafeUrlError);
    for (const port of ["22", "25", "3306", "5432", "6379", "8080", "9200"]) {
      expect(() => assertSafeUrl(u(`https://example.com:${port}/`))).toThrow(UnsafeUrlError);
    }
  });

  it("rejects absurdly long URLs", () => {
    expect(() => assertSafeUrl(u("https://example.com/" + "a".repeat(3000)))).toThrow(/too long/);
  });

  it("accepts ordinary public URLs (hostnames are checked at connect time)", () => {
    expect(() => assertSafeUrl(u("https://www.food.com/recipe/1"))).not.toThrow();
    expect(() => assertSafeUrl(u("http://example.com/x"))).not.toThrow();
    expect(() => assertSafeUrl(u("https://example.com:443/x"))).not.toThrow();
    expect(() => assertSafeUrl(u(PUBLIC))).not.toThrow();
    expect(() => assertSafeUrl(u("https://[2606:4700:4700::1111]/"))).not.toThrow();
  });
});

// ---- guarded DNS lookup (rebinding defence) -----------------------------------------------
describe("createGuardedLookup", () => {
  type Answer = { address: string; family: number }[];
  const resolverOf = (...answers: (Answer | Error)[]) => {
    let i = 0;
    return ((_h: string, _o: unknown, cb: (e: Error | null, a?: Answer) => void) => {
      const a = answers[Math.min(i++, answers.length - 1)];
      if (a instanceof Error) cb(a);
      else cb(null, a);
    }) as never;
  };
  const run = (lookup: ReturnType<typeof createGuardedLookup>, opts: object = {}) =>
    new Promise<{ err: Error | null; address?: unknown }>((resolve) =>
      lookup("recipes.example.test", opts as never, ((err: Error | null, address: unknown) => resolve({ err, address })) as never),
    );

  it("returns a public address", async () => {
    const r = await run(createGuardedLookup(resolverOf([{ address: "93.184.216.34", family: 4 }])));
    expect(r.err).toBeNull();
    expect(r.address).toBe("93.184.216.34");
  });

  it("returns the list when the caller asks for all addresses (autoSelectFamily)", async () => {
    const list = [{ address: "93.184.216.34", family: 4 }];
    const r = await run(createGuardedLookup(resolverOf(list)), { all: true });
    expect(r.err).toBeNull();
    expect(r.address).toEqual(list);
  });

  it.each([
    ["loopback", [{ address: "127.0.0.1", family: 4 }]],
    ["metadata", [{ address: "169.254.169.254", family: 4 }]],
    ["private", [{ address: "10.0.0.7", family: 4 }]],
    ["private IPv6", [{ address: "fd00::1", family: 6 }]],
    ["IPv4-mapped loopback", [{ address: "::ffff:127.0.0.1", family: 6 }]],
    ["mixed public+private (one bad record poisons the answer)", [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.7", family: 4 }]],
    ["empty answer", []],
  ])("refuses a hostname that resolves to %s", async (_n, answer) => {
    const r = await run(createGuardedLookup(resolverOf(answer as Answer)));
    expect(r.err).toBeInstanceOf(UnsafeUrlError);
  });

  it("validates EVERY lookup independently, so an address that changes between lookups is caught (DNS rebinding)", async () => {
    const lookup = createGuardedLookup(
      resolverOf([{ address: "93.184.216.34", family: 4 }], [{ address: "127.0.0.1", family: 4 }]),
    );
    expect((await run(lookup)).err).toBeNull(); // first answer public: allowed
    expect((await run(lookup)).err).toBeInstanceOf(UnsafeUrlError); // rebound to loopback: refused
  });

  it("passes DNS errors through", async () => {
    const r = await run(createGuardedLookup(resolverOf(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }))));
    expect(r.err?.message).toMatch(/ENOTFOUND/);
  });
});

// ---- the real transport actually enforces the guard (no external network) ------------------
describe("safeFetchHtml with the real Node transport", () => {
  it("never connects when the hostname resolves to a loopback address (local server sees zero requests)", async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits++;
      res.end("<html>secret internal page</html>");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    try {
      // A name that "resolves" to the local server, exactly what a rebinding attacker arranges.
      const rebinding = createGuardedLookup(((_h: string, _o: unknown, cb: (e: null, a: unknown) => void) =>
        cb(null, [{ address: "127.0.0.1", family: 4 }])) as never);
      // Port 80 is the only allowed http port, so use assertSafeUrl-compliant URL; the connection
      // attempt is refused by the lookup before any socket is opened.
      await expect(safeFetchHtml(u("http://attacker-controlled.test/"), {}, { lookup: rebinding })).rejects.toThrow(/isn't allowed/);
      expect(hits).toBe(0);
      void port;
    } finally {
      server.close();
    }
  });
});

// ---- redirects -----------------------------------------------------------------------------
describe("safeFetchHtml: redirects", () => {
  it("returns a normal page", async () => {
    const t = transportOf(response({ body: "<p>hi</p>" }));
    const r = await safeFetchHtml(u(PUBLIC), {}, { transport: t });
    expect(r.html).toBe("<p>hi</p>");
    expect(r.finalUrl.href).toBe(PUBLIC);
  });

  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1/admin",
    "http://localhost/",
    "http://[::1]/",
    "http://2130706433/",
    "http://10.0.0.5/internal",
    "http://[fd00::1]/",
    "file:///etc/passwd",
    "http://internal.corp.internal/",
  ])("blocks a safe URL that redirects to %s, without ever requesting it", async (target) => {
    const t = transportOf(redirect(target), response({ body: "SHOULD NEVER BE FETCHED" }));
    await expect(safeFetchHtml(u(PUBLIC), {}, { transport: t })).rejects.toThrow();
    expect(t).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect that only becomes internal on the second hop", async () => {
    const t = transportOf(redirect("https://93.184.216.35/next"), redirect("http://169.254.169.254/"), response());
    await expect(safeFetchHtml(u(PUBLIC), {}, { transport: t })).rejects.toThrow(UnsafeUrlError);
    expect(t).toHaveBeenCalledTimes(2);
  });

  it("follows a same-host relative redirect and reports the final URL", async () => {
    const t = transportOf(redirect("/moved"), response({ body: "ok" }));
    const r = await safeFetchHtml(u(PUBLIC), {}, { transport: t });
    expect(r.finalUrl.href).toBe("https://93.184.216.34/moved");
  });

  it(`stops after ${MAX_REDIRECTS} redirects`, async () => {
    const t = vi.fn<Transport>().mockImplementation(async () => redirect("https://93.184.216.34/loop"));
    await expect(safeFetchHtml(u(PUBLIC), {}, { transport: t })).rejects.toThrow(/redirects/);
    expect(t).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it("rejects an unparseable Location header", async () => {
    const t = transportOf(redirect("http://[bad"));
    await expect(safeFetchHtml(u(PUBLIC), {}, { transport: t })).rejects.toThrow(UnsafeUrlError);
  });
});

// ---- resource limits and response handling -----------------------------------------------
describe("safeFetchHtml: limits", () => {
  it("does not act as a generic proxy: rejects non-HTML content types", async () => {
    for (const type of ["application/json", "application/octet-stream", "image/png", "text/plain", "application/pdf"]) {
      const t = transportOf(response({ type, body: "{}" }));
      await expect(safeFetchHtml(u(PUBLIC), {}, { transport: t })).rejects.toThrow(/web page/);
    }
  });

  it("rejects declared oversize bodies without reading them", async () => {
    const res = response({ headers: { "content-type": "text/html", "content-length": String(MAX_BODY_BYTES + 1) } });
    const t = transportOf(res);
    await expect(safeFetchHtml(u(PUBLIC), {}, { transport: t })).rejects.toThrow(/too large/);
  });

  it("aborts a streaming body that exceeds the cap (lying or missing Content-Length)", async () => {
    const big = new Uint8Array(MAX_BODY_BYTES / 2 + 1);
    const destroy = vi.fn();
    const res: TransportResponse = {
      status: 200,
      headers: { "content-type": "text/html" },
      body: Object.assign(chunks(big, big, big), { destroy }),
    };
    await expect(safeFetchHtml(u(PUBLIC), {}, { transport: transportOf(res) })).rejects.toThrow(/too large/);
    expect(destroy).toHaveBeenCalled();
  });

  it("asks for uncompressed content and refuses compressed responses (no decompression bombs)", async () => {
    const t = transportOf(response({ headers: { "content-type": "text/html", "content-encoding": "gzip" } }));
    await expect(safeFetchHtml(u(PUBLIC), { "User-Agent": "x" }, { transport: t })).rejects.toThrow(/can't be imported/);
    expect(t.mock.calls[0][1].headers["Accept-Encoding"]).toBe("identity");
    expect(t.mock.calls[0][1].headers["User-Agent"]).toBe("x");
  });

  it("does not return the body of error responses (nothing about what a host answered leaks)", async () => {
    const t = transportOf(response({ status: 403, body: "internal admin panel text" }));
    const r = await safeFetchHtml(u(PUBLIC), {}, { transport: t });
    expect(r).toMatchObject({ html: "", status: 403 });
  });

  it("gives each hop only the remaining time budget", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const t = vi.fn<Transport>()
        .mockImplementationOnce(async () => {
          vi.setSystemTime(TOTAL_TIMEOUT_MS - 1000);
          return redirect("https://93.184.216.34/b");
        })
        .mockImplementationOnce(async () => response());
      await safeFetchHtml(u(PUBLIC), {}, { transport: t });
      expect(t.mock.calls[0][1].timeoutMs).toBe(TOTAL_TIMEOUT_MS);
      expect(t.mock.calls[1][1].timeoutMs).toBe(1000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails once the total deadline has passed", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const t = vi.fn<Transport>().mockImplementationOnce(async () => {
        vi.setSystemTime(TOTAL_TIMEOUT_MS + 1);
        return redirect("https://93.184.216.34/b");
      });
      await expect(safeFetchHtml(u(PUBLIC), {}, { transport: t })).rejects.toThrow(/too long/);
      expect(t).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
