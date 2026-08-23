import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";
import { consolidateIngredients, groupByCategory } from "@/lib/services/grocery";

async function loadForClient(listId: string) {
  const list = await prisma.groceryList.findUnique({
    where: { id: listId },
    include: { items: { orderBy: { category: "asc" } } },
  });
  if (!list) return null;
  return {
    id: list.id,
    mealPlanId: list.mealPlanId,
    createdAt: list.createdAt,
    items: list.items,
    grouped: groupByCategory(list.items),
    totalCost: round2(list.items.reduce((s, i) => s + i.estimatedCost, 0)),
    checkedCount: list.items.filter((i) => i.checked).length,
  };
}

export async function GET() {
  const userId = await getCurrentUserId();
  const list = await prisma.groceryList.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!list) return NextResponse.json({ list: null });
  return NextResponse.json({ list: await loadForClient(list.id) });
}

// Generate/regenerate a grocery list from a meal plan.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { mealPlanId } = (await req.json()) as { mealPlanId: string };

  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, userId },
    include: { items: { include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } } } },
  });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const pantry = await prisma.pantryItem.findMany({ where: { userId } });
  const pantryIds = new Set(pantry.map((p) => p.ingredientId));

  const consolidated = consolidateIngredients(plan.items);

  const existing = await prisma.groceryList.findFirst({ where: { userId, mealPlanId } });
  if (existing) await prisma.groceryList.delete({ where: { id: existing.id } });

  const list = await prisma.groceryList.create({
    data: {
      userId,
      mealPlanId,
      items: {
        create: consolidated.map((c) => ({
          ingredientId: c.ingredientId,
          name: c.name,
          category: c.category,
          quantity: c.totalBaseQuantity,
          unit: c.baseUnit,
          estimatedCost: c.estimatedCost,
          usedInRecipes: c.usedInRecipes.join(", "),
          havePantry: pantryIds.has(c.ingredientId),
          checked: pantryIds.has(c.ingredientId),
        })),
      },
    },
  });

  return NextResponse.json({ list: await loadForClient(list.id) });
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
