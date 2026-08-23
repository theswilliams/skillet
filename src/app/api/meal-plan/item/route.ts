import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";

// Add a meal to a specific day of the current plan (creating a plan if needed).
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { mealPlanId, recipeId, dayIndex, servings } = (await req.json()) as {
    mealPlanId: string;
    recipeId: string;
    dayIndex: number;
    servings?: number;
  };

  const plan = await prisma.mealPlan.findFirst({ where: { id: mealPlanId, userId } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const existing = await prisma.mealPlanItem.findFirst({ where: { mealPlanId, dayIndex, slot: "dinner" } });
  if (existing) await prisma.mealPlanItem.delete({ where: { id: existing.id } });

  const item = await prisma.mealPlanItem.create({
    data: { mealPlanId, recipeId, dayIndex, slot: "dinner", servings: servings ?? plan.householdSize },
  });

  await prisma.recipeInteraction.create({ data: { userId, recipeId, type: "planned" } });

  return NextResponse.json({ item });
}
