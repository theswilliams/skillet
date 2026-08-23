import type { Ingredient, Recipe, RecipeInteraction, RecipeIngredient } from "@prisma/client";
import { recipeCost } from "./cost";

export type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

/**
 * Rule-based personalization (v1). Tracks liked/disliked/saved/cooked/skipped
 * interactions and builds a lightweight taste profile: cuisines, protein
 * types, and structural traits (quick, cheap, high-protein) the user gravitates
 * toward. Scores unseen recipes against that profile.
 *
 * Architecture note: `scoreRecipes` takes a plain TasteProfile object and pure
 * recipe data — no framework or DB coupling — so a future LLM-backed recommender
 * can implement the same signature (e.g. re-rank using embeddings + this
 * profile as a prior) without touching call sites.
 */

export type TasteProfile = {
  cuisineScores: Record<string, number>;
  proteinScores: Record<string, number>;
  likesQuick: number; // -1..1, positive = prefers <=30 min
  likesCheap: number; // positive = prefers low cost/serving
  likesHighProtein: number;
  tagScores: Record<string, number>;
};

const WEIGHTS: Record<string, number> = {
  liked: 2,
  saved: 1.5,
  cooked: 2.5,
  planned: 0.5,
  viewed: 0.1,
  disliked: -2,
  skipped: -1,
};

export function buildTasteProfile(
  interactions: RecipeInteraction[],
  recipesById: Map<string, RecipeWithIngredients>,
): TasteProfile {
  const profile: TasteProfile = {
    cuisineScores: {},
    proteinScores: {},
    likesQuick: 0,
    likesCheap: 0,
    likesHighProtein: 0,
    tagScores: {},
  };

  let quickSignal = 0;
  let cheapSignal = 0;
  let proteinSignal = 0;
  let signalCount = 0;

  for (const interaction of interactions) {
    const weight = WEIGHTS[interaction.type] ?? 0;
    if (weight === 0) continue;
    const recipe = recipesById.get(interaction.recipeId);
    if (!recipe) continue;

    profile.cuisineScores[recipe.cuisine] = (profile.cuisineScores[recipe.cuisine] ?? 0) + weight;
    profile.proteinScores[recipe.proteinType] = (profile.proteinScores[recipe.proteinType] ?? 0) + weight;
    for (const tag of recipe.dietaryTags.split(",").filter(Boolean)) {
      profile.tagScores[tag] = (profile.tagScores[tag] ?? 0) + weight;
    }

    if (recipe.totalMinutes <= 30) quickSignal += weight;
    else if (recipe.totalMinutes > 45) quickSignal -= weight * 0.5;

    const { costPerServing } = recipeCost(recipe);
    if (costPerServing <= 3) cheapSignal += weight;
    else if (costPerServing > 5) cheapSignal -= weight * 0.5;

    if ((recipe.protein ?? 0) >= 30) proteinSignal += weight;

    signalCount += Math.abs(weight);
  }

  const norm = Math.max(1, signalCount);
  profile.likesQuick = clamp(quickSignal / norm);
  profile.likesCheap = clamp(cheapSignal / norm);
  profile.likesHighProtein = clamp(proteinSignal / norm);

  return profile;
}

export function scoreRecipe(recipe: RecipeWithIngredients, profile: TasteProfile): number {
  let score = 0;
  score += profile.cuisineScores[recipe.cuisine] ?? 0;
  score += (profile.proteinScores[recipe.proteinType] ?? 0) * 0.8;
  for (const tag of recipe.dietaryTags.split(",").filter(Boolean)) {
    score += (profile.tagScores[tag] ?? 0) * 0.5;
  }

  if (recipe.totalMinutes <= 30) score += profile.likesQuick * 3;
  const { costPerServing } = recipeCost(recipe);
  if (costPerServing <= 3) score += profile.likesCheap * 3;
  if ((recipe.protein ?? 0) >= 30) score += profile.likesHighProtein * 3;

  return score;
}

export function rankForDiscovery(
  recipes: RecipeWithIngredients[],
  profile: TasteProfile,
  seenRecipeIds: Set<string>,
): RecipeWithIngredients[] {
  const unseen = recipes.filter((r) => !seenRecipeIds.has(r.id));
  // Add small deterministic jitter (based on id) so a cold-start profile
  // doesn't always show recipes in the same seed order.
  return unseen
    .map((r) => ({ recipe: r, score: scoreRecipe(r, profile) + hashJitter(r.id) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.recipe);
}

function clamp(n: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function hashJitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return (h / 1000) * 0.5;
}
