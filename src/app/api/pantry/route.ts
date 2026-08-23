import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";
import { countMakeableRecipes } from "@/lib/services/pantry";

export async function GET() {
  const userId = await getCurrentUserId();
  const [items, recipes] = await Promise.all([
    prisma.pantryItem.findMany({ where: { userId }, include: { ingredient: true }, orderBy: { addedAt: "desc" } }),
    prisma.recipe.findMany({ include: { ingredients: { include: { ingredient: true } } } }),
  ]);

  const pantryIds = new Set(items.map((i) => i.ingredientId));
  const makeableCount = countMakeableRecipes(recipes, pantryIds);

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      ingredientId: i.ingredientId,
      name: i.ingredient.name,
      category: i.ingredient.category,
      slug: i.ingredient.slug,
    })),
    makeableCount,
  });
}

export async function POST(req: NextRequest) {
  const { ingredientId, ingredientSlug, name } = (await req.json()) as {
    ingredientId?: string;
    ingredientSlug?: string;
    name?: string;
  };
  const userId = await getCurrentUserId();

  let ingredient = null;
  if (ingredientId) {
    ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
  } else if (ingredientSlug) {
    ingredient = await prisma.ingredient.findUnique({ where: { slug: ingredientSlug } });
  } else if (name) {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    ingredient = await prisma.ingredient.upsert({
      where: { slug },
      update: {},
      create: { slug, name: name.trim(), category: "other", baseUnit: "unit", pricePerBaseUnit: 1 },
    });
  }

  if (!ingredient) return NextResponse.json({ error: "Ingredient not found" }, { status: 400 });

  const item = await prisma.pantryItem.upsert({
    where: { userId_ingredientId: { userId, ingredientId: ingredient.id } },
    update: {},
    create: { userId, ingredientId: ingredient.id },
    include: { ingredient: true },
  });

  return NextResponse.json({
    item: { id: item.id, ingredientId: item.ingredientId, name: item.ingredient.name, category: item.ingredient.category, slug: item.ingredient.slug },
  });
}
