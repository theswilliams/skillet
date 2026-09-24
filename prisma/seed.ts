import { PrismaClient } from "@prisma/client";
import { INGREDIENTS } from "./data/ingredients";
import { RECIPES as RECIPES_BASE } from "./data/recipes";
import { RECIPES_2 } from "./data/recipes2";
import { RECIPES_3 } from "./data/recipes3";
import { RECIPES_4 } from "./data/recipes4";
import { RECIPES_5 } from "./data/recipes5";
import { RECIPES_6 } from "./data/recipes6";
import { RECIPES_7 } from "./data/recipes7";
import { RECIPES_8 } from "./data/recipes8";
import { RECIPES_9 } from "./data/recipes9";
import { RECIPES_10 } from "./data/recipes10";
import { RECIPE_IMAGES } from "./data/images";
import { GROCERY_STORES, mockStorePrice } from "../src/lib/services/pricing";

const RECIPES = [
  ...RECIPES_BASE,
  ...RECIPES_2,
  ...RECIPES_3,
  ...RECIPES_4,
  ...RECIPES_5,
  ...RECIPES_6,
  ...RECIPES_7,
  ...RECIPES_8,
  ...RECIPES_9,
  ...RECIPES_10,
];

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${INGREDIENTS.length} ingredients...`);
  for (const ing of INGREDIENTS) {
    await prisma.ingredient.upsert({
      where: { slug: ing.slug },
      update: {
        name: ing.name,
        category: ing.category,
        baseUnit: ing.baseUnit,
        pricePerBaseUnit: ing.price,
        isStaple: ing.staple ?? false,
        substitutes: (ing.subs ?? []).join(","),
      },
      create: {
        slug: ing.slug,
        name: ing.name,
        category: ing.category,
        baseUnit: ing.baseUnit,
        pricePerBaseUnit: ing.price,
        isStaple: ing.staple ?? false,
        substitutes: (ing.subs ?? []).join(","),
      },
    });
  }

  const ingredientBySlug = new Map(
    (await prisma.ingredient.findMany()).map((i) => [i.slug, i]),
  );

  console.log(`Seeding mock store prices for ${GROCERY_STORES.length} stores...`);
  for (const ing of ingredientBySlug.values()) {
    for (const store of GROCERY_STORES) {
      const price = mockStorePrice(ing, store);
      const existing = await prisma.ingredientPrice.findFirst({
        where: { ingredientId: ing.id, source: "mock-store", store },
      });
      if (existing) {
        await prisma.ingredientPrice.update({ where: { id: existing.id }, data: { pricePerBaseUnit: price } });
      } else {
        await prisma.ingredientPrice.create({
          data: { ingredientId: ing.id, source: "mock-store", store, pricePerBaseUnit: price },
        });
      }
    }
  }

  console.log(`Seeding ${RECIPES.length} recipes...`);
  for (const r of RECIPES) {
    const totalMinutes = r.prepMinutes + r.cookMinutes;
    const recipe = await prisma.recipe.upsert({
      where: { slug: r.slug },
      update: {
        name: r.name,
        description: r.description,
        emoji: r.emoji,
        imageUrl: RECIPE_IMAGES[r.slug] ?? null,
        hue: r.hue,
        instructions: JSON.stringify(r.instructions),
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        totalMinutes,
        servings: r.servings,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        cuisine: r.cuisine,
        mealType: r.mealType,
        difficulty: r.difficulty,
        proteinType: r.proteinType,
        dietaryTags: r.dietaryTags.join(","),
        equipment: r.equipment.join(","),
        leftoverFriendly: r.leftoverFriendly ?? false,
      },
      create: {
        slug: r.slug,
        name: r.name,
        description: r.description,
        emoji: r.emoji,
        imageUrl: RECIPE_IMAGES[r.slug] ?? null,
        hue: r.hue,
        instructions: JSON.stringify(r.instructions),
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        totalMinutes,
        servings: r.servings,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        cuisine: r.cuisine,
        mealType: r.mealType,
        difficulty: r.difficulty,
        proteinType: r.proteinType,
        dietaryTags: r.dietaryTags.join(","),
        equipment: r.equipment.join(","),
        leftoverFriendly: r.leftoverFriendly ?? false,
      },
    });

    // Reset ingredient links so re-seeding is idempotent
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
    for (const ri of r.ingredients) {
      const ingredient = ingredientBySlug.get(ri.slug);
      if (!ingredient) {
        throw new Error(`Unknown ingredient slug "${ri.slug}" in recipe "${r.slug}"`);
      }
      await prisma.recipeIngredient.create({
        data: {
          recipeId: recipe.id,
          ingredientId: ingredient.id,
          quantity: ri.quantity,
          unit: ri.unit,
          preparation: ri.prep,
          optional: ri.optional ?? false,
          isPrimary: ri.primary ?? false,
        },
      });
    }
  }

  // Demo user with sensible defaults for a first-run experience
  const demoEmail = "demo@skillet.app";
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: "Demo",
      preferences: {
        create: {
          householdSize: 2,
          weeklyBudget: 75,
          currency: "CAD",
          region: "CA-ON",
          mealsPerDay: 1,
          maxCookTime: 45,
          favoriteCuisines: "Mexican,Italian,Chinese",
          dietaryTags: "",
          dislikedIngredients: "",
          equipment: "oven,one-pan",
          mealPrepLevel: "moderate",
          onboardingComplete: true,
        },
      },
    },
  });

  // Seed a starter pantry so "Use What I Have" has something to show
  const starterPantry = ["chicken-breast", "rice-white", "eggs", "soy-sauce", "broccoli", "onion", "garlic", "olive-oil"];
  for (const slug of starterPantry) {
    const ingredient = ingredientBySlug.get(slug);
    if (!ingredient) continue;
    await prisma.pantryItem.upsert({
      where: { userId_ingredientId: { userId: user.id, ingredientId: ingredient.id } },
      update: {},
      create: { userId: user.id, ingredientId: ingredient.id },
    });
  }

  console.log(`Seed complete. Demo user id: ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
