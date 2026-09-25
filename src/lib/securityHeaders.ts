import { ALLOWED_IMAGE_HOSTS } from "./imageHosts";

export type HeaderEntry = { key: string; value: string };

/**
 * Baseline response headers for every route.
 *  - CSP img-src:       browsers may only load images from this site and the allowed image hosts
 *  - nosniff:           browsers must not guess a different content type
 *  - X-Frame-Options:   the app can't be embedded in another site (clickjacking)
 *  - Referrer-Policy:   don't leak full URLs to other sites
 *  - Permissions-Policy: camera stays available to this origin only (barcode scanning); the rest is off
 * A full Content-Security-Policy is a future improvement (needs nonces for Next's inline scripts).
 */
export const SECURITY_HEADERS: HeaderEntry[] = [
  {
    key: "Content-Security-Policy",
    value: `img-src 'self' data: blob: ${ALLOWED_IMAGE_HOSTS.map((h) => `https://${h}`).join(" ")}`,
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];
