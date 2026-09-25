/**
 * Recipe URL import: fetches a page and parses its schema.org Recipe
 * structured data (JSON-LD), the same machine-readable markup recipe sites
 * publish so Google can show rich recipe results in search. Reading that
 * markup for a signed-in user's own personal recipe box is the standard,
 * legitimate approach used by recipe-manager apps — it's not scraping page
 * prose, and nothing is redistributed beyond the importing user's account.
 *
 * Best-effort only: sites that don't publish Recipe JSON-LD can't be
 * imported this way (no OCR/video parsing here — see the future-features
 * list for that).
 */

import { safeFetchHtml } from "@/lib/security/safeFetch";
import { isAllowedImageUrl } from "@/lib/imageHosts";

export const MAX_INGREDIENT_LINES = 60;
export const MAX_INSTRUCTION_STEPS = 60;
const MAX_LINE_LENGTH = 300;

export type ParsedImportedRecipe = {
  name: string;
  description: string;
  imageUrl: string | null;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  ingredientLines: string[]; // raw "2 cups flour"-style lines, parsed downstream
  instructions: string[];
  sourceUrl: string;
};

function parseIsoDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const match = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!match) return 0;
  const days = parseInt(match[1] ?? "0", 10);
  const hours = parseInt(match[2] ?? "0", 10);
  const minutes = parseInt(match[3] ?? "0", 10);
  return days * 1440 + hours * 60 + minutes;
}

function flattenInstructions(instructions: unknown): string[] {
  if (!instructions) return [];
  if (typeof instructions === "string") {
    return instructions
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(instructions)) {
    return instructions.flatMap((step): string[] => {
      if (typeof step === "string") return [step];
      if (step && typeof step === "object") {
        const s = step as Record<string, unknown>;
        if (s["@type"] === "HowToSection" && Array.isArray(s.itemListElement)) {
          return flattenInstructions(s.itemListElement);
        }
        if (typeof s.text === "string") return [s.text];
        if (typeof s.name === "string") return [s.name];
      }
      return [];
    });
  }
  return [];
}

function firstImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return firstImage(image[0]);
  if (typeof image === "object") {
    const obj = image as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
  }
  return null;
}

/** First sentence only, hard-capped — never the full source description. */
function shortDescription(raw: unknown, fallbackName: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    return typeof fallbackName === "string" ? `Imported recipe: ${fallbackName}` : "Imported recipe.";
  }
  const stripped = raw.replace(/\s+/g, " ").trim();
  const firstSentence = stripped.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? stripped;
  const capped = firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}...` : firstSentence;
  return capped;
}

function parseServings(yieldVal: unknown): number {
  if (typeof yieldVal === "number") return yieldVal;
  if (typeof yieldVal === "string") {
    const match = yieldVal.match(/\d+/);
    if (match) return parseInt(match[0], 10);
  }
  if (Array.isArray(yieldVal)) return parseServings(yieldVal[0]);
  return 4;
}

/**
 * Walks a JSON-LD graph (possibly wrapped in @graph or an array) collecting
 * every Recipe node found. Pages often embed more than one — the page's own
 * recipe plus "related recipes" widgets — so the caller picks the one that
 * actually matches the requested page rather than just taking the first.
 */
function findAllRecipeNodes(json: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!json) return out;
  if (Array.isArray(json)) {
    for (const item of json) findAllRecipeNodes(item, out);
    return out;
  }
  if (typeof json === "object") {
    const obj = json as Record<string, unknown>;
    const type = obj["@type"];
    const isRecipe = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
    if (isRecipe) out.push(obj);
    if (Array.isArray(obj["@graph"])) findAllRecipeNodes(obj["@graph"], out);
  }
  return out;
}

/** Prefers the Recipe node whose own url/mainEntityOfPage matches the page we fetched. */
function pickMatchingRecipe(nodes: Record<string, unknown>[], pageUrl: string): Record<string, unknown> | null {
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];

  const normalize = (u: string) => u.replace(/\/$/, "").toLowerCase();
  const target = normalize(pageUrl);

  const matched = nodes.find((n) => {
    const candidates: unknown[] = [n.url, n.mainEntityOfPage];
    return candidates.some((c) => {
      const s = typeof c === "string" ? c : (c as { "@id"?: string } | undefined)?.["@id"];
      return typeof s === "string" && normalize(s) === target;
    });
  });

  return matched ?? nodes[0];
}

export async function fetchAndParseRecipe(url: string): Promise<ParsedImportedRecipe> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  // SSRF-safe fetch: public hosts only (re-checked on every redirect), timeout,
  // content-type and size limits. See src/lib/security/safeFetch.ts.
  const { html, status, finalUrl } = await safeFetchHtml(parsed, {
    // A standard browser User-Agent: many recipe sites block unrecognized agents outright.
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  });
  if (!html) throw new Error(`Couldn't fetch that page (${status}).`);
  parsed = finalUrl;
  const scriptMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  const allRecipeNodes: Record<string, unknown>[] = [];
  for (const m of scriptMatches) {
    try {
      const json = JSON.parse(m[1].trim());
      findAllRecipeNodes(json, allRecipeNodes);
    } catch {
      // Some sites ship slightly-invalid JSON-LD; skip and try the next script block.
    }
  }

  const recipeNode = pickMatchingRecipe(allRecipeNodes, parsed.toString());

  if (!recipeNode) {
    throw new Error("Couldn't find recipe data on that page. Not every site publishes structured recipe data.");
  }

  const ingredientLines = (
    (recipeNode.recipeIngredient as unknown[]) ||
    (recipeNode.ingredients as unknown[]) ||
    []
  )
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, MAX_LINE_LENGTH))
    .filter(Boolean)
    // Bound what one import can write to the shared catalog (each line may create an ingredient row).
    .slice(0, MAX_INGREDIENT_LINES);

  return {
    name: typeof recipeNode.name === "string" ? recipeNode.name : "Imported Recipe",
    // Kept short and truncated: the schema.org description field is often a
    // full personal-blog narrative (someone's story about the dish), not a
    // one-line summary — reproducing that verbatim into a catalog table
    // would be redistribution, not personal use. Full context always stays
    // one click away via sourceUrl.
    description: shortDescription(recipeNode.description, recipeNode.name),
    // Only keep images from allow-listed hosts: an arbitrary third-party URL would be fetched by every
    // visitor's browser (tracking, mixed content, intranet probes). Others fall back to the gradient card.
    imageUrl: ((img) => (isAllowedImageUrl(img) ? img : null))(firstImage(recipeNode.image)),
    prepMinutes: parseIsoDuration(recipeNode.prepTime as string | undefined),
    cookMinutes: parseIsoDuration(recipeNode.cookTime as string | undefined) || parseIsoDuration(recipeNode.totalTime as string | undefined),
    servings: parseServings(recipeNode.recipeYield),
    ingredientLines,
    instructions: flattenInstructions(recipeNode.recipeInstructions)
      .slice(0, MAX_INSTRUCTION_STEPS)
      .map((s) => s.slice(0, MAX_LINE_LENGTH * 4)),
    sourceUrl: parsed.toString(),
  };
}

