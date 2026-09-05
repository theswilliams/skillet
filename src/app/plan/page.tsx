"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, Calendar, Recycle, ShoppingCart, Check, RotateCcw, X } from "lucide-react";
import { RecipeArt } from "@/components/RecipeArt";
import { PrimaryButton, SecondaryButton, Spinner, SectionCard, ProgressBar, EmptyState, Chip } from "@/components/ui";
import type { MealPlanDTO, RecipeDTO } from "@/lib/types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlanPage() {
  const [plan, setPlan] = useState<MealPlanDTO | null | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/meal-plan")
      .then((r) => r.json())
      .then((d) => setPlan(d.plan));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generatePlan() {
    setGenerating(true);
    const res = await fetch("/api/meal-plan", { method: "POST" }).then((r) => r.json());
    setPlan(res.plan);
    setGenerating(false);
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    await fetch(`/api/meal-plan/item/${itemId}`, { method: "DELETE" });
    await refreshAfterChange();
  }

  async function replaceItem(itemId: string) {
    setBusyItem(itemId);
    await fetch(`/api/meal-plan/item/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "replace" }),
    });
    await refreshAfterChange();
  }

  async function toggleCooked(itemId: string, cooked: boolean) {
    setBusyItem(itemId);
    await fetch(`/api/meal-plan/item/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cooked }),
    });
    await refreshAfterChange();
  }

  async function refreshAfterChange() {
    const res = await fetch("/api/meal-plan").then((r) => r.json());
    setPlan(res.plan);
    setBusyItem(null);
  }

  async function moveItem(itemId: string, fromDay: number, toDay: number) {
    if (!plan || fromDay === toDay) return;
    setBusyItem(itemId);
    await fetch(`/api/meal-plan/item/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayIndex: toDay }),
    });
    await refreshAfterChange();
  }

  if (plan === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-[var(--color-coral)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Your Week</h1>
        <SecondaryButton onClick={generatePlan} disabled={generating}>
          {generating ? (
            "Building…"
          ) : plan ? (
            <>
              <RefreshCw size={14} strokeWidth={2.25} /> Rebuild Plan
            </>
          ) : (
            <>
              <Sparkles size={14} strokeWidth={2.25} /> Build My Week
            </>
          )}
        </SecondaryButton>
      </div>

      {!plan ? (
        <EmptyState
          icon={<Calendar size={36} strokeWidth={1.5} />}
          title="No plan yet"
          subtitle="We'll generate 7 dinners that fit your budget and taste, maximizing ingredient reuse."
          action={
            <PrimaryButton onClick={generatePlan} disabled={generating} className="mt-2">
              {generating ? "Building…" : "Build My Week"}
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <SectionCard className="mt-4 p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-extrabold">${plan.estimatedCost.toFixed(0)}</p>
                <p className="text-[11px] font-semibold uppercase text-[var(--color-ink-soft)]">of ${plan.budget} budget</p>
              </div>
              <div>
                <p className="text-xl font-extrabold">{plan.items.length}</p>
                <p className="text-[11px] font-semibold uppercase text-[var(--color-ink-soft)]">meals</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-[var(--color-mint)]">{plan.efficiency.efficiencyPct}%</p>
                <p className="text-[11px] font-semibold uppercase text-[var(--color-ink-soft)]">efficiency</p>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar pct={(plan.estimatedCost / Math.max(1, plan.budget)) * 100} tone={plan.estimatedCost > plan.budget ? "coral" : "mint"} />
            </div>
            {plan.efficiency.sharedIngredients.length > 0 && (
              <p className="mt-3 flex items-center gap-1 text-xs text-[var(--color-ink-soft)]">
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-mint)]">
                  <Recycle size={13} strokeWidth={2.25} /> Reused:
                </span>
                {plan.efficiency.sharedIngredients.slice(0, 6).map((s) => s.name).join(", ")}
              </p>
            )}
            <Link href="/grocery">
              <SecondaryButton className="mt-4 w-full">
                <ShoppingCart size={16} strokeWidth={2.25} /> Generate Grocery List
              </SecondaryButton>
            </Link>
          </SectionCard>

          <div className="mt-6 flex flex-col gap-3">
            {DAY_NAMES.map((dayName, dayIndex) => {
              const item = plan.items.find((i) => i.dayIndex === dayIndex);
              return (
                <div
                  key={dayIndex}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const itemId = e.dataTransfer.getData("text/plain");
                    if (itemId) moveItem(itemId, dragDay ?? dayIndex, dayIndex);
                    setDragDay(null);
                  }}
                  className={`rounded-2xl border p-3 transition-colors ${dragDay !== null ? "border-dashed border-[var(--color-coral)] bg-[var(--color-coral-light)]/30" : "border-[var(--color-line)] bg-white"}`}
                >
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">{dayName}</p>
                  {item ? (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.id);
                        setDragDay(dayIndex);
                      }}
                      onDragEnd={() => setDragDay(null)}
                      className={`flex items-center gap-3 rounded-xl border border-[var(--color-line)] p-2 ${busyItem === item.id ? "opacity-50" : ""}`}
                    >
                      <Link href={`/recipe/${item.recipe.slug}`} className="flex flex-1 items-center gap-3 min-w-0">
                        <RecipeArt hue={item.recipe.hue} emoji={item.recipe.emoji} imageUrl={item.recipe.imageUrl} size="sm" className="h-14 w-14 shrink-0 rounded-xl" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{item.recipe.name}</p>
                          <p className="text-xs text-[var(--color-ink-soft)]">
                            {item.recipe.totalMinutes}m · ${item.recipe.costPerServing.toFixed(2)}/serving
                          </p>
                          {item.cooked && (
                            <Chip tone="mint">
                              <Check size={11} strokeWidth={2.5} /> Cooked
                            </Chip>
                          )}
                        </div>
                      </Link>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() => toggleCooked(item.id, !item.cooked)}
                          title="Mark cooked"
                          className="rounded-full p-1.5 text-[var(--color-mint)] hover:bg-[var(--color-mint-light)]"
                        >
                          <Check size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => replaceItem(item.id)}
                          title="Replace"
                          className="rounded-full p-1.5 text-[var(--color-gold)] hover:bg-[var(--color-gold-light)]"
                        >
                          <RotateCcw size={14} strokeWidth={2.25} />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          title="Remove"
                          className="rounded-full p-1.5 text-[var(--color-coral)] hover:bg-[var(--color-coral-light)]"
                        >
                          <X size={14} strokeWidth={2.25} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPickerDay(dayIndex)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-line)] py-4 text-sm font-semibold text-[var(--color-ink-soft)] hover:border-[var(--color-coral)] hover:text-[var(--color-coral)]"
                    >
                      + Add meal / Free Night
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {pickerDay !== null && plan && (
        <RecipePicker
          onClose={() => setPickerDay(null)}
          onPick={async (recipe) => {
            await fetch("/api/meal-plan/item", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mealPlanId: plan.id, recipeId: recipe.id, dayIndex: pickerDay }),
            });
            setPickerDay(null);
            refreshAfterChange();
          }}
        />
      )}
    </div>
  );
}

function RecipePicker({ onClose, onPick }: { onClose: () => void; onPick: (r: RecipeDTO) => void }) {
  const [recipes, setRecipes] = useState<RecipeDTO[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`/api/recipes?${q ? `q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setRecipes(d.recipes));
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl bg-white p-4 md:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Add a meal</h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes..."
          className="mt-3 rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-coral)]"
        />
        <div className="mt-3 flex-1 overflow-y-auto">
          {!recipes ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-[var(--color-coral)]" />
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--color-line)]">
              {recipes.map((r) => (
                <button key={r.id} onClick={() => onPick(r)} className="flex items-center gap-3 py-2.5 text-left">
                  <RecipeArt hue={r.hue} emoji={r.emoji} imageUrl={r.imageUrl} size="sm" className="h-12 w-12 shrink-0 rounded-lg" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      {r.totalMinutes}m · ${r.costPerServing.toFixed(2)}/serving
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
