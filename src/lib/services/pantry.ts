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
  /** Primary ("main part" — protein, starch, key vegetable) ingredients only. */
  primaryHaveCount: number;
  primaryNeededCount: number;
  primaryMatchPct: number;
  /** True once the user has more than half of the recipe's main components,
   *  even if some minor/secondary ingredients are still missing. */
  majorityMatch: boolean;
};

/**
 * Deterministic pantry matching: staple ingredients (salt, oil, common
 * spices) are always considered "on hand" even if not explicitly added, since
 * requiring users to log salt is bad UX. Optional ingredients never count
 * against a recipe's makeability.
 *
 * `isPrimary` on RecipeIngredient marks the dish's main components (protein,
 * starch, key vegetable, etc.) as opposed to seasonings and minor add-ins.
 * `majorityMatch` uses that signal for "Use What I Have": a recipe counts as
 * within reach once the user holds a majority of the *main parts*, not
 * literally every ingredient down to the last spice.
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

  const primaryRequired = required.filter((ri) => ri.isPrimary);
  const primaryMissing = primaryRequired.filter(
    (ri) => !ri.ingredient.isStaple && !pantryIngredientIds.has(ri.ingredientId),
  );
  const primaryHaveCount = primaryRequired.length - primaryMissing.length;
  // Recipes with no ingredient explicitly flagged primary fall back to the
  // overall ratio so majorityMatch still means something for them.
  const primaryMatchPct =
    primaryRequired.length > 0
      ? Math.round((primaryHaveCount / primaryRequired.length) * 100)
      : required.length === 0
        ? 100
        : Math.round((haveCount / required.length) * 100);

  return {
    haveCount,
    neededCount: required.length,
    missing: missing.map((m) => ({ name: m.ingredient.name, slug: m.ingredient.slug })),
    matchPct: required.length === 0 ? 100 : Math.round((haveCount / required.length) * 100),
    canMake: missing.length === 0,
    primaryHaveCount,
    primaryNeededCount: primaryRequired.length,
    primaryMatchPct,
    majorityMatch: primaryMatchPct > 50,
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

/**
 * Recipes ranked for "Use What I Have": fully makeable recipes first, then
 * everything with a pantry majorityMatch (see matchPantry), best primary
 * match first. Recipes below the majority threshold are dropped entirely.
 */
export function rankByMajorityMatch(
  recipes: RecipeWithIngredients[],
  pantryIngredientIds: Set<string>,
): (RecipeWithIngredients & { pantryMatch: PantryMatch })[] {
  return recipes
    .map((r) => ({ ...r, pantryMatch: matchPantry(r, pantryIngredientIds) }))
    .filter((r) => r.pantryMatch.canMake || r.pantryMatch.majorityMatch)
    .sort((a, b) => {
      if (a.pantryMatch.canMake !== b.pantryMatch.canMake) return a.pantryMatch.canMake ? -1 : 1;
      if (a.pantryMatch.primaryMatchPct !== b.pantryMatch.primaryMatchPct) {
        return b.pantryMatch.primaryMatchPct - a.pantryMatch.primaryMatchPct;
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

/** Recipes fully makeable OR within reach via majorityMatch (see matchPantry). */
export function countMajorityMatchRecipes(
  recipes: RecipeWithIngredients[],
  pantryIngredientIds: Set<string>,
): number {
  return recipes.filter((r) => {
    const match = matchPantry(r, pantryIngredientIds);
    return match.canMake || match.majorityMatch;
  }).length;
}

export type { PantryItem };
