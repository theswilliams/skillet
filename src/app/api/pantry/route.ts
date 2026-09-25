import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";
import { countMakeableRecipes, countMajorityMatchRecipes } from "@/lib/services/pantry";
import { visibleRecipesWhere } from "@/lib/services/visibility";
import { addPantryItemSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";

export async function GET() {
  const userId = await getCurrentUserId();
  const [items, recipes] = await Promise.all([
    prisma.pantryItem.findMany({ where: { userId }, include: { ingredient: true }, orderBy: { addedAt: "desc" } }),
    prisma.recipe.findMany({ where: visibleRecipesWhere(userId), include: { ingredients: { include: { ingredient: true } } } }),
  ]);

  const pantryIds = new Set(items.map((i) => i.ingredientId));
  const makeableCount = countMakeableRecipes(recipes, pantryIds);
  const majorityMatchCount = countMajorityMatchRecipes(recipes, pantryIds);

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      ingredientId: i.ingredientId,
      name: i.ingredient.name,
      category: i.ingredient.category,
      slug: i.ingredient.slug,
      expiresAt: i.expiresAt,
    })),
    makeableCount,
    majorityMatchCount,
  });
}

export async function POST(req: NextRequest) {
  // The shared demo API is unauthenticated: bound how fast free-text names can add rows to the ingredient catalog.
  if (!rateLimit(`pantry:${clientIp(req.headers)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  const parsedBody = addPantryItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: firstError(parsedBody) }, { status: 400 });
  const { ingredientId, ingredientSlug, name, expiresAt } = parsedBody.data;
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

  const parsedExpiresAt = expiresAt ? new Date(expiresAt) : undefined;

  const item = await prisma.pantryItem.upsert({
    where: { userId_ingredientId: { userId, ingredientId: ingredient.id } },
    update: parsedExpiresAt ? { expiresAt: parsedExpiresAt } : {},
    create: { userId, ingredientId: ingredient.id, expiresAt: parsedExpiresAt },
    include: { ingredient: true },
  });

  return NextResponse.json({
    item: {
      id: item.id,
      ingredientId: item.ingredientId,
      name: item.ingredient.name,
      category: item.ingredient.category,
      slug: item.ingredient.slug,
      expiresAt: item.expiresAt,
    },
  });
}
