import type { Prisma } from "@prisma/client";

/**
 * Recipe visibility filter: the seeded/original catalog (importedByUserId
 * null) is visible to everyone, but a recipe imported from an external URL
 * is scoped to the importer only. Recipe.description/instructions for an
 * import can carry a source site's own text, and this schema's Recipe table
 * is a single shared catalog — without this filter, one user's import would
 * be redistributed to every other user's Discover/Search/plan results,
 * which is a real step beyond the "personal recipe box" use case the import
 * feature is meant for.
 */
export function visibleRecipesWhere(userId: string): Prisma.RecipeWhereInput {
  return {
    OR: [{ importedByUserId: null }, { importedByUserId: userId }],
  };
}
