"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, Search, SearchX, X } from "lucide-react";
import { RecipeArt } from "@/components/RecipeArt";
import { Chip, EmptyState, Spinner, PrimaryButton, SecondaryButton } from "@/components/ui";
import Link from "next/link";
import type { RecipeDTO } from "@/lib/types";

const CUISINES = ["Italian", "Mexican", "Chinese", "Japanese", "Korean", "Thai", "Indian", "Mediterranean", "American", "French", "Spanish", "Vietnamese", "Filipino", "Caribbean", "African", "German", "Brazilian"];
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
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Search</h1>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-coral)] underline underline-offset-2"
        >
          <LinkIcon size={13} strokeWidth={2.25} /> Import from URL
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3">
        <Search size={16} strokeWidth={2} className="shrink-0 text-[var(--color-ink-soft)]" />
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
          <EmptyState icon={<SearchX size={36} strokeWidth={1.5} />} title="No recipes match yet" subtitle="Try loosening a filter or searching a different term." />
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

      {showImport && (
        <ImportRecipeModal
          onClose={() => setShowImport(false)}
          onImported={(slug) => router.push(`/recipe/${slug}`)}
        />
      )}
    </div>
  );
}

function ImportRecipeModal({ onClose, onImported }: { onClose: () => void; onImported: (slug: string) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/recipes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't import that recipe.");
      return;
    }
    onImported(data.recipe.slug);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-white p-5 md:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Import from URL</h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
          Paste a link to a recipe page. Works with most recipe sites that publish structured recipe data — not every
          site does, and social media posts generally aren&apos;t supported yet.
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="https://example.com/some-recipe"
          className="mt-4 w-full rounded-xl border border-[var(--color-line)] px-4 py-3 text-sm outline-none focus:border-[var(--color-coral)]"
        />
        {error && <p className="mt-2 text-sm text-[var(--color-coral)]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <SecondaryButton onClick={onClose} className="flex-1">
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={submit} disabled={busy || !url.trim()} className="flex-1">
            {busy ? "Importing…" : "Import"}
          </PrimaryButton>
        </div>
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
