import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";

const VALID_TYPES = new Set(["liked", "disliked", "saved", "unsaved", "cooked", "skipped", "planned", "viewed"]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { recipeId, type } = body as { recipeId: string; type: string };

  if (!recipeId || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid recipeId or type" }, { status: 400 });
  }

  const userId = await getCurrentUserId();

  await prisma.recipeInteraction.create({ data: { userId, recipeId, type } });

  if (type === "saved") {
    await prisma.savedRecipe.upsert({
      where: { userId_recipeId: { userId, recipeId } },
      update: {},
      create: { userId, recipeId },
    });
  } else if (type === "unsaved") {
    await prisma.savedRecipe.deleteMany({ where: { userId, recipeId } });
  }

  return NextResponse.json({ ok: true });
}
