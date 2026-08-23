import type { Ingredient, Recipe, RecipeIngredient } from "@prisma/client";

export type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

export type IngredientEfficiency = {
  /** % of purchased (non-staple) ingredients used in 2+ recipes in the plan */
  efficiencyPct: number;
  uniqueIngredientCount: number;
  sharedIngredientCount: number;
  singleUseIngredientCount: number;
  sharedIngredients: { name: string; recipeCount: number; recipeNames: string[] }[];
  singleUseIngredients: { name: string; recipeName: string }[];
};

/**
 * "Cook Once, Eat 3 Times" — the ingredient-overlap metric.
 * Staples (salt, oil, spices assumed always on hand) are excluded from the
 * denominator since they aren't a real per-week purchase decision.
 */
export function calculateIngredientEfficiency(recipes: RecipeWithIngredients[]): IngredientEfficiency {
  const usage = new Map<string, { name: string; isStaple: boolean; recipes: Set<string> }>();

  for (const recipe of recipes) {
    for (const ri of recipe.ingredients) {
      if (ri.optional) continue;
      const key = ri.ingredientId;
      if (!usage.has(key)) {
        usage.set(key, { name: ri.ingredient.name, isStaple: ri.ingredient.isStaple, recipes: new Set() });
      }
      usage.get(key)!.recipes.add(recipe.name);
    }
  }

  const purchased = [...usage.values()].filter((u) => !u.isStaple);
  const shared = purchased.filter((u) => u.recipes.size > 1);
  const singleUse = purchased.filter((u) => u.recipes.size === 1);

  const efficiencyPct = purchased.length === 0 ? 100 : Math.round((shared.length / purchased.length) * 100);

  return {
    efficiencyPct,
    uniqueIngredientCount: purchased.length,
    sharedIngredientCount: shared.length,
    singleUseIngredientCount: singleUse.length,
    sharedIngredients: shared
      .sort((a, b) => b.recipes.size - a.recipes.size)
      .map((u) => ({ name: u.name, recipeCount: u.recipes.size, recipeNames: [...u.recipes] })),
    singleUseIngredients: singleUse.map((u) => ({ name: u.name, recipeName: [...u.recipes][0] })),
  };
}
