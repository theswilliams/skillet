import type { Ingredient, PantryItem, Recipe, RecipeIngredient } from "@prisma/client";

export type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

export type PantryMatch = {
  haveCount: number;
  neededCount: number;
  missing: { name: string; slug: string }[];
  matchPct: number;
  canMake: boolean;
};

/**
 * Deterministic pantry matching: staple ingredients (salt, oil, common
 * spices) are always considered "on hand" even if not explicitly added, since
 * requiring users to log salt is bad UX. Optional ingredients never count
 * against a recipe's makeability.
 */
export function matchPantry(
  recipe: RecipeWithIngredients,
  pantryIngredientIds: Set<string>,
): PantryMatch {
  const required = recipe.ingredients.filter((ri) => !ri.optional);
  const missing = required.filter(
    (ri) => !ri.ingredient.isStaple && !pantryIngredientIds.has(ri.ingredientId),
  );
  const haveCount = required.length - missing.length;

  return {
    haveCount,
    neededCount: required.length,
    missing: missing.map((m) => ({ name: m.ingredient.name, slug: m.ingredient.slug })),
    matchPct: required.length === 0 ? 100 : Math.round((haveCount / required.length) * 100),
    canMake: missing.length === 0,
  };
}

export function rankByPantryMatch(
  recipes: RecipeWithIngredients[],
  pantryIngredientIds: Set<string>,
): (RecipeWithIngredients & { pantryMatch: PantryMatch })[] {
  return recipes
    .map((r) => ({ ...r, pantryMatch: matchPantry(r, pantryIngredientIds) }))
    .sort((a, b) => {
      // Fewest missing ingredients first, then highest match %
      if (a.pantryMatch.missing.length !== b.pantryMatch.missing.length) {
        return a.pantryMatch.missing.length - b.pantryMatch.missing.length;
      }
      return b.pantryMatch.matchPct - a.pantryMatch.matchPct;
    });
}

export function countMakeableRecipes(
  recipes: RecipeWithIngredients[],
  pantryIngredientIds: Set<string>,
): number {
  return recipes.filter((r) => matchPantry(r, pantryIngredientIds).canMake).length;
}

export type { PantryItem };
