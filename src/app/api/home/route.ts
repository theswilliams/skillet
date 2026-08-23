import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/currentUser";
import { serializeRecipe } from "@/lib/serialize";
import { buildTasteProfile, rankForDiscovery } from "@/lib/services/recommend";
import { calculateIngredientEfficiency } from "@/lib/services/efficiency";
import { countMakeableRecipes } from "@/lib/services/pantry";
import { recipeCost } from "@/lib/services/cost";

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET() {
  const user = await getCurrentUser();
  const userId = user.id;

  const [recipes, interactions, pantry, plan] = await Promise.all([
    prisma.recipe.findMany({ include: { ingredients: { include: { ingredient: true } } } }),
    prisma.recipeInteraction.findMany({ where: { userId } }),
    prisma.pantryItem.findMany({ where: { userId }, include: { ingredient: true } }),
    prisma.mealPlan.findFirst({
      where: { userId, weekStart: startOfWeek() },
      include: { items: { include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } }, orderBy: { dayIndex: "asc" } } },
    }),
  ]);

  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const profile = buildTasteProfile(interactions, recipesById);
  const decided = new Set(interactions.filter((i) => ["liked", "disliked", "skipped"].includes(i.type)).map((i) => i.recipeId));
  const recommended = rankForDiscovery(recipes, profile, decided).slice(0, 8);

  const pantryIds = new Set(pantry.map((p) => p.ingredientId));
  const makeableCount = countMakeableRecipes(recipes, pantryIds);

  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1; // Monday = 0
  const tonight = plan?.items.find((i) => i.dayIndex === todayIndex) ?? plan?.items[0] ?? null;

  const weekEfficiency = plan ? calculateIngredientEfficiency(plan.items.map((i) => i.recipe)) : null;
  const weekCost = plan
    ? plan.items.reduce((sum, item) => sum + recipeCost(item.recipe).totalCost * (item.servings / Math.max(1, item.recipe.servings)), 0)
    : 0;

  return NextResponse.json({
    user: { name: user.name },
    hasPreferences: !!user.preferences?.onboardingComplete,
    tonight: tonight ? { itemId: tonight.id, recipe: serializeRecipe(tonight.recipe), dayIndex: tonight.dayIndex } : null,
    week: plan
      ? {
          id: plan.id,
          mealCount: plan.items.length,
          estimatedCost: round2(weekCost),
          efficiencyPct: weekEfficiency?.efficiencyPct ?? 0,
        }
      : null,
    recommended: recommended.map(serializeRecipe),
    pantry: {
      previewIngredients: pantry.slice(0, 3).map((p) => p.ingredient.name),
      makeableCount,
      hasItems: pantry.length > 0,
    },
  });
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
