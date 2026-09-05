import { Carrot, Beef, Milk, Package, Snowflake, Wheat, ShoppingBasket, type LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  produce: Carrot,
  meat: Beef,
  dairy: Milk,
  pantry: Package,
  frozen: Snowflake,
  bakery: Wheat,
  other: ShoppingBasket,
};
