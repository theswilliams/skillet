import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";
import { generateMealPlan } from "@/lib/services/planner";
import { buildTasteProfile } from "@/lib/services/recommend";
import { calculateIngredientEfficiency } from "@/lib/services/efficiency";
import { scaledIngredientCost } from "@/lib/services/cost";
import { serializeRecipe } from "@/lib/serialize";
import { visibleRecipesWhere } from "@/lib/services/visibility";
import { generatePlanSchema, firstError } from "@/lib/validation";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function loadPlanForClient(planId: string) {
  const plan = await prisma.mealPlan.findUnique({
    where: { id: planId },
    include: {
      items: {
        include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } },
        orderBy: { dayIndex: "asc" },
      },
    },
  });
  if (!plan) return null;

  const efficiency = calculateIngredientEfficiency(plan.items.map((i) => i.recipe));
  const estimatedCost = round2(
    plan.items.reduce((sum, item) => {
      const multiplier = item.servings / Math.max(1, item.recipe.servings);
      return (
        sum +
        item.recipe.ingredients
          .filter((ri) => !ri.optional)
          .reduce((s, ri) => s + scaledIngredientCost(ri, multiplier), 0)
      );
    }, 0),
  );

  return {
    id: plan.id,
    title: plan.title,
    weekStart: plan.weekStart,
    budget: plan.budget,
    householdSize: plan.householdSize,
    items: plan.items.map((item) => ({
      id: item.id,
      dayIndex: item.dayIndex,
      slot: item.slot,
      servings: item.servings,
      cooked: item.cooked,
      recipe: serializeRecipe(item.recipe),
    })),
    efficiency,
    estimatedCost,
  };
}

export async function GET() {
  const userId = await getCurrentUserId();
  const weekStart = startOfWeek();

  const plan = await prisma.mealPlan.findFirst({
    where: { userId, weekStart },
    orderBy: { createdAt: "desc" },
  });

  if (!plan) return NextResponse.json({ plan: null });

  return NextResponse.json({ plan: await loadPlanForClient(plan.id) });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const parsedBody = generatePlanSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) return NextResponse.json({ error: firstError(parsedBody) }, { status: 400 });
  const body = parsedBody.data;

  const [prefs, recipes, interactions] = await Promise.all([
    prisma.userPreferences.upsert({ where: { userId }, update: {}, create: { userId } }),
    prisma.recipe.findMany({ where: visibleRecipesWhere(userId), include: { ingredients: { include: { ingredient: true } } } }),
    prisma.recipeInteraction.findMany({ where: { userId } }),
  ]);

  const days = body.days ?? 7;
  const budget = body.budget ?? prefs.weeklyBudget;
  const householdSize = body.householdSize ?? prefs.householdSize;
  const maxCookTime = body.maxCookTime ?? prefs.maxCookTime;

  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const profile = buildTasteProfile(interactions, recipesById);

  const generated = generateMealPlan(recipes, {
    days,
    householdSize,
    weeklyBudget: budget,
    maxCookTime,
    favoriteCuisines: prefs.favoriteCuisines.split(",").filter(Boolean),
    dislikedIngredientSlugs: prefs.dislikedIngredients.split(",").filter(Boolean),
    dietaryTags: prefs.dietaryTags.split(",").filter(Boolean),
    equipment: prefs.equipment.split(",").filter(Boolean),
  }, profile);

  const weekStart = startOfWeek();

  // Replace any existing plan for this week to keep things simple for the MVP.
  const existing = await prisma.mealPlan.findFirst({ where: { userId, weekStart } });
  if (existing) await prisma.mealPlan.delete({ where: { id: existing.id } });

  const plan = await prisma.mealPlan.create({
    data: {
      userId,
      weekStart,
      budget,
      householdSize,
      items: {
        create: generated.meals.map((m, idx) => ({
          recipeId: m.recipe.id,
          dayIndex: idx,
          slot: "dinner",
          servings: m.servings,
        })),
      },
    },
  });

  for (const m of generated.meals) {
    await prisma.recipeInteraction.create({ data: { userId, recipeId: m.recipe.id, type: "planned" } });
  }

  return NextResponse.json({ plan: await loadPlanForClient(plan.id) });
}
