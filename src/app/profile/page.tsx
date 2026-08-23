"use client";

import { useEffect, useState } from "react";
import { Chip, SecondaryButton, Spinner, SectionCard } from "@/components/ui";
import { RecipeRow } from "@/components/RecipeCard";
import type { PreferencesDTO, RecipeDTO } from "@/lib/types";

const CUISINES = ["Italian", "Mexican", "Chinese", "Japanese", "Korean", "Thai", "Indian", "Mediterranean", "American"];
const DIETARY = ["vegetarian", "vegan", "gluten-free", "dairy-free", "high-protein", "low-carb"];
const EQUIPMENT = [
  { value: "one-pan", label: "One Pan" },
  { value: "oven", label: "Oven" },
  { value: "slow-cooker", label: "Slow Cooker" },
  { value: "instant-pot", label: "Instant Pot" },
  { value: "air-fryer", label: "Air Fryer" },
  { value: "bbq", label: "BBQ" },
];

export default function ProfilePage() {
  const [prefs, setPrefs] = useState<PreferencesDTO | null>(null);
  const [saved, setSaved] = useState<RecipeDTO[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dislikesText, setDislikesText] = useState("");

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setPrefs(d.preferences);
        setDislikesText(d.preferences.dislikedIngredients.join(", "));
      });
    fetch("/api/saved")
      .then((r) => r.json())
      .then((d) => setSaved(d.recipes));
  }, []);

  function update<K extends keyof PreferencesDTO>(key: K, value: PreferencesDTO[K]) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    setDirty(true);
  }

  function toggleArr(key: "favoriteCuisines" | "dietaryTags" | "equipment", val: string) {
    if (!prefs) return;
    const arr = prefs[key];
    update(key, arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...prefs,
        dislikedIngredients: dislikesText.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    setDirty(false);
  }

  if (!prefs) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-[var(--color-coral)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <h1 className="text-xl font-extrabold tracking-tight">Profile & Preferences</h1>

      <SectionCard className="mt-4 p-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Household size">
            <input
              type="number"
              min={1}
              max={12}
              value={prefs.householdSize}
              onChange={(e) => update("householdSize", Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            />
          </Field>
          <Field label="Weekly budget ($)">
            <input
              type="number"
              min={10}
              value={prefs.weeklyBudget}
              onChange={(e) => update("weeklyBudget", Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            />
          </Field>
          <Field label="Meals per day">
            <input
              type="number"
              min={1}
              max={5}
              value={prefs.mealsPerDay}
              onChange={(e) => update("mealsPerDay", Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            />
          </Field>
          <Field label="Max cook time (min)">
            <input
              type="number"
              min={5}
              value={prefs.maxCookTime}
              onChange={(e) => update("maxCookTime", Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard className="mt-4 p-5">
        <p className="text-sm font-bold">Favorite cuisines</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <Chip key={c} active={prefs.favoriteCuisines.includes(c)} onClick={() => toggleArr("favoriteCuisines", c)} tone="coral">
              {c}
            </Chip>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="mt-4 p-5">
        <p className="text-sm font-bold">Dietary preferences</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIETARY.map((d) => (
            <Chip key={d} active={prefs.dietaryTags.includes(d)} onClick={() => toggleArr("dietaryTags", d)} tone="mint">
              {d}
            </Chip>
          ))}
        </div>
        <p className="mt-4 text-sm font-bold">Foods you dislike</p>
        <input
          value={dislikesText}
          onChange={(e) => {
            setDislikesText(e.target.value);
            setDirty(true);
          }}
          placeholder="e.g. mushroom, cilantro"
          className="mt-2 w-full rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-coral)]"
        />
      </SectionCard>

      <SectionCard className="mt-4 p-5">
        <p className="text-sm font-bold">Equipment</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EQUIPMENT.map((e) => (
            <Chip key={e.value} active={prefs.equipment.includes(e.value)} onClick={() => toggleArr("equipment", e.value)} tone="gold">
              {e.label}
            </Chip>
          ))}
        </div>
      </SectionCard>

      <div className="sticky bottom-16 mt-4 md:bottom-0">
        <SecondaryButton onClick={save} disabled={!dirty || saving} className="w-full bg-[var(--color-ink)] text-white hover:bg-black">
          {saving ? "Saving…" : dirty ? "Save Changes" : "Saved ✓"}
        </SecondaryButton>
      </div>

      <div className="mt-8">
        <RecipeRow title="Saved Recipes" recipes={saved ?? []} emptyText="Save recipes from Discover or Search to see them here." />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--color-ink-soft)]">
      {label}
      {children}
    </label>
  );
}
