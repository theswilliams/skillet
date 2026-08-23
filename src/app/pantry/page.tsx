"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Spinner, EmptyState, SecondaryButton, PrimaryButton } from "@/components/ui";
import { RecipeArt } from "@/components/RecipeArt";
import type { PantryItemDTO, RecipeDTO } from "@/lib/types";

type Suggestion = { id: string; slug: string; name: string; category: string };

export default function PantryPage() {
  const [items, setItems] = useState<PantryItemDTO[] | null>(null);
  const [makeableCount, setMakeableCount] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [available, setAvailable] = useState<RecipeDTO[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    fetch("/api/pantry")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items);
        setMakeableCount(d.makeableCount);
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

  async function showAvailable() {
    setShowFilter(true);
    const res = await fetch("/api/recipes?availability=have").then((r) => r.json());
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
            <p className="text-2xl font-extrabold">{makeableCount}</p>
            <p className="text-xs font-semibold text-[var(--color-ink-soft)]">recipes you can make right now</p>
          </div>
          <PrimaryButton onClick={showAvailable}>Use What I Have</PrimaryButton>
        </div>
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
        <EmptyState icon="🥫" title="Your pantry is empty" subtitle="Add a few staples above to see what you can cook right now." />
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium"
            >
              {item.name}
              <button onClick={() => removeItem(item.id)} className="text-[var(--color-ink-soft)] hover:text-[var(--color-coral)]">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setShowFilter(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl bg-white p-4 md:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Recipes you can make</h3>
              <button onClick={() => setShowFilter(false)} className="text-xl text-[var(--color-ink-soft)]">
                ✕
              </button>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto">
              {!available ? (
                <div className="flex justify-center py-10">
                  <Spinner className="h-6 w-6 text-[var(--color-coral)]" />
                </div>
              ) : available.length === 0 ? (
                <EmptyState icon="🍳" title="Nothing fully matches yet" subtitle="Add a few more pantry staples." />
              ) : (
                <div className="flex flex-col divide-y divide-[var(--color-line)]">
                  {available.map((r) => (
                    <Link key={r.id} href={`/recipe/${r.slug}`} className="flex items-center gap-3 py-2.5">
                      <RecipeArt hue={r.hue} emoji={r.emoji} imageUrl={r.imageUrl} size="sm" className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.name}</p>
                        <p className="text-xs text-[var(--color-ink-soft)]">
                          {r.totalMinutes}m · ${r.costPerServing.toFixed(2)}/serving
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
