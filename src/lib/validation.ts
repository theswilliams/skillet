import { z } from "zod";

export const importRecipeSchema = z.object({
  url: z.string().trim().min(1, "Missing url").max(2048),
});

export const addPantryItemSchema = z
  .object({
    ingredientId: z.string().min(1).max(100).optional(),
    ingredientSlug: z.string().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    expiresAt: z.string().max(40).optional(),
  })
  .refine((v) => v.ingredientId || v.ingredientSlug || v.name, {
    message: "Provide an ingredient id, slug or name.",
  })
  .refine((v) => !v.expiresAt || !Number.isNaN(new Date(v.expiresAt).getTime()), {
    message: "Invalid expiry date.",
    path: ["expiresAt"],
  });

export const generatePlanSchema = z
  .object({
    days: z.number().int().min(1).max(14).optional(),
    budget: z.number().min(0).max(10000).optional(),
    householdSize: z.number().int().min(1).max(20).optional(),
    maxCookTime: z.number().int().min(5).max(600).optional(),
  })
  .passthrough();

/** Returns a first-issue error message, or null when valid. */
export function firstError(result: { success: boolean; error?: z.ZodError }): string | null {
  return result.success ? null : (result.error?.issues[0]?.message ?? "Invalid input");
}
