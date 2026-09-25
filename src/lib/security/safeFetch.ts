import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { LookupFunction } from "node:net";

/**
 * Server-side fetching of USER-SUPPLIED URLs (recipe import) without becoming an SSRF gadget or
 * a generic proxy.
 *
 * Defences, in request order:
 *  1. URL syntax: http/https only, no embedded credentials, only ports 80/443, bounded length.
 *  2. IP-literal hosts are checked directly. (WHATWG URL parsing already normalizes decimal, hex,
 *     octal and short IPv4 forms such as http://2130706433/ or http://127.1/ to dotted-decimal, and
 *     IPv4-mapped IPv6 such as [::ffff:127.0.0.1] to hex form, so those are caught by the same check.)
 *  3. Hostnames are resolved by OUR lookup function at CONNECT time and every returned address must
 *     be public. Because the socket connects to the address we validated (not to a second, separate
 *     DNS answer) DNS rebinding cannot swap in an internal address after the check.
 *  4. Redirects are followed manually (max 3) and every hop repeats steps 1-3.
 *  5. Total deadline, per-hop timeout, HTML-only content type, no compressed bodies (so no
 *     decompression bombs), and a hard cap on bytes read.
 *  6. The response body is only parsed for structured recipe data by the caller; it is never
 *     returned to the client verbatim, and errors do not reveal what an internal host answered.
 */

export const MAX_REDIRECTS = 3;
export const TOTAL_TIMEOUT_MS = 8000;
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_URL_LENGTH = 2048;

export class UnsafeUrlError extends Error {
  constructor(message = "That address isn't allowed.") {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

// ---- reserved / non-public address ranges (IANA special-purpose registries) -----------------
const blocked = new net.BlockList();
const V4: [string, number][] = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay (deprecated)
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved (incl. broadcast)
];
const V6: [string, number][] = [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  // NOTE: no ::ffff:0:0/96 rule. BlockList evaluates plain IPv4 as IPv4-mapped IPv6, so that rule would
  // block every IPv4 address. IPv4-mapped IPv6 inputs (::ffff:127.0.0.1, ::ffff:7f00:1) are checked
  // against the IPv4 rules above automatically (covered by tests).
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard-only
  ["2001::", 23], // IETF protocol assignments incl. Teredo 2001::/32
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 (embeds an IPv4 address)
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // deprecated site-local
  ["ff00::", 8], // multicast
];
for (const [addr, prefix] of V4) blocked.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of V6) blocked.addSubnet(addr, prefix, "ipv6");

/** True for loopback, private, link-local, metadata, multicast, reserved and other non-public addresses. */
export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return true; // not an IP at all: refuse
  return blocked.check(ip, family === 6 ? "ipv6" : "ipv4");
}

/** Syntax-level checks that need no network. Throws UnsafeUrlError. */
export function assertSafeUrl(url: URL): void {
  if (url.href.length > MAX_URL_LENGTH) throw new UnsafeUrlError("That link is too long.");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http/https URLs are supported.");
  if (url.username || url.password) throw new UnsafeUrlError();
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") throw new UnsafeUrlError();

  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host) throw new UnsafeUrlError();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError();
  }
  // IP literals never go through DNS lookup, so check them here.
  if (net.isIP(host) !== 0 && isBlockedAddress(host)) throw new UnsafeUrlError();
}

/**
 * A `lookup` function for http(s).request that refuses to connect unless EVERY address the name
 * resolves to is public. Node calls it when opening the socket and connects to the address it
 * returns, which is what closes the DNS-rebinding window.
 */
export function createGuardedLookup(resolver: typeof dns.lookup = dns.lookup): LookupFunction {
  return (hostname, options, callback) => {
    const opts = typeof options === "number" ? { family: options } : (options ?? {});
    resolver(hostname, { ...opts, all: true, verbatim: true }, (err, addresses) => {
      const list = (addresses ?? []) as dns.LookupAddress[];
      if (err) return callback(err, "", 4);
      if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
        return callback(new UnsafeUrlError() as NodeJS.ErrnoException, "", 4);
      }
      if ((opts as { all?: boolean }).all) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (callback as any)(null, list);
      }
      return callback(null, list[0].address, list[0].family);
    });
  };
}

// ---- transport (injectable so tests need no network) ------------------------------------------
export type TransportResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array> & { destroy?: (e?: Error) => void };
};
export type Transport = (
  url: URL,
  opts: { headers: Record<string, string>; timeoutMs: number; lookup: LookupFunction },
) => Promise<TransportResponse>;

const nodeTransport: Transport = (url, { headers, timeoutMs, lookup }) =>
  new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, { method: "GET", headers, lookup, agent: false }, (res) =>
      resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res }),
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });

function firstHeader(h: TransportResponse["headers"], name: string): string {
  const v = h[name];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

async function readCapped(body: TransportResponse["body"], maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      body.destroy?.();
      throw new Error("That page is too large to import.");
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Fetch an HTML page from a user-supplied URL with all of the protections above. */
export async function safeFetchHtml(
  startUrl: URL,
  headers: Record<string, string>,
  deps: { transport?: Transport; lookup?: LookupFunction } = {},
): Promise<{ html: string; finalUrl: URL; status: number }> {
  const transport = deps.transport ?? nodeTransport;
  const lookup = deps.lookup ?? createGuardedLookup();
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const reqHeaders = { ...headers, "Accept-Encoding": "identity" }; // never receive compressed bodies

  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertSafeUrl(current);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("That page took too long to respond.");

    const res = await transport(current, { headers: reqHeaders, timeoutMs: remaining, lookup });

    const location = firstHeader(res.headers, "location");
    if (res.status >= 300 && res.status < 400 && location) {
      res.body.destroy?.();
      try {
        current = new URL(location, current);
      } catch {
        throw new UnsafeUrlError();
      }
      continue;
    }
    if (res.status < 200 || res.status >= 300) {
      res.body.destroy?.();
      return { html: "", finalUrl: current, status: res.status };
    }

    const type = firstHeader(res.headers, "content-type");
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      res.body.destroy?.();
      throw new Error("That link doesn't point to a web page.");
    }
    const encoding = firstHeader(res.headers, "content-encoding").toLowerCase();
    if (encoding && encoding !== "identity") {
      res.body.destroy?.();
      throw new Error("That page can't be imported.");
    }
    const declared = Number(firstHeader(res.headers, "content-length"));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      res.body.destroy?.();
      throw new Error("That page is too large to import.");
    }

    const html = await readCapped(res.body, MAX_BODY_BYTES);
    return { html, finalUrl: current, status: res.status };
  }
  throw new Error("Too many redirects.");
}
