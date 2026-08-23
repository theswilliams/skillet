import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/serialize";
import { getCurrentUserId } from "@/lib/currentUser";

export async function GET() {
  const userId = await getCurrentUserId();
  const saved = await prisma.savedRecipe.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } },
  });
  return NextResponse.json({ recipes: saved.map((s) => serializeRecipe(s.recipe)) });
}
