"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RecipeArt } from "@/components/RecipeArt";
import { Chip, EmptyState, Spinner } from "@/components/ui";
import Link from "next/link";
import type { RecipeDTO } from "@/lib/types";

const CUISINES = ["Italian", "Mexican", "Chinese", "Japanese", "Korean", "Thai", "Indian", "Mediterranean", "American"];
const PROTEINS = ["chicken", "beef", "pork", "fish", "seafood", "vegetarian", "vegan"];
const EQUIPMENT = ["one-pan", "oven", "slow-cooker", "bbq"];
const DIETARY = ["high-protein", "low-carb", "vegetarian", "vegan", "gluten-free", "dairy-free"];
const TIME_OPTIONS = [
  { label: "Under 15 min", max: 15 },
  { label: "15–30 min", max: 30 },
  { label: "30–60 min", max: 60 },
  { label: "60+ min", max: undefined },
];
const COST_OPTIONS = [
  { label: "Under $2", max: 2 },
  { label: "Under $3", max: 3 },
  { label: "Under $5", max: 5 },
];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [protein, setProtein] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [dietary, setDietary] = useState<string | null>(null);
  const [maxMinutes, setMaxMinutes] = useState<number | undefined>(undefined);
  const [maxCost, setMaxCost] = useState<number | undefined>(undefined);
  const [recipes, setRecipes] = useState<RecipeDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (cuisine) params.set("cuisine", cuisine);
    if (protein) params.set("protein", protein);
    if (equipment) params.set("equipment", equipment);
    if (dietary) params.set("dietary", dietary);
    if (maxMinutes) params.set("maxMinutes", String(maxMinutes));
    if (maxCost) params.set("maxCostPerServing", String(maxCost));

    const useNlEndpoint = q.trim().split(" ").length > 3;
    const url = useNlEndpoint ? `/api/search?q=${encodeURIComponent(q.trim())}` : `/api/recipes?${params.toString()}`;

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setRecipes(d.recipes);
        setLoading(false);
      });
  }, [q, cuisine, protein, equipment, dietary, maxMinutes, maxCost]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSearch, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cuisine, protein, equipment, dietary, maxMinutes, maxCost]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6">
      <h1 className="text-xl font-extrabold tracking-tight">Search</h1>
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3">
        <span className="text-[var(--color-ink-soft)]">🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “cheap high-protein chicken dinners under 30 min”"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-ink-soft)]"
        />
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <FilterDropdownRow label="Cuisine" options={CUISINES} value={cuisine} onChange={setCuisine} tone="coral" />
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        <FilterDropdownRow label="Protein" options={PROTEINS} value={protein} onChange={setProtein} tone="mint" />
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {TIME_OPTIONS.map((t) => (
          <Chip key={t.label} active={maxMinutes === t.max} onClick={() => setMaxMinutes(maxMinutes === t.max ? undefined : t.max)} tone="gold">
            {t.label}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {COST_OPTIONS.map((c) => (
          <Chip key={c.label} active={maxCost === c.max} onClick={() => setMaxCost(maxCost === c.max ? undefined : c.max)} tone="coral">
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        <FilterDropdownRow label="Equipment" options={EQUIPMENT} value={equipment} onChange={setEquipment} tone="neutral" />
        <FilterDropdownRow label="Dietary" options={DIETARY} value={dietary} onChange={setDietary} tone="mint" />
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-[var(--color-coral)]" />
          </div>
        ) : !recipes || recipes.length === 0 ? (
          <EmptyState icon="🔎" title="No recipes match yet" subtitle="Try loosening a filter or searching a different term." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {recipes.map((r) => (
              <Link
                key={r.id}
                href={`/recipe/${r.slug}`}
                className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white card-shadow"
              >
                <RecipeArt hue={r.hue} emoji={r.emoji} imageUrl={r.imageUrl} size="sm" className="aspect-[4/3] w-full" />
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{r.name}</h3>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {r.totalMinutes}m · ${r.costPerServing.toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterDropdownRow({
  label,
  options,
  value,
  onChange,
  tone,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  tone: "coral" | "mint" | "gold" | "neutral";
}) {
  const toneClasses: Record<string, string> = {
    coral: "bg-[var(--color-coral-light)] text-[var(--color-coral-dark)]",
    mint: "bg-[var(--color-mint-light)] text-[var(--color-mint)]",
    gold: "bg-[var(--color-gold-light)] text-[var(--color-gold)]",
    neutral: "bg-white text-[var(--color-ink-soft)] border border-[var(--color-line)]",
  };
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold outline-none ${toneClasses[tone]}`}
    >
      <option value="">{label}: Any</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
