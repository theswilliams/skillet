import type { Ingredient, Recipe, RecipeIngredient } from "@prisma/client";
import { recipeCost } from "./cost";
import { matchPantry } from "./pantry";

export type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

export type RecipeFilters = {
  q?: string;
  cuisines?: string[];
  proteins?: string[];
  dietary?: string[];
  equipment?: string[];
  difficulty?: string[];
  mealType?: string;
  maxMinutes?: number;
  minMinutes?: number;
  maxCostPerServing?: number;
  availability?: "have" | "one-missing" | "two-missing"; // requires pantryIds
  pantryIngredientIds?: Set<string>;
};

/** Deterministic in-memory filter/search over the recipe catalogue. */
export function filterRecipes(recipes: RecipeWithIngredients[], filters: RecipeFilters): RecipeWithIngredients[] {
  let result = recipes;

  if (filters.mealType) {
    result = result.filter((r) => r.mealType === filters.mealType);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.toLowerCase().trim();
    result = result.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.description.toLowerCase().includes(q)) return true;
      if (r.cuisine.toLowerCase().includes(q)) return true;
      if (r.ingredients.some((ri) => ri.ingredient.name.toLowerCase().includes(q))) return true;
      return false;
    });
  }

  if (filters.cuisines?.length) {
    const set = new Set(filters.cuisines.map((c) => c.toLowerCase()));
    result = result.filter((r) => set.has(r.cuisine.toLowerCase()));
  }

  if (filters.proteins?.length) {
    const set = new Set(filters.proteins.map((p) => p.toLowerCase()));
    result = result.filter((r) => set.has(r.proteinType.toLowerCase()));
  }

  if (filters.dietary?.length) {
    result = result.filter((r) => {
      const tags = new Set(r.dietaryTags.split(",").filter(Boolean));
      return filters.dietary!.every((d) => tags.has(d));
    });
  }

  if (filters.equipment?.length) {
    result = result.filter((r) => {
      const eq = new Set(r.equipment.split(",").filter(Boolean));
      return filters.equipment!.some((e) => eq.has(e));
    });
  }

  if (filters.difficulty?.length) {
    const set = new Set(filters.difficulty);
    result = result.filter((r) => set.has(r.difficulty));
  }

  if (filters.maxMinutes != null) {
    result = result.filter((r) => r.totalMinutes <= filters.maxMinutes!);
  }
  if (filters.minMinutes != null) {
    result = result.filter((r) => r.totalMinutes >= filters.minMinutes!);
  }

  if (filters.maxCostPerServing != null) {
    result = result.filter((r) => recipeCost(r).costPerServing <= filters.maxCostPerServing!);
  }

  if (filters.availability && filters.pantryIngredientIds) {
    const maxMissing = filters.availability === "have" ? 0 : filters.availability === "one-missing" ? 1 : 2;
    result = result.filter((r) => matchPantry(r, filters.pantryIngredientIds!).missing.length <= maxMissing);
  }

  return result;
}
