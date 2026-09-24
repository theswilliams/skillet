import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Guards for fetching user-supplied URLs on the server (recipe import).
 * Blocks non-http(s) schemes, private/loopback/link-local addresses (including
 * after redirects), slow responses and oversized bodies.
 *
 * Limitation: the address is resolved here and again by `fetch`, so a
 * DNS-rebinding attacker could in theory swap the answer in between. Pinning
 * the resolved IP would need a custom agent; not done here.
 */

export const MAX_REDIRECTS = 3;
export const FETCH_TIMEOUT_MS = 8000;
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast / reserved
    );
  }
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return v.startsWith("::ffff:"); // other IPv4-mapped forms: refuse
}

export async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("That address isn't allowed.");
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That address isn't allowed.");
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("That page is too large to import.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Fetch an HTML page with SSRF, redirect, timeout, content-type and size limits. */
export async function safeFetchHtml(
  startUrl: URL,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ html: string; finalUrl: URL; status: number }> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHttpUrl(current);
    const res = await fetchImpl(current.toString(), {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      continue;
    }
    if (!res.ok) return { html: "", finalUrl: current, status: res.status };
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      throw new Error("That link doesn't point to a web page.");
    }
    return { html: await readCapped(res, MAX_BODY_BYTES), finalUrl: current, status: res.status };
  }
  throw new Error("Too many redirects.");
}
