import type { Ingredient, Recipe, RecipeIngredient } from "@prisma/client";
import { recipeCost, scaledIngredientCost } from "./cost";
import { calculateIngredientEfficiency } from "./efficiency";
import type { TasteProfile } from "./recommend";
import { scoreRecipe } from "./recommend";

export type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

export type PlanConstraints = {
  days: number; // meal slots to fill (e.g. 7 dinners)
  householdSize: number;
  weeklyBudget: number;
  maxCookTime: number;
  favoriteCuisines: string[];
  dislikedIngredientSlugs: string[];
  dietaryTags: string[];
  equipment: string[];
  mealType?: string; // default "dinner"
};

export type PlannedMeal = {
  recipe: RecipeWithIngredients;
  servings: number;
  cost: number;
};

export type GeneratedPlan = {
  meals: PlannedMeal[];
  totalCost: number;
  costPerPerson: number;
  efficiencyPct: number;
  uniqueIngredientCount: number;
};

/**
 * Budget-first, ingredient-efficiency-aware meal plan generator.
 * Deterministic greedy algorithm (documented, not an LLM):
 *
 *  1. Filter recipes to hard constraints (time, dietary tags, disliked
 *     ingredients, equipment on hand).
 *  2. Score each candidate on taste-profile fit (see recommend.ts).
 *  3. Greedily fill each day: for the first pick, take the best-scoring
 *     affordable recipe. For every subsequent pick, add a bonus proportional
 *     to how many ingredients it shares with recipes already in the plan
 *     (the "Cook Once, Eat 3 Times" pull), then re-rank by
 *     (taste score + overlap bonus) / cost, subject to remaining budget.
 *  4. If nothing affordable remains, stop early rather than blow the budget.
 *
 * This keeps taste, cost and ingredient efficiency all inside one objective
 * instead of optimizing any single one in isolation (per product principle).
 */
export function generateMealPlan(
  candidates: RecipeWithIngredients[],
  constraints: PlanConstraints,
  profile: TasteProfile,
): GeneratedPlan {
  const mealType = constraints.mealType ?? "dinner";
  const dislikedSet = new Set(constraints.dislikedIngredientSlugs);

  let pool = candidates.filter((r) => {
    if (r.mealType !== mealType) return false;
    if (r.totalMinutes > constraints.maxCookTime) return false;
    if (constraints.dietaryTags.length > 0) {
      const tags = new Set(r.dietaryTags.split(",").filter(Boolean));
      const meetsAll = constraints.dietaryTags.every((t) => tags.has(t));
      if (!meetsAll) return false;
    }
    if (r.ingredients.some((ri) => !ri.optional && dislikedSet.has(ri.ingredient.slug))) return false;
    return true;
  });

  if (pool.length === 0) pool = candidates.filter((r) => r.mealType === mealType);

  const perPersonBudget = constraints.weeklyBudget / Math.max(1, constraints.days);
  const servingsNeeded = constraints.householdSize;

  const chosen: PlannedMeal[] = [];
  const chosenIngredientIds = new Map<string, number>(); // ingredientId -> count of recipes using it
  let remainingBudget = constraints.weeklyBudget;
  const usedRecipeIds = new Set<string>();

  for (let day = 0; day < constraints.days; day++) {
    const available = pool.filter((r) => !usedRecipeIds.has(r.id));
    if (available.length === 0) break;

    const scored = available.map((recipe) => {
      const multiplier = servingsNeeded / Math.max(1, recipe.servings);
      const cost = recipe.ingredients
        .filter((ri) => !ri.optional)
        .reduce((sum, ri) => sum + scaledIngredientCost(ri, multiplier), 0);

      const overlapBonus = recipe.ingredients.reduce((sum, ri) => {
        const timesUsed = chosenIngredientIds.get(ri.ingredientId) ?? 0;
        return sum + (timesUsed > 0 ? 4 : 0);
      }, 0);

      const cuisineBonus = constraints.favoriteCuisines.includes(recipe.cuisine) ? 3 : 0;
      const tasteScore = scoreRecipe(recipe, profile);
      const totalScore = tasteScore + overlapBonus + cuisineBonus;
      const affordable = cost <= remainingBudget;
      // Favor score-per-dollar once we're past the first couple picks, so the
      // planner doesn't blow the whole budget on the first expensive favorite.
      const efficiency = totalScore / Math.max(0.5, cost / Math.max(1, perPersonBudget));

      return { recipe, cost, totalScore, efficiency, affordable };
    });

    const affordablePicks = scored.filter((s) => s.affordable);
    const rankPool = affordablePicks.length > 0 ? affordablePicks : scored;
    rankPool.sort((a, b) => (day < 2 ? b.totalScore - a.totalScore : b.efficiency - a.efficiency));

    const pick = rankPool[0];
    if (!pick || (affordablePicks.length === 0 && chosen.length > 0)) break;

    chosen.push({ recipe: pick.recipe, servings: servingsNeeded, cost: round2(pick.cost) });
    usedRecipeIds.add(pick.recipe.id);
    remainingBudget -= pick.cost;
    for (const ri of pick.recipe.ingredients) {
      if (ri.optional) continue;
      chosenIngredientIds.set(ri.ingredientId, (chosenIngredientIds.get(ri.ingredientId) ?? 0) + 1);
    }
  }

  const efficiency = calculateIngredientEfficiency(chosen.map((m) => m.recipe));
  const totalCost = round2(chosen.reduce((s, m) => s + m.cost, 0));

  return {
    meals: chosen,
    totalCost,
    costPerPerson: round2(totalCost / Math.max(1, constraints.householdSize)),
    efficiencyPct: efficiency.efficiencyPct,
    uniqueIngredientCount: efficiency.uniqueIngredientCount,
  };
}

/** Suggest a replacement for a single day without rebuilding the whole week. */
export function suggestReplacement(
  candidates: RecipeWithIngredients[],
  currentPlanRecipeIds: string[],
  otherMealsInPlan: RecipeWithIngredients[],
  constraints: Pick<PlanConstraints, "maxCookTime" | "dietaryTags" | "dislikedIngredientSlugs" | "mealType">,
  profile: TasteProfile,
): RecipeWithIngredients | null {
  const dislikedSet = new Set(constraints.dislikedIngredientSlugs);
  const excludeIds = new Set(currentPlanRecipeIds);
  const mealType = constraints.mealType ?? "dinner";

  const ingredientCounts = new Map<string, number>();
  for (const r of otherMealsInPlan) {
    for (const ri of r.ingredients) {
      if (ri.optional) continue;
      ingredientCounts.set(ri.ingredientId, (ingredientCounts.get(ri.ingredientId) ?? 0) + 1);
    }
  }

  const pool = candidates.filter((r) => {
    if (excludeIds.has(r.id)) return false;
    if (r.mealType !== mealType) return false;
    if (r.totalMinutes > constraints.maxCookTime) return false;
    if (r.ingredients.some((ri) => !ri.optional && dislikedSet.has(ri.ingredient.slug))) return false;
    return true;
  });

  if (pool.length === 0) return null;

  const scored = pool.map((recipe) => {
    const overlapBonus = recipe.ingredients.reduce(
      (sum, ri) => sum + (ingredientCounts.has(ri.ingredientId) ? 4 : 0),
      0,
    );
    return { recipe, score: scoreRecipe(recipe, profile) + overlapBonus };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].recipe;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
