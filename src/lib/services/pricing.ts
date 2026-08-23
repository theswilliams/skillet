import type { Ingredient, IngredientPrice } from "@prisma/client";

/**
 * Multi-store pricing. Real grocery-store price feeds require paid API
 * partnerships (Walmart, Loblaws, etc. don't expose free public pricing
 * APIs), so this ships with deterministic mock per-store pricing seeded
 * into IngredientPrice (source: "mock-store") — same shape a real feed
 * would use, so swapping in a live API later is a data-source change, not
 * an architecture change.
 *
 * Resolution order for a single "best price": user override > store price
 * (cheapest available) > region default > the ingredient's seed price.
 */

export const GROCERY_STORES = ["Walmart", "No Frills", "Loblaws", "Sobeys", "Costco"] as const;
export type GroceryStore = (typeof GROCERY_STORES)[number];

// Deterministic per-store price multiplier by category, modeling each
// chain's general positioning (discount vs. full-service vs. bulk).
const STORE_CATEGORY_MULTIPLIER: Record<GroceryStore, Record<string, number>> = {
  "No Frills": { produce: 0.88, meat: 0.85, dairy: 0.9, pantry: 0.87, frozen: 0.88, bakery: 0.85, other: 0.9 },
  Walmart: { produce: 0.92, meat: 0.9, dairy: 0.93, pantry: 0.9, frozen: 0.91, bakery: 0.88, other: 0.92 },
  Sobeys: { produce: 1.08, meat: 1.05, dairy: 1.04, pantry: 1.06, frozen: 1.05, bakery: 1.08, other: 1.05 },
  Loblaws: { produce: 1.05, meat: 1.03, dairy: 1.02, pantry: 1.04, frozen: 1.03, bakery: 1.06, other: 1.03 },
  Costco: { produce: 0.8, meat: 0.78, dairy: 0.82, pantry: 0.75, frozen: 0.8, bakery: 0.82, other: 0.8 },
};

/** Small deterministic per-ingredient jitter so prices aren't uniform within a category. */
function hashJitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 10000;
  return 0.94 + (h / 10000) * 0.12; // 0.94–1.06
}

export function mockStorePrice(ingredient: Pick<Ingredient, "slug" | "category" | "pricePerBaseUnit">, store: GroceryStore): number {
  const categoryMult = STORE_CATEGORY_MULTIPLIER[store][ingredient.category] ?? 1;
  const jitter = hashJitter(`${store}:${ingredient.slug}`);
  return round2(ingredient.pricePerBaseUnit * categoryMult * jitter);
}

/**
 * Resolves the price to use for one ingredient: cheapest live store price
 * on file beats the ingredient's seed price. User-entered prices (source:
 * "user") always win when present.
 */
export function resolvePrice(ingredient: Ingredient, prices: IngredientPrice[]): number {
  const userPrice = prices.find((p) => p.source === "user");
  if (userPrice) return userPrice.pricePerBaseUnit;

  const storePrices = prices.filter((p) => p.source === "mock-store" || p.source === "store" || p.source === "api");
  if (storePrices.length > 0) {
    return Math.min(...storePrices.map((p) => p.pricePerBaseUnit));
  }

  return ingredient.pricePerBaseUnit;
}

export type StoreComparisonLine = {
  store: GroceryStore;
  total: number;
};

/**
 * Totals a set of {ingredient, quantityInBaseUnit} lines against each
 * store's mock pricing, so a grocery list can show "cheapest store" and a
 * per-store subtotal.
 */
export function compareStoresForList(
  lines: { ingredient: Pick<Ingredient, "slug" | "category" | "pricePerBaseUnit">; baseQuantity: number }[],
): StoreComparisonLine[] {
  return GROCERY_STORES.map((store) => ({
    store,
    total: round2(lines.reduce((sum, l) => sum + mockStorePrice(l.ingredient, store) * l.baseQuantity, 0)),
  })).sort((a, b) => a.total - b.total);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
