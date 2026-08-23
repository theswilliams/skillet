import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  await prisma.pantryItem.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const body = (await req.json()) as { expiresAt?: string | null };

  const item = await prisma.pantryItem.findFirst({ where: { id, userId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.pantryItem.update({
    where: { id },
    data: { expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined },
    include: { ingredient: true },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      ingredientId: updated.ingredientId,
      name: updated.ingredient.name,
      category: updated.ingredient.category,
      slug: updated.ingredient.slug,
      expiresAt: updated.expiresAt,
    },
  });
}
