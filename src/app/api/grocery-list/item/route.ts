import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";

// Add a custom item to a grocery list.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { groceryListId, name, quantity, unit, category } = (await req.json()) as {
    groceryListId: string;
    name: string;
    quantity?: number;
    unit?: string;
    category?: string;
  };

  const list = await prisma.groceryList.findFirst({ where: { id: groceryListId, userId } });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  const item = await prisma.groceryListItem.create({
    data: {
      groceryListId,
      name,
      quantity: quantity ?? 1,
      unit: unit ?? "unit",
      category: category ?? "other",
      custom: true,
      estimatedCost: 0,
    },
  });

  return NextResponse.json({ item });
}
