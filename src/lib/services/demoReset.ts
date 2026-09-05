import { prisma } from "@/lib/db";

/**
 * Skillet is a single-demo-account showcase (see currentUser.ts) — every
 * visitor to the live link shares one account. That's fine for a portfolio
 * piece, but it means one visitor's poking around (deleting pantry items,
 * blowing through the grocery list, importing a weird recipe) is the next
 * visitor's first impression. This resets the demo account to a clean,
 * intentionally-curated state: sane preferences, a stocked pantry (with a
 * couple of items expiring soon, so the expiry-tracking UI has something to
 * show), and a spread of liked/cooked/saved interactions across cuisines so
 * Discover and the taste profile look alive immediately instead of cold-start
 * blank. Called on a schedule via /api/cron/reset-demo (see vercel.json).
 */

const DEMO_EMAIL = "demo@skillet.app";

const PANTRY_STAPLES: { slug: string; quantity: number; unit: string; expiresInDays?: number }[] = [
  { slug: "chicken-breast", quantity: 700, unit: "g", expiresInDays: 3 },
  { slug: "rice-white", quantity: 2000, unit: "g" },
  { slug: "eggs", quantity: 12, unit: "unit", expiresInDays: 14 },
  { slug: "soy-sauce", quantity: 300, unit: "ml" },
  { slug: "broccoli", quantity: 400, unit: "g", expiresInDays: 5 },
  { slug: "onion", quantity: 900, unit: "g" },
  { slug: "garlic", quantity: 100, unit: "g" },
  { slug: "olive-oil", quantity: 500, unit: "ml" },
];

/** cuisine -> how many of that cuisine's recipes to mark "liked" */
const TASTE_SEED_CUISINES: Record<string, number> = {
  Mexican: 3,
  Italian: 3,
  Thai: 2,
  Japanese: 2,
  Indian: 2,
};

export async function resetDemoUser() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo" },
  });

  // Wipe everything the demo account has accumulated, in FK-safe order.
  await prisma.groceryListItem.deleteMany({ where: { groceryList: { userId: user.id } } });
  await prisma.groceryList.deleteMany({ where: { userId: user.id } });
  await prisma.mealPlanItem.deleteMany({ where: { mealPlan: { userId: user.id } } });
  await prisma.mealPlan.deleteMany({ where: { userId: user.id } });
  await prisma.pantryItem.deleteMany({ where: { userId: user.id } });
  await prisma.savedRecipe.deleteMany({ where: { userId: user.id } });
  await prisma.recipeInteraction.deleteMany({ where: { userId: user.id } });
  // Recipes the demo account imported carry a source site's photo/text —
  // cascades away their RecipeIngredient/interaction/saved/planItem rows too.
  await prisma.recipe.deleteMany({ where: { importedByUserId: user.id } });

  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: {
      householdSize: 2,
      weeklyBudget: 90,
      currency: "CAD",
      region: "CA-ON",
      mealsPerDay: 1,
      maxCookTime: 45,
      dietaryTags: "",
      dislikedIngredients: "",
      favoriteCuisines: "Mexican,Italian,Thai,Japanese,Indian",
      equipment: "oven,stovetop",
      mealPrepLevel: "moderate",
      onboardingComplete: true,
    },
    create: {
      userId: user.id,
      favoriteCuisines: "Mexican,Italian,Thai,Japanese,Indian",
      equipment: "oven,stovetop",
      onboardingComplete: true,
    },
  });

  const ingredients = await prisma.ingredient.findMany({
    where: { slug: { in: PANTRY_STAPLES.map((s) => s.slug) } },
  });
  const byslug = new Map(ingredients.map((i) => [i.slug, i]));
  const now = Date.now();
  for (const staple of PANTRY_STAPLES) {
    const ingredient = byslug.get(staple.slug);
    if (!ingredient) continue;
    await prisma.pantryItem.create({
      data: {
        userId: user.id,
        ingredientId: ingredient.id,
        quantity: staple.quantity,
        unit: staple.unit,
        expiresAt: staple.expiresInDays ? new Date(now + staple.expiresInDays * 86_400_000) : null,
      },
    });
  }

  for (const [cuisine, count] of Object.entries(TASTE_SEED_CUISINES)) {
    const recipes = await prisma.recipe.findMany({
      where: { cuisine, importedByUserId: null },
      take: count,
      orderBy: { name: "asc" },
    });
    for (const recipe of recipes) {
      await prisma.recipeInteraction.create({
        data: { userId: user.id, recipeId: recipe.id, type: "liked" },
      });
    }
    if (recipes[0]) {
      await prisma.recipeInteraction.create({
        data: { userId: user.id, recipeId: recipes[0].id, type: "cooked" },
      });
      await prisma.savedRecipe.create({
        data: { userId: user.id, recipeId: recipes[0].id },
      });
    }
  }

  return { userId: user.id };
}
