import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/serialize";
import { getCurrentUserId } from "@/lib/currentUser";
import { buildTasteProfile, rankForDiscovery } from "@/lib/services/recommend";
import { visibleRecipesWhere } from "@/lib/services/visibility";

export async function GET() {
  const userId = await getCurrentUserId();

  const [recipes, interactions] = await Promise.all([
    prisma.recipe.findMany({ where: visibleRecipesWhere(userId), include: { ingredients: { include: { ingredient: true } } } }),
    prisma.recipeInteraction.findMany({ where: { userId } }),
  ]);

  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const profile = buildTasteProfile(interactions, recipesById);

  // Don't re-show anything the user already made a swipe decision on.
  const decided = new Set(
    interactions.filter((i) => ["liked", "disliked", "skipped", "saved"].includes(i.type)).map((i) => i.recipeId),
  );

  const ranked = rankForDiscovery(recipes, profile, decided);

  return NextResponse.json({ recipes: ranked.slice(0, 30).map(serializeRecipe) });
}
