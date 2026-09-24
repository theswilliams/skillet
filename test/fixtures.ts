import type { RecipeWithIngredients } from "@/lib/services/planner";

type IngSpec = {
  id: string;
  qty: number;
  unit?: string;
  price?: number; // per base unit
  baseUnit?: "g" | "ml" | "unit";
  optional?: boolean;
  primary?: boolean;
  staple?: boolean;
  density?: number | null;
};

export function ingredient(spec: IngSpec) {
  return {
    ingredientId: spec.id,
    quantity: spec.qty,
    unit: spec.unit ?? "g",
    optional: spec.optional ?? false,
    isPrimary: spec.primary ?? false,
    ingredient: {
      id: spec.id,
      name: spec.id,
      slug: spec.id,
      category: "other",
      baseUnit: spec.baseUnit ?? "g",
      pricePerBaseUnit: spec.price ?? 0.01,
      densityGPerMl: spec.density ?? null,
      isStaple: spec.staple ?? false,
    },
  };
}

export function recipe(
  id: string,
  ings: IngSpec[],
  over: Partial<{
    cuisine: string;
    proteinType: string;
    dietaryTags: string;
    totalMinutes: number;
    servings: number;
    mealType: string;
    protein: number;
  }> = {},
): RecipeWithIngredients {
  return {
    id,
    name: id,
    slug: id,
    cuisine: over.cuisine ?? "italian",
    proteinType: over.proteinType ?? "chicken",
    dietaryTags: over.dietaryTags ?? "",
    totalMinutes: over.totalMinutes ?? 30,
    servings: over.servings ?? 2,
    mealType: over.mealType ?? "dinner",
    protein: over.protein ?? 20,
    ingredients: ings.map(ingredient),
  } as unknown as RecipeWithIngredients;
}
