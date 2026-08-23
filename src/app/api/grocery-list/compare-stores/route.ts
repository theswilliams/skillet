import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";
import { compareStoresForList } from "@/lib/services/pricing";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  const listId = req.nextUrl.searchParams.get("listId");

  const list = listId
    ? await prisma.groceryList.findFirst({ where: { id: listId, userId }, include: { items: { include: { ingredient: true } } } })
    : await prisma.groceryList.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { items: { include: { ingredient: true } } } });

  if (!list) return NextResponse.json({ error: "No grocery list found" }, { status: 404 });

  const lines = list.items
    .filter((i) => i.ingredient && !i.checked)
    .map((i) => ({ ingredient: i.ingredient!, baseQuantity: i.quantity }));

  const comparison = compareStoresForList(lines);

  return NextResponse.json({
    comparison,
    cheapestStore: comparison[0]?.store ?? null,
    itemCount: lines.length,
  });
}
