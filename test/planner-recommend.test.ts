import { describe, expect, it } from "vitest";
import { generateMealPlan, suggestReplacement, type PlanConstraints } from "@/lib/services/planner";
import { buildTasteProfile, scoreRecipe, type TasteProfile } from "@/lib/services/recommend";
import { recipe } from "./fixtures";

const emptyProfile: TasteProfile = {
  cuisineScores: {},
  proteinScores: {},
  likesQuick: 0,
  likesCheap: 0,
  likesHighProtein: 0,
  tagScores: {},
};

const base: PlanConstraints = {
  days: 3,
  householdSize: 2,
  weeklyBudget: 100,
  maxCookTime: 60,
  favoriteCuisines: [],
  dislikedIngredientSlugs: [],
  dietaryTags: [],
  equipment: [],
};

// each recipe costs $10 for 2 servings (1000 g at $0.01)
const cheap = (id: string, extra: Parameters<typeof recipe>[2] = {}) =>
  recipe(id, [{ id: `${id}-main`, qty: 1000, price: 0.01, primary: true }], extra);

describe("generateMealPlan", () => {
  const pool = [cheap("a"), cheap("b", { cuisine: "thai" }), cheap("c", { cuisine: "mexican" }), cheap("d", { cuisine: "indian" })];

  it("fills the requested days with distinct recipes", () => {
    const plan = generateMealPlan(pool, base, emptyProfile);
    expect(plan.meals).toHaveLength(3);
    expect(new Set(plan.meals.map((m) => m.recipe.id)).size).toBe(3);
  });
  it("stays within budget when affordable recipes exist", () => {
    const plan = generateMealPlan(pool, { ...base, weeklyBudget: 25 }, emptyProfile);
    expect(plan.totalCost).toBeLessThanOrEqual(25);
    expect(plan.meals.length).toBe(2); // a third $10 meal would exceed $25
  });
  it("respects max cook time and disliked ingredients", () => {
    const slow = cheap("slow", { totalMinutes: 120 });
    const disliked = recipe("dis", [{ id: "cilantro", qty: 10 }]);
    const plan = generateMealPlan(
      [slow, disliked, cheap("ok")],
      { ...base, days: 3, maxCookTime: 45, dislikedIngredientSlugs: ["cilantro"] },
      emptyProfile,
    );
    expect(plan.meals.map((m) => m.recipe.id)).toEqual(["ok"]);
  });
  it("only plans the requested meal type", () => {
    const plan = generateMealPlan([cheap("bf", { mealType: "breakfast" }), cheap("din")], base, emptyProfile);
    expect(plan.meals.map((m) => m.recipe.id)).toEqual(["din"]);
  });
  it("prefers the user's favourite cuisines on the first pick", () => {
    const plan = generateMealPlan(pool, { ...base, days: 1, favoriteCuisines: ["indian"] }, emptyProfile);
    expect(plan.meals[0].recipe.id).toBe("d");
  });
  it("returns an empty plan for no candidates", () => {
    expect(generateMealPlan([], base, emptyProfile).meals).toEqual([]);
  });
  // Documents current behaviour (also noted in the README): if the hard filters
  // remove every recipe they are relaxed rather than returning an empty plan.
  it("relaxes hard filters when nothing matches them", () => {
    const plan = generateMealPlan([cheap("slow", { totalMinutes: 120 })], { ...base, days: 1, maxCookTime: 30 }, emptyProfile);
    expect(plan.meals).toHaveLength(1);
  });
});

describe("suggestReplacement", () => {
  const constraints = { maxCookTime: 60, dietaryTags: [], dislikedIngredientSlugs: [] };
  it("never suggests a recipe already in the plan", () => {
    const pool = [cheap("a"), cheap("b")];
    expect(suggestReplacement(pool, ["a"], [pool[0]], constraints, emptyProfile)?.id).toBe("b");
  });
  it("returns null when nothing qualifies", () => {
    expect(suggestReplacement([cheap("a")], ["a"], [], constraints, emptyProfile)).toBeNull();
  });
});

describe("taste profile", () => {
  const recipes = new Map([
    ["r1", cheap("r1", { cuisine: "thai" })],
    ["r2", cheap("r2", { cuisine: "italian" })],
  ]);
  const inter = (recipeId: string, type: string) => ({ recipeId, type }) as never;

  it("raises scores for liked/cooked cuisines and lowers them for skipped ones", () => {
    const p = buildTasteProfile([inter("r1", "liked"), inter("r1", "cooked"), inter("r2", "skipped")], recipes as never);
    expect(p.cuisineScores.thai).toBeGreaterThan(0);
    expect(p.cuisineScores.italian).toBeLessThan(0);
  });
  it("ignores unknown interaction types and unknown recipes", () => {
    const p = buildTasteProfile([inter("r1", "mystery"), inter("missing", "liked")], recipes as never);
    expect(p.cuisineScores).toEqual({});
  });
  it("scores a liked cuisine above a neutral one", () => {
    const p = buildTasteProfile([inter("r1", "liked")], recipes as never);
    expect(scoreRecipe(recipes.get("r1") as never, p)).toBeGreaterThan(scoreRecipe(recipes.get("r2") as never, p));
  });
});
