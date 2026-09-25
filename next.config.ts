import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./src/lib/imageHosts";

const nextConfig: NextConfig = {
  images: {
    // Smallest practical allowlist (was `hostname: "**"`, which let /_next/image fetch and
    // re-serve images from ANY https host). Keep in sync via src/lib/imageHosts.ts.
    remotePatterns: ALLOWED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Browsers may only load images from this site and the allowed image hosts.
          { key: "Content-Security-Policy", value: `img-src 'self' data: blob: ${ALLOWED_IMAGE_HOSTS.map((h) => `https://${h}`).join(" ")}` },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