// ---- Ingredient-line parsing ----

const UNIT_WORDS = [
  "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
  "g", "gram", "grams", "kg", "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
  "ml", "milliliter", "milliliters", "l", "liter", "liters", "clove", "cloves",
  "can", "cans", "pinch", "slice", "slices", "piece", "pieces", "bunch", "unit", "units",
];

export type ParsedIngredientLine = {
  quantity: number;
  unit: string;
  name: string;
  raw: string;
};

/**
 * Best-effort parse of a free-text ingredient line into quantity/unit/name.
 * Recipe sites format these wildly inconsistently, so this is deliberately
 * forgiving: anything it can't confidently parse falls back to quantity 1,
 * unit "unit", with the full line as the name — still usable, just not
 * priced precisely until a user edits it.
 */
export function parseIngredientLine(raw: string): ParsedIngredientLine {
  const cleaned = raw.trim();
  // Leading amount: "2", "1 1/2", "1/2", "2.5"
  const amountMatch = cleaned.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/);
  let rest = cleaned;
  let quantity = 1;

  if (amountMatch) {
    quantity = parseFraction(amountMatch[1]);
    rest = cleaned.slice(amountMatch[0].length).trim();
  }

  const words = rest.split(/\s+/);
  const firstWord = (words[0] ?? "").toLowerCase().replace(/[.,]/g, "");
  let unit = "unit";
  if (UNIT_WORDS.includes(firstWord)) {
    unit = normalizeUnitWord(firstWord);
    rest = words.slice(1).join(" ");
  }

  // Drop a parenthetical note and anything after a comma (prep instructions).
  const name = rest.split(",")[0].replace(/\([^)]*\)/g, "").trim() || cleaned;

  return { quantity: quantity || 1, unit, name, raw };
}

function parseFraction(s: string): number {
  if (s.includes(" ")) {
    const [whole, frac] = s.split(" ");
    return parseInt(whole, 10) + parseFraction(frac);
  }
  if (s.includes("/")) {
    const [num, den] = s.split("/").map(Number);
    return den ? num / den : 1;
  }
  return parseFloat(s) || 1;
}

function normalizeUnitWord(w: string): string {
  const map: Record<string, string> = {
    tablespoon: "tbsp", tablespoons: "tbsp",
    teaspoon: "tsp", teaspoons: "tsp",
    gram: "g", grams: "g",
    ounce: "oz", ounces: "oz",
    pound: "lb", pounds: "lb", lbs: "lb",
    milliliter: "ml", milliliters: "ml",
    liter: "l", liters: "l",
    cans: "can", cloves: "clove", slices: "slice", pieces: "piece", units: "unit", cups: "cup",
  };
  return map[w] ?? w;
}
