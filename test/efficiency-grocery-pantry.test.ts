import { describe, expect, it } from "vitest";
import { calculateIngredientEfficiency } from "@/lib/services/efficiency";
import { consolidateIngredients, groupByCategory, type PlanItemWithRecipe } from "@/lib/services/grocery";
import { matchPantry } from "@/lib/services/pantry";
import { recipe } from "./fixtures";

describe("calculateIngredientEfficiency", () => {
  it("counts non-staple ingredients used in 2+ recipes", () => {
    const a = recipe("a", [{ id: "onion", qty: 1 }, { id: "chicken", qty: 1 }, { id: "salt", qty: 1, staple: true }]);
    const b = recipe("b", [{ id: "onion", qty: 1 }, { id: "rice", qty: 1 }, { id: "salt", qty: 1, staple: true }]);
    const e = calculateIngredientEfficiency([a, b]);
    expect(e.uniqueIngredientCount).toBe(3); // onion, chicken, rice (salt is a staple)
    expect(e.sharedIngredientCount).toBe(1);
    expect(e.efficiencyPct).toBe(33);
  });
  it("ignores optional ingredients", () => {
    const a = recipe("a", [{ id: "x", qty: 1 }, { id: "y", qty: 1, optional: true }]);
    const b = recipe("b", [{ id: "y", qty: 1 }]);
    expect(calculateIngredientEfficiency([a, b]).sharedIngredientCount).toBe(0);
  });
  it("is 100% for an empty plan", () => {
    expect(calculateIngredientEfficiency([]).efficiencyPct).toBe(100);
  });
});

describe("consolidateIngredients", () => {
  const item = (r: ReturnType<typeof recipe>, servings: number) =>
    ({ id: `i-${r.id}`, servings, recipe: r }) as unknown as PlanItemWithRecipe;

  it("merges one ingredient across recipes and scales by servings", () => {
    const a = recipe("a", [{ id: "rice", qty: 200, price: 0.01 }], { servings: 2 });
    const b = recipe("b", [{ id: "rice", qty: 100, price: 0.01 }], { servings: 2 });
    // a scaled x2 (4 servings of a 2-serving recipe) = 400g, b as-is = 100g
    const list = consolidateIngredients([item(a, 4), item(b, 2)]);
    expect(list).toHaveLength(1);
    expect(list[0].totalBaseQuantity).toBe(500);
    expect(list[0].estimatedCost).toBe(5);
    expect(list[0].usedInRecipes.sort()).toEqual(["a", "b"]);
  });
  it("skips optional ingredients", () => {
    const a = recipe("a", [{ id: "x", qty: 10, optional: true }]);
    expect(consolidateIngredients([item(a, 2)])).toHaveLength(0);
  });
  it("groups by category with all standard categories present", () => {
    const groups = groupByCategory([{ category: "produce" }, { category: "weird" }]);
    expect(groups.produce).toHaveLength(1);
    expect(groups.weird).toHaveLength(1);
    expect(groups.dairy).toEqual([]);
  });
});

describe("matchPantry", () => {
  const r = recipe("r", [
    { id: "chicken", qty: 1, primary: true },
    { id: "rice", qty: 1, primary: true },
    { id: "salt", qty: 1, staple: true },
    { id: "herb", qty: 1 },
  ]);
  it("treats staples as always on hand", () => {
    const m = matchPantry(r, new Set(["chicken", "rice", "herb"]));
    expect(m.canMake).toBe(true);
    expect(m.matchPct).toBe(100);
  });
  it("reports majority match on primary ingredients even when minor ones are missing", () => {
    const m = matchPantry(r, new Set(["chicken", "rice"]));
    expect(m.canMake).toBe(false);
    expect(m.majorityMatch).toBe(true);
    expect(m.missing.map((x) => x.slug)).toEqual(["herb"]);
  });
  it("requires MORE than half of primary ingredients for a majority match", () => {
    const m = matchPantry(r, new Set(["chicken"]));
    expect(m.primaryMatchPct).toBe(50);
    expect(m.majorityMatch).toBe(false);
  });
  it("never counts optional ingredients against makeability", () => {
    const o = recipe("o", [{ id: "a", qty: 1 }, { id: "b", qty: 1, optional: true }]);
    expect(matchPantry(o, new Set(["a"])).canMake).toBe(true);
  });
});
