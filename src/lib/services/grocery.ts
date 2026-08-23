import type { Ingredient, MealPlanItem, Recipe, RecipeIngredient } from "@prisma/client";
import { toBase, formatBase } from "@/lib/units";

export type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

export type PlanItemWithRecipe = MealPlanItem & { recipe: RecipeWithIngredients };

export type ConsolidatedItem = {
  ingredientId: string;
  name: string;
  category: string;
  baseUnit: string;
  totalBaseQuantity: number;
  displayQuantity: string;
  estimatedCost: number;
  usedInRecipes: string[];
  isStaple: boolean;
};

/**
 * Combine duplicate ingredients across every meal-plan item into one grocery
 * line per ingredient, scaled by each item's serving count vs the recipe's
 * base serving count. Deterministic — no LLM involved.
 */
export function consolidateIngredients(items: PlanItemWithRecipe[]): ConsolidatedItem[] {
  const map = new Map<string, ConsolidatedItem & { ingredient: Ingredient }>();

  for (const item of items) {
    const multiplier = item.servings / Math.max(1, item.recipe.servings);
    for (const ri of item.recipe.ingredients) {
      if (ri.optional) continue;
      const baseQty =
        toBase(ri.quantity, ri.unit, ri.ingredient.baseUnit as "g" | "ml" | "unit", ri.ingredient.densityGPerMl) *
        multiplier;
      const cost = baseQty * ri.ingredient.pricePerBaseUnit;

      const existing = map.get(ri.ingredientId);
      if (existing) {
        existing.totalBaseQuantity += baseQty;
        existing.estimatedCost += cost;
        if (!existing.usedInRecipes.includes(item.recipe.name)) {
          existing.usedInRecipes.push(item.recipe.name);
        }
      } else {
        map.set(ri.ingredientId, {
          ingredientId: ri.ingredientId,
          name: ri.ingredient.name,
          category: ri.ingredient.category,
          baseUnit: ri.ingredient.baseUnit,
          totalBaseQuantity: baseQty,
          displayQuantity: "",
          estimatedCost: cost,
          usedInRecipes: [item.recipe.name],
          isStaple: ri.ingredient.isStaple,
          ingredient: ri.ingredient,
        });
      }
    }
  }

  return [...map.values()]
    .map((v) => ({
      ...v,
      totalBaseQuantity: round2(v.totalBaseQuantity),
      estimatedCost: round2(v.estimatedCost),
      displayQuantity: formatBase(v.totalBaseQuantity, v.baseUnit as "g" | "ml" | "unit"),
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export const CATEGORY_ORDER = ["produce", "meat", "dairy", "pantry", "frozen", "bakery", "other"];

export function groupByCategory<T extends { category: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const cat of CATEGORY_ORDER) groups[cat] = [];
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return groups;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
