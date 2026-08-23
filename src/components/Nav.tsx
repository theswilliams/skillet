"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/discover", label: "Discover", icon: "🔥" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/plan", label: "Plan", icon: "📅" },
  { href: "/grocery", label: "Grocery", icon: "🛒" },
  { href: "/pantry", label: "Pantry", icon: "🥫" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-between border-t border-[var(--color-line)] bg-white/95 backdrop-blur px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium"
            >
              <span className={`text-lg leading-none transition-transform ${active ? "scale-110" : "opacity-50"}`}>{item.icon}</span>
              <span className={active ? "text-[var(--color-coral)]" : "text-[var(--color-ink-soft)]"}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar */}
      <nav className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-[var(--color-line)] bg-white px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="text-2xl">🍳</span>
          <span className="text-lg font-bold tracking-tight">Skillet</span>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-[var(--color-coral-light)] text-[var(--color-coral-dark)]" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
