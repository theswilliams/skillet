/**
 * Deterministic unit conversion. Every ingredient has a `baseUnit`
 * (g | ml | unit) and a price expressed per base unit; recipe quantities are
 * normalised into that base unit before any cost or consolidation math runs.
 */

export type BaseUnit = "g" | "ml" | "unit";

const MASS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  lbs: 453.592,
};

const VOLUME: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.929,
  tbsp: 14.787,
  cup: 236.588,
  "fl oz": 29.574,
  pint: 473.176,
};

// Countable units that map 1:1 onto "unit"
const COUNT: Record<string, number> = {
  unit: 1,
  units: 1,
  piece: 1,
  pieces: 1,
  clove: 1,
  cloves: 1,
  slice: 1,
  slices: 1,
  can: 1,
  cans: 1,
  bunch: 1,
  head: 1,
  sprig: 1,
  stalk: 1,
  pinch: 1,
  handful: 1,
  sheet: 1,
  fillet: 1,
  breast: 1,
};

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

/** Convert `quantity unit` into the ingredient's base unit. */
export function toBase(
  quantity: number,
  unit: string,
  baseUnit: BaseUnit,
  densityGPerMl?: number | null,
): number {
  const u = normalizeUnit(unit);

  if (baseUnit === "unit") {
    if (u in COUNT) return quantity;
    // A mass/volume amount of a countable thing: fall back to the raw number
    // rather than silently zeroing out the cost.
    return quantity;
  }

  if (baseUnit === "g") {
    if (u in MASS) return quantity * MASS[u];
    if (u in VOLUME) return quantity * VOLUME[u] * (densityGPerMl ?? 1);
    if (u in COUNT) return quantity; // handled by per-unit priced ingredients
    return quantity;
  }

  // baseUnit === "ml"
  if (u in VOLUME) return quantity * VOLUME[u];
  if (u in MASS) return (quantity * MASS[u]) / (densityGPerMl ?? 1);
  return quantity;
}

/** Human-friendly display of an amount held in base units. */
export function formatBase(amount: number, baseUnit: BaseUnit): string {
  if (baseUnit === "unit") {
    return `${round(amount, 2)}`;
  }
  if (baseUnit === "g") {
    return amount >= 1000 ? `${round(amount / 1000, 2)} kg` : `${round(amount, 0)} g`;
  }
  return amount >= 1000 ? `${round(amount / 1000, 2)} L` : `${round(amount, 0)} ml`;
}

export function formatQuantity(quantity: number, unit: string): string {
  const u = normalizeUnit(unit);
  const q = round(quantity, 2);
  if (u === "unit" || u === "units") return `${q}`;
  return `${q} ${unit}`;
}

export function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((n + Number.EPSILON) * f) / f;
}
