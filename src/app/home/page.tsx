"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecipeArt } from "@/components/RecipeArt";
import { RecipeRow } from "@/components/RecipeCard";
import { PrimaryButton, SecondaryButton, Spinner, ProgressBar } from "@/components/ui";
import type { RecipeDTO } from "@/lib/types";

type HomeData = {
  user: { name: string | null };
  hasPreferences: boolean;
  tonight: { itemId: string; recipe: RecipeDTO; dayIndex: number } | null;
  week: { id: string; mealCount: number; estimatedCost: number; efficiencyPct: number } | null;
  recommended: RecipeDTO[];
  pantry: { previewIngredients: string[]; makeableCount: number; hasItems: boolean };
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/home")
      .then((r) => r.json())
      .then((d: HomeData) => {
        setData(d);
        if (!d.hasPreferences) router.replace("/onboarding");
      });
  }, [router]);

  if (!data) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-[var(--color-coral)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 pt-6 sm:px-6 md:px-8">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {greeting()}{data.user.name ? `, ${data.user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Here&apos;s what&apos;s on deck.</p>
      </div>

      {data.tonight && (
        <section className="animate-slide-up overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-card)] card-shadow-lg">
          <p className="px-5 pt-4 text-xs font-bold uppercase tracking-wide text-[var(--color-coral)]">Tonight</p>
          <Link href={`/recipe/${data.tonight.recipe.slug}`} className="flex items-center gap-4 px-5 py-3">
            <RecipeArt hue={data.tonight.recipe.hue} emoji={data.tonight.recipe.emoji} imageUrl={data.tonight.recipe.imageUrl} size="sm" className="h-20 w-20 shrink-0 rounded-2xl" />
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold">{data.tonight.recipe.name}</h3>
              <p className="text-sm text-[var(--color-ink-soft)]">
                {data.tonight.recipe.totalMinutes} min · ${data.tonight.recipe.costPerServing.toFixed(2)}/serving
              </p>
            </div>
          </Link>
          <div className="px-5 pb-5">
            <Link href={`/recipe/${data.tonight.recipe.slug}`}>
              <PrimaryButton className="w-full">Cook Tonight</PrimaryButton>
            </Link>
          </div>
        </section>
      )}

      {data.week ? (
        <section className="animate-slide-up rounded-3xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 card-shadow">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">Your Week</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-2xl font-extrabold">{data.week.mealCount} meals</p>
              <p className="text-sm text-[var(--color-ink-soft)]">${data.week.estimatedCost.toFixed(0)} estimated</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-[var(--color-mint)]">{data.week.efficiencyPct}%</p>
              <p className="text-sm text-[var(--color-ink-soft)]">ingredient efficiency</p>
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar pct={data.week.efficiencyPct} tone="mint" />
          </div>
          <Link href="/plan">
            <SecondaryButton className="mt-4 w-full">View Plan</SecondaryButton>
          </Link>
        </section>
      ) : (
        <section className="animate-slide-up rounded-3xl border border-dashed border-[var(--color-line)] p-6 text-center">
          <p className="text-base font-semibold">No meal plan yet this week</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Generate a budget-friendly plan in one tap.</p>
          <Link href="/plan">
            <PrimaryButton className="mt-4">Build My Week</PrimaryButton>
          </Link>
        </section>
      )}

      <RecipeRow title="Based on Your Taste" recipes={data.recommended} emptyText="Swipe a few recipes in Discover to personalize this." />

      <section className="animate-slide-up mb-4 rounded-3xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 card-shadow">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">You Already Have</p>
        {data.pantry.hasItems ? (
          <>
            <p className="mt-2 text-base font-semibold">{data.pantry.previewIngredients.join(" + ")}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {data.pantry.makeableCount} {data.pantry.makeableCount === 1 ? "recipe" : "recipes"} available
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Add a few staples to your pantry to see what you can cook right now.</p>
        )}
        <Link href="/pantry">
          <SecondaryButton className="mt-4">Explore</SecondaryButton>
        </Link>
      </section>
    </div>
  );
}
