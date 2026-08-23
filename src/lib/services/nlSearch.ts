/**
 * Natural-language search — deterministic parser today, LLM-swappable later.
 *
 * `parseQuery` extracts structured filters from free text using pattern
 * matching (numbers, cuisine/protein/dietary keyword lists, time/cost
 * phrases, "I have X, Y, Z" ingredient lists). It intentionally returns the
 * same `ParsedQuery` shape an LLM-backed parser would return, so
 * `interpretQuery` can be swapped for a call to an LLM (see the commented
 * hook below) without changing any caller.
 */

export type ParsedQuery = {
  raw: string;
  maxTime?: number;
  maxCostPerServing?: number;
  maxTotalBudget?: number;
  mealsRequested?: number;
  peopleCount?: number;
  cuisines: string[];
  proteins: string[];
  dietaryTags: string[];
  haveIngredients: string[];
  keywords: string[];
};

const CUISINES = [
  "italian", "mexican", "chinese", "japanese", "korean", "thai", "indian",
  "mediterranean", "american",
];

const PROTEINS = ["chicken", "beef", "pork", "fish", "seafood", "vegetarian", "vegan", "shrimp", "tofu"];

const DIETARY = ["high-protein", "low-carb", "vegetarian", "vegan", "gluten-free", "dairy-free", "high protein", "gluten free", "dairy free"];

const STOPWORDS = new Set([
  "give", "me", "a", "an", "the", "for", "with", "and", "that", "under",
  "less", "than", "need", "some", "please", "i", "have", "of", "to", "my",
  "we", "us", "want", "would", "like", "can", "make", "recipes", "recipe",
  "dinners", "dinner", "meals", "meal", "cheap",
]);

export function parseQuery(input: string): ParsedQuery {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const result: ParsedQuery = {
    raw,
    cuisines: [],
    proteins: [],
    dietaryTags: [],
    haveIngredients: [],
    keywords: [],
  };

  // Time: "under 30 minutes", "30 min", "less than 20 minutes"
  const timeMatch = lower.match(/(\d+)\s*(?:min|mins|minutes)/);
  if (timeMatch) result.maxTime = parseInt(timeMatch[1], 10);

  // Cost per serving: "under $3/serving", "$2 per serving", "under $5 a serving"
  const perServingMatch = lower.match(/\$?(\d+(?:\.\d+)?)\s*(?:\/|per|a)\s*serving/);
  if (perServingMatch) result.maxCostPerServing = parseFloat(perServingMatch[1]);

  // Total budget: "under $60", "for $75", "$60 for 5 dinners"
  const budgetMatch = lower.match(/\$(\d+(?:\.\d+)?)(?!\s*(?:\/|per|a)\s*serving)/);
  if (budgetMatch && !perServingMatch) result.maxTotalBudget = parseFloat(budgetMatch[1]);

  // "5 dinners", "7 meals"
  const mealsMatch = lower.match(/(\d+)\s*(?:dinners?|meals?|recipes?)/);
  if (mealsMatch) result.mealsRequested = parseInt(mealsMatch[1], 10);

  // "for 2 people", "for two", "for 4"
  const peopleMatch = lower.match(/for\s+(\d+)\s*(?:people|person|adults)?/);
  if (peopleMatch) result.peopleCount = parseInt(peopleMatch[1], 10);

  for (const c of CUISINES) if (lower.includes(c)) result.cuisines.push(capitalize(c));
  for (const p of PROTEINS) if (lower.includes(p)) result.proteins.push(p);
  for (const d of DIETARY) if (lower.includes(d)) result.dietaryTags.push(d.replace(" ", "-"));

  // "I have chicken, rice, broccoli and eggs" — pull the ingredient list
  const haveMatch = lower.match(/(?:i have|with)\s+([a-z,\s]+?)(?:\.|$)/);
  if (haveMatch) {
    result.haveIngredients = haveMatch[1]
      .split(/,|and/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && !STOPWORDS.has(s));
  }

  result.keywords = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !CUISINES.includes(w) && !PROTEINS.includes(w));

  return result;
}

/**
 * Hook point for an LLM-backed implementation. Swap the body of this
 * function for a call to an LLM that returns the same ParsedQuery shape
 * (e.g. via structured output / tool calling) — every caller of
 * `interpretQuery` keeps working unchanged.
 */
export async function interpretQuery(input: string): Promise<ParsedQuery> {
  return parseQuery(input);
}

function capitalize(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
