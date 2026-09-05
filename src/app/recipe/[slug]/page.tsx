"use client";

import { useEffect, useState, use as usePromise } from "react";
import { ArrowLeft, Star, Link as LinkIcon, CircleCheck, ShoppingCart, Check } from "lucide-react";
import { RecipeArt } from "@/components/RecipeArt";
import { Chip, PrimaryButton, SecondaryButton, Spinner, SectionCard } from "@/components/ui";
import type { RecipeDTO, PantryMatchDTO } from "@/lib/types";
import { useRouter } from "next/navigation";

async function post(url: string, body: unknown) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export default function RecipeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = usePromise(params);
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDTO | null>(null);
  const [pantryMatch, setPantryMatch] = useState<PantryMatchDTO | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [servingsMult, setServingsMult] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/recipes/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setRecipe(d.recipe);
        setPantryMatch(d.pantryMatch);
        setIsSaved(d.isSaved);
      });
  }, [slug]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  async function toggleSave() {
    if (!recipe) return;
    setBusy("save");
    await post("/api/interactions", { recipeId: recipe.id, type: isSaved ? "unsaved" : "saved" });
    setIsSaved((s) => !s);
    setBusy(null);
    flash(isSaved ? "Removed from saved" : "Saved to your recipes");
  }

  async function markCooked() {
    if (!recipe) return;
    setBusy("cook");
    await post("/api/interactions", { recipeId: recipe.id, type: "cooked" });
    setBusy(null);
    flash("Marked as cooked");
  }

  async function addToGroceryList() {
    if (!recipe) return;
    setBusy("grocery");
    // Ensure a current-week plan exists, add this recipe to the next open day, then regenerate the list.
    const planRes = await fetch("/api/meal-plan").then((r) => r.json());
    let plan = planRes.plan;
    if (!plan) {
      plan = await fetch("/api/meal-plan", { method: "POST" }).then((r) => r.json()).then((d) => d.plan);
    }
    const usedDays = new Set((plan?.items ?? []).map((i: { dayIndex: number }) => i.dayIndex));
    let dayIndex = 0;
    while (usedDays.has(dayIndex) && dayIndex < 7) dayIndex++;
    await post("/api/meal-plan/item", { mealPlanId: plan.id, recipeId: recipe.id, dayIndex, servings: recipe.servings });
    await post("/api/grocery-list", { mealPlanId: plan.id });
    setBusy(null);
    flash("Added to grocery list");
  }

  if (!recipe) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-[var(--color-coral)]" />
      </div>
    );
  }

  const scaledCost = recipe.totalCost * servingsMult;
  const scaledServings = recipe.servings * servingsMult;

  return (
    <div className="mx-auto max-w-2xl pb-28 md:pb-10">
      <div className="relative">
        <RecipeArt hue={recipe.hue} emoji={recipe.emoji} imageUrl={recipe.imageUrl} size="lg" className="h-64 w-full sm:h-80 sm:rounded-b-3xl" />
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow"
        >
          <ArrowLeft size={18} strokeWidth={2.25} />
        </button>
        <button
          onClick={toggleSave}
          disabled={busy === "save"}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow"
        >
          <Star size={18} strokeWidth={2} className={isSaved ? "fill-[var(--color-gold)] text-[var(--color-gold)]" : "text-[var(--color-ink-soft)]"} />
        </button>
      </div>

      <div className="px-5 pt-5 sm:px-8">
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="coral">{recipe.cuisine}</Chip>
          <Chip tone="mint">{recipe.difficulty}</Chip>
          {recipe.dietaryTags.map((t) => (
            <Chip key={t} tone="gold">
              {t}
            </Chip>
          ))}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{recipe.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{recipe.description}</p>
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-coral)] underline underline-offset-2"
          >
            <LinkIcon size={12} strokeWidth={2.25} /> Imported from {new URL(recipe.sourceUrl).hostname.replace(/^www\./, "")}
          </a>
        )}

        <div className="mt-5 grid grid-cols-4 gap-2 text-center">
          <Stat label="Prep" value={`${recipe.prepMinutes}m`} />
          <Stat label="Cook" value={`${recipe.cookMinutes}m`} />
          <Stat label="Servings" value={`${scaledServings}`} />
          <Stat label="Cost" value={`$${scaledCost.toFixed(2)}`} />
        </div>

        {pantryMatch && (
          <SectionCard className="mt-5 p-4">
            {pantryMatch.canMake ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-mint)]">
                <CircleCheck size={16} strokeWidth={2.25} /> You have everything for this recipe!
              </p>
            ) : (
              <>
                <p className={`flex items-center gap-1.5 text-sm font-semibold ${pantryMatch.majorityMatch ? "text-[var(--color-gold)]" : ""}`}>
                  {pantryMatch.majorityMatch && <Star size={14} strokeWidth={2.25} className="fill-current" />}
                  You have {pantryMatch.haveCount}/{pantryMatch.neededCount} ingredients
                  {pantryMatch.majorityMatch && " — most of the main parts are covered"}
                </p>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  Just need: {pantryMatch.missing.map((m) => m.name).join(", ")}
                </p>
              </>
            )}
          </SectionCard>
        )}

        {(recipe.calories || recipe.protein) && (
          <SectionCard className="mt-4 grid grid-cols-4 gap-2 p-4 text-center">
            <Stat label="Cal" value={`${recipe.calories ?? "—"}`} small />
            <Stat label="Protein" value={`${recipe.protein ?? "—"}g`} small />
            <Stat label="Carbs" value={`${recipe.carbs ?? "—"}g`} small />
            <Stat label="Fat" value={`${recipe.fat ?? "—"}g`} small />
          </SectionCard>
        )}

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-bold">Ingredients</h2>
          <div className="flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-1 py-1">
            {[1, 2, 3].map((m) => (
              <button
                key={m}
                onClick={() => setServingsMult(m)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${servingsMult === m ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink-soft)]"}`}
              >
                {m}x
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-3 flex flex-col divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-white">
          {recipe.ingredients.map((ri) => (
            <li key={ri.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className={ri.optional ? "text-[var(--color-ink-soft)]" : "text-[var(--color-ink)]"}>
                {ri.name}
                {ri.optional && " (optional)"}
                {ri.preparation && <span className="text-[var(--color-ink-soft)]"> — {ri.preparation}</span>}
              </span>
              <span className="shrink-0 font-semibold text-[var(--color-ink-soft)]">
                {scaleQty(ri.display, servingsMult)}
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-6 text-lg font-bold">Instructions</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-[var(--color-line)] bg-white p-4 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-coral-light)] text-xs font-bold text-[var(--color-coral-dark)]">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 flex gap-3 border-t border-[var(--color-line)] bg-white/95 px-5 py-3 backdrop-blur md:sticky md:bottom-0 md:mt-8 md:rounded-b-3xl">
        <SecondaryButton onClick={addToGroceryList} disabled={busy === "grocery"} className="flex-1">
          <ShoppingCart size={16} strokeWidth={2.25} /> Add to Grocery List
        </SecondaryButton>
        <PrimaryButton onClick={markCooked} disabled={busy === "cook"} className="flex-1">
          <Check size={16} strokeWidth={2.25} /> Mark Cooked
        </PrimaryButton>
      </div>

      {toast && (
        <div className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white md:bottom-24">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <p className={`font-extrabold ${small ? "text-sm" : "text-base"}`}>{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</p>
    </div>
  );
}

function scaleQty(display: string, mult: number) {
  if (mult === 1) return display;
  const match = display.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return display;
  const num = parseFloat(match[1]) * mult;
  return `${Math.round(num * 100) / 100}${match[2]}`;
}
