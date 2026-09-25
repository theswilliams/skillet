import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/currentUser";
import { barcodeScanSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";

/**
 * Barcode -> pantry item. Looks the barcode up in Open Food Facts (free,
 * public, no API key: https://world.openfoodfacts.org) to get a real
 * product name, then creates or reuses an Ingredient keyed by that barcode
 * and adds it to the user's pantry.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`scan:${clientIp(req.headers)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many scans. Try again shortly." }, { status: 429 });
  }
  const parsedBody = barcodeScanSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: firstError(parsedBody) }, { status: 400 });
  const { barcode, expiresAt } = parsedBody.data;

  const userId = await getCurrentUserId();

  let ingredient = await prisma.ingredient.findUnique({ where: { barcode } });

  if (!ingredient) {
    let productName: string | null = null;
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
        headers: { "User-Agent": "SkilletApp/1.0 (personal-project meal planner)" },
        // Fixed host, digits-only path (validated above). Don't hang the function on a slow
        // third party, and never follow a redirect to somewhere else.
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 1 && data.product) {
          productName = data.product.product_name || data.product.product_name_en || data.product.generic_name || null;
        }
      }
    } catch {
      // Network hiccup or Open Food Facts down — fall through to the "not found" branch below.
    }

    if (!productName) {
      return NextResponse.json(
        { error: "not_found", message: "Couldn't identify that barcode. Add the item by name instead." },
        { status: 404 },
      );
    }

    const slug = `scan-${barcode}`;
    ingredient = await prisma.ingredient.upsert({
      where: { slug },
      update: { barcode },
      create: {
        slug,
        name: productName.slice(0, 120),
        category: "other",
        baseUnit: "unit",
        pricePerBaseUnit: 3, // placeholder until priced by a store feed or the user
        barcode,
      },
    });
  }

  const item = await prisma.pantryItem.upsert({
    where: { userId_ingredientId: { userId, ingredientId: ingredient.id } },
    update: { expiresAt: expiresAt ? new Date(expiresAt) : undefined },
    create: { userId, ingredientId: ingredient.id, expiresAt: expiresAt ? new Date(expiresAt) : undefined },
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
