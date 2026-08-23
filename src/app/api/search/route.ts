import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/serialize";
import { filterRecipes } from "@/lib/services/query";
import { interpretQuery } from "@/lib/services/nlSearch";
import { matchPantry } from "@/lib/services/pantry";
import { getCurrentUserId } from "@/lib/currentUser";
import { visibleRecipesWhere } from "@/lib/services/visibility";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ recipes: [], parsed: null });

  const parsed = await interpretQuery(q);

  const userId = await getCurrentUserId();
  const recipes = await prisma.recipe.findMany({ where: visibleRecipesWhere(userId), include: { ingredients: { include: { ingredient: true } } } });

  let filtered = filterRecipes(recipes, {
    cuisines: parsed.cuisines.length ? parsed.cuisines : undefined,
    proteins: parsed.proteins.length ? parsed.proteins : undefined,
    dietary: parsed.dietaryTags.length ? parsed.dietaryTags : undefined,
    maxMinutes: parsed.maxTime,
    maxCostPerServing: parsed.maxCostPerServing,
  });

  // If they listed ingredients they have, rank by how well the recipe uses them.
  if (parsed.haveIngredients.length > 0) {
    const allIngredients = await prisma.ingredient.findMany();
    const matchedIds = new Set(
      allIngredients
        .filter((ing) => parsed.haveIngredients.some((h) => ing.name.toLowerCase().includes(h) || h.includes(ing.slug)))
        .map((i) => i.id),
    );
    filtered = filtered
      .map((r) => ({ r, match: matchPantry(r, matchedIds) }))
      .sort((a, b) => b.match.matchPct - a.match.matchPct)
      .map((x) => x.r);
  } else if (parsed.keywords.length > 0) {
    // Fall back to keyword relevance scoring across name/description/cuisine.
    filtered = filtered
      .map((r) => {
        const haystack = `${r.name} ${r.description} ${r.cuisine}`.toLowerCase();
        const score = parsed.keywords.reduce((s, k) => s + (haystack.includes(k) ? 1 : 0), 0);
        return { r, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);
  }

  const limit = parsed.mealsRequested ?? 20;

  return NextResponse.json({
    recipes: filtered.slice(0, Math.max(limit, 10)).map(serializeRecipe),
    parsed,
  });
}
