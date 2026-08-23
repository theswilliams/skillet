import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";

export async function GET() {
  const userId = await getCurrentUserId();
  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return NextResponse.json({ preferences: toClient(prefs) });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const userId = await getCurrentUserId();

  const data: Record<string, unknown> = {};
  if (body.householdSize != null) data.householdSize = Number(body.householdSize);
  if (body.weeklyBudget != null) data.weeklyBudget = Number(body.weeklyBudget);
  if (body.currency != null) data.currency = String(body.currency);
  if (body.mealsPerDay != null) data.mealsPerDay = Number(body.mealsPerDay);
  if (body.maxCookTime != null) data.maxCookTime = Number(body.maxCookTime);
  if (body.dietaryTags != null) data.dietaryTags = arrToCsv(body.dietaryTags);
  if (body.dislikedIngredients != null) data.dislikedIngredients = arrToCsv(body.dislikedIngredients);
  if (body.favoriteCuisines != null) data.favoriteCuisines = arrToCsv(body.favoriteCuisines);
  if (body.equipment != null) data.equipment = arrToCsv(body.equipment);
  if (body.mealPrepLevel != null) data.mealPrepLevel = String(body.mealPrepLevel);
  if (body.onboardingComplete != null) data.onboardingComplete = Boolean(body.onboardingComplete);

  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return NextResponse.json({ preferences: toClient(prefs) });
}

function arrToCsv(v: unknown) {
  return Array.isArray(v) ? v.join(",") : String(v ?? "");
}

function toClient(prefs: { dietaryTags: string; dislikedIngredients: string; favoriteCuisines: string; equipment: string; [key: string]: unknown }) {
  return {
    ...prefs,
    dietaryTags: prefs.dietaryTags.split(",").filter(Boolean),
    dislikedIngredients: prefs.dislikedIngredients.split(",").filter(Boolean),
    favoriteCuisines: prefs.favoriteCuisines.split(",").filter(Boolean),
    equipment: prefs.equipment.split(",").filter(Boolean),
  };
}
