import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const ingredients = await prisma.ingredient.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { name: "asc" },
    take: 25,
  });
  return NextResponse.json({
    ingredients: ingredients.map((i) => ({ id: i.id, slug: i.slug, name: i.name, category: i.category })),
  });
}
