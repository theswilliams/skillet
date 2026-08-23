import type { RecipeWithIngredients } from "@/lib/services/cost";
import { recipeCost } from "@/lib/services/cost";
import { formatQuantity } from "@/lib/units";

export function serializeRecipe(recipe: RecipeWithIngredients) {
  const { totalCost, costPerServing, optionalCost } = recipeCost(recipe);
  return {
    id: recipe.id,
    slug: recipe.slug,
    name: recipe.name,
    description: recipe.description,
    emoji: recipe.emoji,
    hue: recipe.hue,
    imageUrl: recipe.imageUrl,
    instructions: JSON.parse(recipe.instructions) as string[],
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    servings: recipe.servings,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    cuisine: recipe.cuisine,
    mealType: recipe.mealType,
    difficulty: recipe.difficulty,
    proteinType: recipe.proteinType,
    dietaryTags: recipe.dietaryTags.split(",").filter(Boolean),
    equipment: recipe.equipment.split(",").filter(Boolean),
    leftoverFriendly: recipe.leftoverFriendly,
    totalCost,
    costPerServing,
    optionalCost,
    ingredients: recipe.ingredients.map((ri) => ({
      id: ri.id,
      ingredientId: ri.ingredientId,
      name: ri.ingredient.name,
      slug: ri.ingredient.slug,
      category: ri.ingredient.category,
      quantity: ri.quantity,
      unit: ri.unit,
      display: formatQuantity(ri.quantity, ri.unit),
      preparation: ri.preparation,
      optional: ri.optional,
      isPrimary: ri.isPrimary,
      isStaple: ri.ingredient.isStaple,
    })),
  };
}

export type SerializedRecipe = ReturnType<typeof serializeRecipe>;
