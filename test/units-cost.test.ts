import { describe, expect, it } from "vitest";
import { toBase, formatBase, round } from "@/lib/units";
import { recipeCost } from "@/lib/services/cost";
import { recipe } from "./fixtures";

describe("toBase", () => {
  it("converts mass units to grams", () => {
    expect(toBase(2, "kg", "g")).toBe(2000);
    expect(toBase(1, "lb", "g")).toBeCloseTo(453.592, 3);
  });
  it("converts volume to ml, and to grams using density", () => {
    expect(toBase(1, "cup", "ml")).toBeCloseTo(236.588, 3);
    expect(toBase(1, "cup", "g", 0.5)).toBeCloseTo(118.294, 3);
  });
  it("treats countable units as-is for unit-based ingredients", () => {
    expect(toBase(3, "cloves", "unit")).toBe(3);
  });
  it("normalizes unit case and whitespace", () => {
    expect(toBase(1, " KG ", "g")).toBe(1000);
  });
});

describe("formatBase / round", () => {
  it("switches to kg and L at 1000", () => {
    expect(formatBase(1500, "g")).toBe("1.5 kg");
    expect(formatBase(250, "g")).toBe("250 g");
    expect(formatBase(2000, "ml")).toBe("2 L");
  });
  it("rounds to the requested decimals", () => {
    expect(round(1.005, 2)).toBe(1.01);
  });
});

describe("recipeCost", () => {
  it("sums required ingredients and prices optional ones separately", () => {
    const r = recipe(
      "r1",
      [
        { id: "a", qty: 100, price: 0.02 }, // $2.00
        { id: "b", qty: 1, unit: "kg", price: 0.01 }, // 1000 g -> $10.00
        { id: "c", qty: 50, price: 0.02, optional: true }, // $1.00 optional
      ],
      { servings: 4 },
    );
    const c = recipeCost(r);
    expect(c.totalCost).toBe(12);
    expect(c.optionalCost).toBe(1);
    expect(c.costPerServing).toBe(3);
  });
  it("does not divide by zero servings", () => {
    const r = recipe("r2", [{ id: "a", qty: 100, price: 0.01 }], { servings: 0 });
    expect(recipeCost(r).costPerServing).toBe(1);
  });
});
