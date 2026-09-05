"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, Home, Compass, Search, Calendar, ShoppingCart, Refrigerator, User, type LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/plan", label: "Plan", icon: Calendar },
  { href: "/grocery", label: "Grocery", icon: ShoppingCart },
  { href: "/pantry", label: "Pantry", icon: Refrigerator },
  { href: "/profile", label: "Profile", icon: User },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-between border-t border-[var(--color-line)] bg-white/95 backdrop-blur px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium"
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.25 : 1.75}
                className={`transition-transform ${active ? "scale-110 text-[var(--color-coral)]" : "text-[var(--color-ink-soft)] opacity-60"}`}
              />
              <span className={active ? "text-[var(--color-coral)]" : "text-[var(--color-ink-soft)]"}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar */}
      <nav className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-[var(--color-line)] bg-white px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <ChefHat size={24} strokeWidth={1.75} className="text-[var(--color-coral)]" />
          <span className="text-lg font-bold tracking-tight">Skillet</span>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-[var(--color-coral-light)] text-[var(--color-coral-dark)]" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
