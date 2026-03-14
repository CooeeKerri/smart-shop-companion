import { supabase } from "@/integrations/supabase/client";

export interface CleanedItem {
  id: string;
  clean_name: string;
  raw_name: string;
  category: string;
  ingredient_keyword: string | null;
  price: number;
  quantity: number;
  is_food: boolean;
  is_discount: boolean;
  confidence: number | null;
}

export interface CleanedReceipt {
  receipt_id: string;
  store_name: string;
  receipt_date: string | null;
  total_spent: number;
  subtotal: number;
  total_discounts: number;
  overall_confidence: number | null;
  confidence_status: "high" | "medium" | "low";
  items: CleanedItem[];
  categories: string[];
  ingredient_keywords: string[];
  food_items: CleanedItem[];
  non_food_items: CleanedItem[];
  discount_items: CleanedItem[];
}

export interface CleanedShopData {
  receipts: CleanedReceipt[];
  combined_total: number;
  combined_items: CleanedItem[];
  all_categories: string[];
  all_ingredient_keywords: string[];
  all_food_items: CleanedItem[];
  perishable_items: CleanedItem[];
  store_names: string[];
}

const PERISHABLE_CATEGORIES = new Set([
  "Fresh Produce",
  "Meat & Seafood",
  "Dairy",
  "Bakery",
  "Deli",
]);

function getConfidenceStatus(confidence: number | null): "high" | "medium" | "low" {
  if (confidence === null) return "low";
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

/**
 * Load cleaned, structured grocery data for confirmed receipts.
 * This is the single source of truth consumed by:
 * - Meal suggestion engine
 * - Shopping analysis / spending analytics
 * - Waste prediction (perishable tracking)
 * - Make-or-buy comparison
 * - Budget insights
 */
export async function loadCleanedShopData(
  receiptIds: string[]
): Promise<CleanedShopData | null> {
  if (!receiptIds.length) return null;

  const { data: receipts, error: rErr } = await supabase
    .from("receipts")
    .select("*")
    .in("id", receiptIds);

  if (rErr || !receipts?.length) return null;

  const { data: allItems, error: iErr } = await supabase
    .from("receipt_items")
    .select("*")
    .in("receipt_id", receiptIds)
    .order("created_at");

  if (iErr) return null;
  const items = allItems || [];

  const cleaned: CleanedReceipt[] = receipts.map((r) => {
    const rItems: CleanedItem[] = items
      .filter((i) => i.receipt_id === r.id)
      .map((i) => ({
        id: i.id,
        clean_name: i.clean_name || i.raw_name || "",
        raw_name: i.raw_name || "",
        category: i.category || "Other",
        ingredient_keyword: (i as any).ingredient_keyword || null,
        price: Number(i.price) || 0,
        quantity: i.quantity || 1,
        is_food: i.is_food ?? true,
        is_discount: i.is_discount ?? false,
        confidence: i.confidence !== null ? Number(i.confidence) : null,
      }));

    const foodItems = rItems.filter((i) => i.is_food && !i.is_discount);
    const nonFoodItems = rItems.filter((i) => !i.is_food && !i.is_discount);
    const discountItems = rItems.filter((i) => i.is_discount);

    const categories = [
      ...new Set(rItems.filter((i) => !i.is_discount).map((i) => i.category)),
    ];
    const keywords = [
      ...new Set(
        rItems
          .filter((i) => i.ingredient_keyword && !i.is_discount)
          .map((i) => i.ingredient_keyword!)
      ),
    ];

    const totalSpent =
      Number(r.total_amount) ||
      rItems.reduce((s, i) => s + i.price * i.quantity, 0);

    return {
      receipt_id: r.id,
      store_name: r.store_name || "Unknown Store",
      receipt_date: r.shop_date,
      total_spent: totalSpent,
      subtotal: Number(r.subtotal) || totalSpent,
      total_discounts: Number(r.total_discounts) || 0,
      overall_confidence: r.overall_confidence
        ? Number(r.overall_confidence)
        : null,
      confidence_status: getConfidenceStatus(
        r.overall_confidence ? Number(r.overall_confidence) : null
      ),
      items: rItems,
      categories,
      ingredient_keywords: keywords,
      food_items: foodItems,
      non_food_items: nonFoodItems,
      discount_items: discountItems,
    };
  });

  const combinedItems = cleaned.flatMap((r) => r.items);
  const allFood = cleaned.flatMap((r) => r.food_items);

  return {
    receipts: cleaned,
    combined_total: cleaned.reduce((s, r) => s + r.total_spent, 0),
    combined_items: combinedItems,
    all_categories: [...new Set(cleaned.flatMap((r) => r.categories))],
    all_ingredient_keywords: [
      ...new Set(cleaned.flatMap((r) => r.ingredient_keywords)),
    ],
    all_food_items: allFood,
    perishable_items: allFood.filter((i) =>
      PERISHABLE_CATEGORIES.has(i.category)
    ),
    store_names: [...new Set(cleaned.map((r) => r.store_name))],
  };
}

/**
 * Load the latest confirmed receipt for a user (for dashboard widgets).
 */
export async function loadLatestCleanedShop(
  userId: string
): Promise<CleanedShopData | null> {
  const { data } = await supabase
    .from("receipts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .order("shop_date", { ascending: false })
    .limit(1);

  if (!data?.length) return null;
  return loadCleanedShopData(data.map((r) => r.id));
}

/**
 * Load all confirmed receipts in a date range (for spending analytics).
 */
export async function loadCleanedShopRange(
  userId: string,
  from: string,
  to: string
): Promise<CleanedShopData | null> {
  const { data } = await supabase
    .from("receipts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("shop_date", from)
    .lte("shop_date", to)
    .order("shop_date", { ascending: false });

  if (!data?.length) return null;
  return loadCleanedShopData(data.map((r) => r.id));
}
