"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Barcode, Refrigerator, CookingPot, Calendar, X } from "lucide-react";
import { Spinner, EmptyState, SecondaryButton, PrimaryButton } from "@/components/ui";
import { RecipeArt } from "@/components/RecipeArt";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { PantryItemDTO, RecipeDTO, PantryMatchDTO } from "@/lib/types";

type RecipeWithMatch = RecipeDTO & { pantryMatch?: PantryMatchDTO };

type Suggestion = { id: string; slug: string; name: string; category: string };

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

function expiryBadge(dateStr: string | null): { label: string; tone: "danger" | "warn" | "ok" } | null {
  if (!dateStr) return null;
  const days = daysUntil(dateStr);
  if (days < 0) return { label: "Expired", tone: "danger" };
  if (days === 0) return { label: "Today", tone: "danger" };
  if (days <= 3) return { label: `${days}d left`, tone: "warn" };
  return { label: `${days}d left`, tone: "ok" };
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItemDTO[] | null>(null);
  const [majorityMatchCount, setMajorityMatchCount] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [available, setAvailable] = useState<RecipeWithMatch[] | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [editingExpiryId, setEditingExpiryId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    fetch("/api/pantry")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items);
        setMajorityMatchCount(d.majorityMatchCount);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/ingredients?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.ingredients));
    }, 200);
  }, [query]);

  async function addIngredient(s: Suggestion) {
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredientId: s.id }),
    });
    setQuery("");
    setSuggestions([]);
    load();
  }

  async function addCustom() {
    if (!query.trim()) return;
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: query.trim() }),
    });
    setQuery("");
    setSuggestions([]);
    load();
  }

  async function removeItem(id: string) {
    setItems((its) => its && its.filter((i) => i.id !== id));
    await fetch(`/api/pantry/${id}`, { method: "DELETE" });
    load();
  }

  async function setExpiry(id: string, dateValue: string) {
    setEditingExpiryId(null);
    await fetch(`/api/pantry/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresAt: dateValue || null }),
    });
    load();
  }

  async function handleBarcodeDetected(barcode: string) {
    setScanBusy(true);
    const res = await fetch("/api/pantry/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });
    const data = await res.json();
    setScanBusy(false);
    setShowScanner(false);
    if (!res.ok) {
      setScanMessage(data.message ?? "Couldn't add that item.");
    } else {
      setScanMessage(`Added "${data.item.name}" to your pantry.`);
      load();
    }
    setTimeout(() => setScanMessage(null), 3000);
  }

  async function showAvailable() {
    setShowFilter(true);
    const res = await fetch("/api/recipes?availability=majority").then((r) => r.json());
    setAvailable(res.recipes);
  }

  if (!items) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-[var(--color-coral)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 sm:px-6">
      <h1 className="text-xl font-extrabold tracking-tight">Pantry</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Ingredients you already have on hand.</p>

      <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] card-shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-extrabold">{majorityMatchCount}</p>
            <p className="text-xs font-semibold text-[var(--color-ink-soft)]">recipes within reach right now</p>
          </div>
          <PrimaryButton onClick={showAvailable}>Use What I Have</PrimaryButton>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <SecondaryButton onClick={() => setShowScanner(true)} className="flex-1">
          <Barcode size={16} strokeWidth={2} /> Scan Barcode
        </SecondaryButton>
      </div>

      <div className="relative mt-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && suggestions.length === 0 && addCustom()}
          placeholder="Add an ingredient (e.g. chicken, rice, eggs)"
          className="w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--color-coral)]"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--color-line)] bg-white card-shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => addIngredient(s)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[var(--color-cream)]"
              >
                <span>{s.name}</span>
                <span className="text-xs text-[var(--color-ink-soft)]">{s.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Refrigerator size={36} strokeWidth={1.5} />} title="Your pantry is empty" subtitle="Add a few staples above to see what you can cook right now." />
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          {items
            .slice()
            .sort((a, b) => {
              if (a.expiresAt && b.expiresAt) return daysUntil(a.expiresAt) - daysUntil(b.expiresAt);
              if (a.expiresAt) return -1;
              if (b.expiresAt) return 1;
              return 0;
            })
            .map((item) => {
              const badge = expiryBadge(item.expiresAt);
              const badgeColor =
                badge?.tone === "danger" ? "bg-[var(--color-coral)] text-white" : badge?.tone === "warn" ? "bg-[var(--color-gold)] text-white" : "bg-[var(--color-mint-light)] text-[var(--color-mint)]";
              return (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium"
                >
                  {item.name}
                  {badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>{badge.label}</span>}
                  <button
                    onClick={() => setEditingExpiryId(editingExpiryId === item.id ? null : item.id)}
                    className="text-[var(--color-ink-soft)] hover:text-[var(--color-gold)]"
                    title="Set expiration date"
                  >
                    <Calendar size={14} strokeWidth={2} />
                  </button>
                  {editingExpiryId === item.id && (
                    <input
                      type="date"
                      autoFocus
                      defaultValue={item.expiresAt ? item.expiresAt.slice(0, 10) : ""}
                      onBlur={(e) => setExpiry(item.id, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && setExpiry(item.id, (e.target as HTMLInputElement).value)}
                      className="w-32 rounded border border-[var(--color-line)] px-1 text-xs outline-none"
                    />
                  )}
                  <button onClick={() => removeItem(item.id)} className="text-[var(--color-ink-soft)] hover:text-[var(--color-coral)]">
                    <X size={14} strokeWidth={2.25} />
                  </button>
                </span>
              );
            })}
        </div>
      )}

      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setShowFilter(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl bg-white p-4 md:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Recipes Within Reach</h3>
              <button onClick={() => setShowFilter(false)} className="text-[var(--color-ink-soft)]">
                <X size={20} strokeWidth={2.25} />
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
              Includes recipes where you have most of the main ingredients — protein, starch and the like — even if a spice or extra is missing.
            </p>
            <div className="mt-3 flex-1 overflow-y-auto">
              {!available ? (
                <div className="flex justify-center py-10">
                  <Spinner className="h-6 w-6 text-[var(--color-coral)]" />
                </div>
              ) : available.length === 0 ? (
                <EmptyState icon={<CookingPot size={36} strokeWidth={1.5} />} title="Nothing within reach yet" subtitle="Add a few more pantry staples, especially proteins and starches." />
              ) : (
                <div className="flex flex-col divide-y divide-[var(--color-line)]">
                  {available.map((r) => (
                    <Link key={r.id} href={`/recipe/${r.slug}`} className="flex items-center gap-3 py-2.5">
                      <RecipeArt hue={r.hue} emoji={r.emoji} imageUrl={r.imageUrl} size="sm" className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{r.name}</p>
                        <p className="text-xs text-[var(--color-ink-soft)]">
                          {r.totalMinutes}m · ${r.costPerServing.toFixed(2)}/serving
                        </p>
                        {r.pantryMatch && (
                          <p className={`text-xs font-medium ${r.pantryMatch.canMake ? "text-[var(--color-mint)]" : "text-[var(--color-gold)]"}`}>
                            {r.pantryMatch.canMake
                              ? "You have everything"
                              : `Missing: ${r.pantryMatch.missing.map((m) => m.name).join(", ")}`}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      {scanBusy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl bg-white p-6">
            <Spinner className="h-6 w-6 text-[var(--color-coral)]" />
          </div>
        </div>
      )}

      {scanMessage && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white md:bottom-6">
          {scanMessage}
        </div>
      )}
    </div>
  );
}
