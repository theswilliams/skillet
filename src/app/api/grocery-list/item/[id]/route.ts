import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";

async function assertOwnership(id: string, userId: string) {
  const item = await prisma.groceryListItem.findUnique({ where: { id }, include: { groceryList: true } });
  return item && item.groceryList.userId === userId ? item : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const item = await assertOwnership(id, userId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as { checked?: boolean; quantity?: number; name?: string; unit?: string };
  const data: Record<string, unknown> = {};
  if (body.checked != null) data.checked = body.checked;
  if (body.quantity != null) data.quantity = body.quantity;
  if (body.name != null) data.name = body.name;
  if (body.unit != null) data.unit = body.unit;

  const updated = await prisma.groceryListItem.update({ where: { id }, data });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const item = await assertOwnership(id, userId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.groceryListItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
