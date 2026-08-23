import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Skillet — your personal food optimizer",
  description: "Discover meals you'll love, plan around your budget, and shop smarter.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fbf7f2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)] antialiased">
        <Nav />
        <main className="min-h-screen pb-20 md:ml-56 md:pb-0">{children}</main>
      </body>
    </html>
  );
}
