import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/serialize";
import { getCurrentUserId } from "@/lib/currentUser";
import { matchPantry } from "@/lib/services/pantry";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({
    where: { slug },
    include: { ingredients: { include: { ingredient: true } } },
  });
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const userId = await getCurrentUserId();
  const [pantry, saved] = await Promise.all([
    prisma.pantryItem.findMany({ where: { userId } }),
    prisma.savedRecipe.findUnique({ where: { userId_recipeId: { userId, recipeId: recipe.id } } }),
  ]);
  const pantryMatch = matchPantry(recipe, new Set(pantry.map((p) => p.ingredientId)));

  await prisma.recipeInteraction.create({ data: { userId, recipeId: recipe.id, type: "viewed" } });

  return NextResponse.json({
    recipe: serializeRecipe(recipe),
    pantryMatch,
    isSaved: !!saved,
  });
}
