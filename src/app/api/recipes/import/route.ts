import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";
import { fetchAndParseRecipe, parseIngredientLine } from "@/lib/services/recipeImport";
import { serializeRecipe } from "@/lib/serialize";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "imported-recipe"
  );
}

/** Loose match against the existing ingredient catalog by name substring. */
async function findOrCreateIngredient(name: string) {
  const lower = name.toLowerCase().trim();
  if (!lower) return null;

  const existing = await prisma.ingredient.findFirst({
    where: { name: { contains: lower, mode: "insensitive" } },
  });
  if (existing) return existing;

  const reverseMatch = await prisma.ingredient.findMany({ take: 200 });
  const fuzzy = reverseMatch.find((ing) => lower.includes(ing.name.toLowerCase()));
  if (fuzzy) return fuzzy;

  const slug = `imported-${slugify(name)}`;
  return prisma.ingredient.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: name.slice(0, 80),
      category: "other",
      baseUnit: "unit",
      pricePerBaseUnit: 1, // unpriced import — flagged to the user as an estimate
    },
  });
}

export async function POST(req: NextRequest) {
  const { url } = (await req.json()) as { url?: string };
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  const userId = await getCurrentUserId();

  let parsed;
  try {
    parsed = await fetchAndParseRecipe(url);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  if (parsed.ingredientLines.length === 0) {
    return NextResponse.json({ error: "No ingredients found on that page." }, { status: 422 });
  }

  const baseSlug = slugify(parsed.name);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.recipe.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const recipe = await prisma.recipe.create({
    data: {
      slug,
      name: parsed.name,
      description: parsed.description || `Imported from ${new URL(parsed.sourceUrl).hostname}`,
      imageUrl: parsed.imageUrl,
      emoji: "🔗",
      hue: 30,
      instructions: JSON.stringify(parsed.instructions.length > 0 ? parsed.instructions : ["See original recipe for instructions."]),
      prepMinutes: parsed.prepMinutes || 10,
      cookMinutes: parsed.cookMinutes || 20,
      totalMinutes: (parsed.prepMinutes || 10) + (parsed.cookMinutes || 20),
      servings: parsed.servings,
      cuisine: "Imported",
      mealType: "dinner",
      difficulty: "medium",
      proteinType: "other",
      sourceUrl: parsed.sourceUrl,
      importedByUserId: userId,
    },
  });

  for (const line of parsed.ingredientLines) {
    const line_parsed = parseIngredientLine(line);
    const ingredient = await findOrCreateIngredient(line_parsed.name);
    if (!ingredient) continue;
    await prisma.recipeIngredient.upsert({
      where: { recipeId_ingredientId: { recipeId: recipe.id, ingredientId: ingredient.id } },
      update: {},
      create: {
        recipeId: recipe.id,
        ingredientId: ingredient.id,
        quantity: line_parsed.quantity,
        unit: line_parsed.unit,
        preparation: line_parsed.raw,
      },
    });
  }

  const full = await prisma.recipe.findUnique({
    where: { id: recipe.id },
    include: { ingredients: { include: { ingredient: true } } },
  });

  return NextResponse.json({ recipe: serializeRecipe(full!) });
}
