"use client";

import Link from "next/link";
import { RecipeArt } from "./RecipeArt";
import type { RecipeDTO } from "@/lib/types";

export function RecipeCard({ recipe, subtitle }: { recipe: RecipeDTO; subtitle?: string }) {
  return (
    <Link
      href={`/recipe/${recipe.slug}`}
      className="group flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] card-shadow transition-transform hover:-translate-y-0.5 sm:w-52"
    >
      <RecipeArt hue={recipe.hue} emoji={recipe.emoji} imageUrl={recipe.imageUrl} size="sm" className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-ink)]">{recipe.name}</h3>
        <p className="text-xs text-[var(--color-ink-soft)]">
          {subtitle ?? `${recipe.totalMinutes} min · $${recipe.costPerServing.toFixed(2)}/serving`}
        </p>
      </div>
    </Link>
  );
}

export function RecipeRow({ title, recipes, emptyText }: { title: string; recipes: RecipeDTO[]; emptyText?: string }) {
  if (recipes.length === 0 && !emptyText) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-4 text-base font-bold text-[var(--color-ink)] sm:px-0">{title}</h2>
      {recipes.length === 0 ? (
        <p className="px-4 text-sm text-[var(--color-ink-soft)] sm:px-0">{emptyText}</p>
      ) : (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:px-0">
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </section>
  );
}
