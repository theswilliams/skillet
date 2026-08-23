import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";
import { suggestReplacement } from "@/lib/services/planner";
import { buildTasteProfile } from "@/lib/services/recommend";
import { visibleRecipesWhere } from "@/lib/services/visibility";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const item = await prisma.mealPlanItem.findUnique({ where: { id }, include: { mealPlan: true } });
  if (!item || item.mealPlan.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.mealPlanItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const body = (await req.json()) as { cooked?: boolean; action?: "replace"; dayIndex?: number };

  const item = await prisma.mealPlanItem.findUnique({
    where: { id },
    include: { mealPlan: { include: { items: { include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } } } } } },
  });
  if (!item || item.mealPlan.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.dayIndex != null) {
    // Dragging a meal onto an occupied day swaps the two days' recipes.
    const occupying = item.mealPlan.items.find((i) => i.id !== id && i.dayIndex === body.dayIndex);
    if (occupying) {
      await prisma.mealPlanItem.update({ where: { id: occupying.id }, data: { dayIndex: item.dayIndex } });
    }
    const updated = await prisma.mealPlanItem.update({ where: { id }, data: { dayIndex: body.dayIndex } });
    return NextResponse.json({ item: updated });
  }

  if (body.cooked != null) {
    const updated = await prisma.mealPlanItem.update({ where: { id }, data: { cooked: body.cooked } });
    if (body.cooked) {
      await prisma.recipeInteraction.create({ data: { userId, recipeId: item.recipeId, type: "cooked" } });
    }
    return NextResponse.json({ item: updated });
  }

  if (body.action === "replace") {
    const [prefs, allRecipes, interactions] = await Promise.all([
      prisma.userPreferences.upsert({ where: { userId }, update: {}, create: { userId } }),
      prisma.recipe.findMany({ where: visibleRecipesWhere(userId), include: { ingredients: { include: { ingredient: true } } } }),
      prisma.recipeInteraction.findMany({ where: { userId } }),
    ]);
    const recipesById = new Map(allRecipes.map((r) => [r.id, r]));
    const profile = buildTasteProfile(interactions, recipesById);

    const otherMeals = item.mealPlan.items.filter((i) => i.id !== id).map((i) => i.recipe);
    const currentIds = item.mealPlan.items.map((i) => i.recipeId);

    const replacement = suggestReplacement(
      allRecipes,
      currentIds,
      otherMeals,
      {
        maxCookTime: prefs.maxCookTime,
        dietaryTags: prefs.dietaryTags.split(",").filter(Boolean),
        dislikedIngredientSlugs: prefs.dislikedIngredients.split(",").filter(Boolean),
      },
      profile,
    );

    if (!replacement) return NextResponse.json({ error: "No suitable replacement found" }, { status: 404 });

    const updated = await prisma.mealPlanItem.update({ where: { id }, data: { recipeId: replacement.id, cooked: false } });
    await prisma.recipeInteraction.create({ data: { userId, recipeId: replacement.id, type: "planned" } });
    return NextResponse.json({ item: updated, recipeId: replacement.id });
  }

  return NextResponse.json({ error: "No action specified" }, { status: 400 });
}
