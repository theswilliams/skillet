import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/serialize";
import { filterRecipes } from "@/lib/services/query";
import { rankByMajorityMatch } from "@/lib/services/pantry";
import { getCurrentUserId } from "@/lib/currentUser";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const csv = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? undefined;

  const recipes = await prisma.recipe.findMany({ include: { ingredients: { include: { ingredient: true } } } });

  let pantryIngredientIds: Set<string> | undefined;
  const availability = params.get("availability") as "have" | "one-missing" | "two-missing" | "majority" | null;
  if (availability) {
    const userId = await getCurrentUserId();
    const pantry = await prisma.pantryItem.findMany({ where: { userId } });
    pantryIngredientIds = new Set(pantry.map((p) => p.ingredientId));
  }

  const filtered = filterRecipes(recipes, {
    q: params.get("q") ?? undefined,
    cuisines: csv("cuisine"),
    proteins: csv("protein"),
    dietary: csv("dietary"),
    equipment: csv("equipment"),
    difficulty: csv("difficulty"),
    mealType: params.get("mealType") ?? undefined,
    maxMinutes: params.get("maxMinutes") ? Number(params.get("maxMinutes")) : undefined,
    minMinutes: params.get("minMinutes") ? Number(params.get("minMinutes")) : undefined,
    maxCostPerServing: params.get("maxCostPerServing") ? Number(params.get("maxCostPerServing")) : undefined,
    availability: availability ?? undefined,
    pantryIngredientIds,
  });

  // Rank "majority" results best-match-first (fully makeable recipes surface
  // above partial matches) instead of leaving them in catalogue order.
  if (availability === "majority" && pantryIngredientIds) {
    const ranked = rankByMajorityMatch(filtered, pantryIngredientIds);
    return NextResponse.json({
      recipes: ranked.map((r) => ({ ...serializeRecipe(r), pantryMatch: r.pantryMatch })),
    });
  }

  return NextResponse.json({ recipes: filtered.map(serializeRecipe) });
}
