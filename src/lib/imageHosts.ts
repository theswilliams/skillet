/**
 * Remote image hosts the app may load. Single source of truth for:
 *  - next.config.ts (`images.remotePatterns`: what /_next/image will fetch),
 *  - the recipe importer (which imported image URLs are kept),
 *  - the Content-Security-Policy `img-src` directive.
 *
 * Every seeded recipe photo comes from Wikimedia Commons. Images from other hosts on imported
 * recipes are deliberately dropped (the card falls back to its gradient) instead of being loaded
 * from arbitrary third-party servers in every visitor's browser.
 */
export const ALLOWED_IMAGE_HOSTS = ["upload.wikimedia.org"] as const;

export function isAllowedImageUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(u.hostname);
  } catch {
    return false;
  }
}
