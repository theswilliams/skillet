// Client-safe shapes mirroring the API's JSON responses (see lib/serialize.ts).

export type RecipeIngredientDTO = {
  id: string;
  ingredientId: string;
  name: string;
  slug: string;
  category: string;
  quantity: number;
  unit: string;
  display: string;
  preparation?: string | null;
  optional: boolean;
  isPrimary: boolean;
  isStaple: boolean;
};

export type RecipeDTO = {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  hue: number;
  imageUrl: string | null;
  instructions: string[];
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  servings: number;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  cuisine: string;
  mealType: string;
  difficulty: string;
  proteinType: string;
  dietaryTags: string[];
  equipment: string[];
  leftoverFriendly: boolean;
  totalCost: number;
  costPerServing: number;
  optionalCost: number;
  ingredients: RecipeIngredientDTO[];
};

export type PantryMatchDTO = {
  haveCount: number;
  neededCount: number;
  missing: { name: string; slug: string }[];
  matchPct: number;
  canMake: boolean;
  primaryHaveCount: number;
  primaryNeededCount: number;
  primaryMatchPct: number;
  majorityMatch: boolean;
};

export type PreferencesDTO = {
  id: string;
  userId: string;
  householdSize: number;
  weeklyBudget: number;
  currency: string;
  region: string;
  mealsPerDay: number;
  maxCookTime: number;
  dietaryTags: string[];
  dislikedIngredients: string[];
  favoriteCuisines: string[];
  equipment: string[];
  mealPrepLevel: string;
  onboardingComplete: boolean;
};

export type MealPlanItemDTO = {
  id: string;
  dayIndex: number;
  slot: string;
  servings: number;
  cooked: boolean;
  recipe: RecipeDTO;
};

export type MealPlanDTO = {
  id: string;
  title: string;
  weekStart: string;
  budget: number;
  householdSize: number;
  items: MealPlanItemDTO[];
  efficiency: {
    efficiencyPct: number;
    uniqueIngredientCount: number;
    sharedIngredientCount: number;
    singleUseIngredientCount: number;
    sharedIngredients: { name: string; recipeCount: number; recipeNames: string[] }[];
    singleUseIngredients: { name: string; recipeName: string }[];
  };
  estimatedCost: number;
};

export type GroceryItemDTO = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  checked: boolean;
  custom: boolean;
  usedInRecipes: string;
  havePantry: boolean;
};

export type GroceryListDTO = {
  id: string;
  mealPlanId: string | null;
  createdAt: string;
  items: GroceryItemDTO[];
  grouped: Record<string, GroceryItemDTO[]>;
  totalCost: number;
  checkedCount: number;
};

export type PantryItemDTO = {
  id: string;
  ingredientId: string;
  name: string;
  category: string;
  slug: string;
};

export const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  meat: "Meat & Seafood",
  dairy: "Dairy",
  pantry: "Pantry",
  frozen: "Frozen",
  bakery: "Bakery",
  other: "Other",
};

export const CATEGORY_ICONS: Record<string, string> = {
  produce: "🥬",
  meat: "🥩",
  dairy: "🧀",
  pantry: "🫙",
  frozen: "🧊",
  bakery: "🍞",
  other: "🧺",
};
