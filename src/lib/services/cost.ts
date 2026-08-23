import type { Ingredient, Recipe, RecipeIngredient } from "@prisma/client";
import { toBase } from "@/lib/units";

export type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

/**
 * Deterministic cost calculation: quantity (normalised to the ingredient's
 * base unit) x price-per-base-unit, summed across non-optional ingredients.
 * Optional ingredients are costed separately so callers can show "+$X if added".
 */
export function recipeCost(recipe: RecipeWithIngredients) {
  let required = 0;
  let optional = 0;
  for (const ri of recipe.ingredients) {
    const baseQty = toBase(ri.quantity, ri.unit, ri.ingredient.baseUnit as "g" | "ml" | "unit", ri.ingredient.densityGPerMl);
    const cost = baseQty * ri.ingredient.pricePerBaseUnit;
    if (ri.optional) optional += cost;
    else required += cost;
  }
  return {
    totalCost: round2(required),
    optionalCost: round2(optional),
    costPerServing: round2(required / Math.max(1, recipe.servings)),
  };
}

export function scaledIngredientCost(
  ri: RecipeIngredient & { ingredient: Ingredient },
  servingsMultiplier: number,
) {
  const baseQty =
    toBase(ri.quantity, ri.unit, ri.ingredient.baseUnit as "g" | "ml" | "unit", ri.ingredient.densityGPerMl) *
    servingsMultiplier;
  return baseQty * ri.ingredient.pricePerBaseUnit;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
