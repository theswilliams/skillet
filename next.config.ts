import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./src/lib/imageHosts";
import { SECURITY_HEADERS } from "./src/lib/securityHeaders";

const nextConfig: NextConfig = {
  images: {
    // Smallest practical allowlist (was `hostname: "**"`, which let /_next/image fetch and
    // re-serve images from ANY https host). Keep in sync via src/lib/imageHosts.ts.
    remotePatterns: ALLOWED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
