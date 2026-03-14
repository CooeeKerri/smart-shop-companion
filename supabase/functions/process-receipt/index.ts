import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { receipt_id, image_paths } = await req.json();
    if (!receipt_id || !image_paths || !Array.isArray(image_paths) || image_paths.length === 0) {
      return new Response(
        JSON.stringify({ error: "receipt_id and image_paths[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download all images and convert to base64
    const imageContents = await downloadImages(supabase, image_paths);
    if (imageContents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not download any images" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PASS 0: Server-side quality gate ──
    const qualityCheck = await runQualityCheck(imageContents, LOVABLE_API_KEY);
    if (!qualityCheck.ok) {
      // Update receipt status so user knows to re-scan
      await supabase
        .from("receipts")
        .update({ status: "rejected", raw_ocr_text: JSON.stringify({ rejection: qualityCheck.reason }) })
        .eq("id", receipt_id);

      return new Response(
        JSON.stringify({
          error: "image_quality",
          message: qualityCheck.reason,
          rejected: true,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PASS 1: Extract all data ──
    const extractionResult = await runExtraction(imageContents, LOVABLE_API_KEY);
    if (!extractionResult.ok) {
      return new Response(
        JSON.stringify({ error: extractionResult.error }),
        { status: extractionResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = extractionResult.data!;

    // ── PASS 2: Validation & confidence scoring ──
    const validated = validateReceipt(parsed);

    // Save to database
    await saveReceipt(supabase, receipt_id, validated);

    return new Response(
      JSON.stringify({
        success: true,
        receipt_id,
        store_name: validated.store_name,
        item_count: validated.items.length,
        food_items: validated.items.filter((i: any) => i.is_food).length,
        non_food_items: validated.items.filter((i: any) => !i.is_food).length,
        total: validated.total,
        subtotal: validated.subtotal,
        total_discounts: validated.total_discounts,
        overall_confidence: validated.overall_confidence,
        warnings: validated.warnings,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Image download helper ──
async function downloadImages(supabase: any, paths: string[]) {
  const results: { base64: string; mimeType: string }[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from("receipts").download(path);
    if (error || !data) {
      console.error(`Failed to download ${path}:`, error);
      continue;
    }
    const arrayBuffer = await data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    results.push({ base64: btoa(binary), mimeType: data.type || "image/jpeg" });
  }
  return results;
}

// ── PASS 1: AI Extraction ──
async function runExtraction(
  images: { base64: string; mimeType: string }[],
  apiKey: string
) {
  const messageContent: any[] = images.map((img) => ({
    type: "image_url",
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }));

  messageContent.push({
    type: "text",
    text: `You are an expert Australian grocery receipt OCR system. Extract EVERY LINE ITEM from the receipt image(s).

You are given ${images.length} image(s) that may be PARTS OF THE SAME RECEIPT (a long docket photographed in sections).

STORE DETECTION:
- Identify the store from the header. Common Australian stores: Coles, Woolworths, Aldi, IGA, Spudshed, Farmer Jacks, Costco, Harris Farm, FoodWorks, Drakes, NQR
- Use the FULL store name as printed (e.g. "Coles Supermarkets Australia Pty Ltd")

DATE & TIME:
- Extract the receipt date and time. Australian format: DD/MM/YYYY or DD MMM YYYY
- Convert date to ISO format YYYY-MM-DD
- Time in HH:MM format (24hr)

EXTRACTION RULES:
1. Go through the receipt LINE BY LINE from top to bottom. Every printed line with a price is an item.
2. DO NOT SKIP items even if text is partially obscured or abbreviated. Make your best guess.
3. Decode ALL abbreviations: "CLS MINCE BF 500G" → "Coles Beef Mince 500g", "WW" → "Woolworths"
4. Look for items in ALL sections: main list, "PRICE REDUCED", markdown, weighted items.
5. Weighted/per-kg items: extract the FINAL PRICE charged, not the per-kg rate.
6. Multi-buy items (e.g. "2 @ $3.50"): quantity=2, price=3.50 (unit price).
7. Lines with %, *, or special characters are still valid items.
8. DEDUPLICATION: If images overlap, include each unique item ONLY ONCE.
9. Count items and cross-check against any "TOTAL QTY" shown on receipt.

CONFIDENCE SCORING (0.0-1.0 per item):
- 1.0: Text clearly readable, price unambiguous
- 0.7-0.9: Minor abbreviation decoded, price clear
- 0.4-0.6: Text partially obscured, price or name uncertain
- 0.1-0.3: Heavily obscured, significant guessing

CLASSIFICATION:
- Food (is_food=true): ALL edible items — groceries, drinks, produce, meat, seafood, dairy, eggs, bakery, pantry, frozen, snacks, baby food, condiments, sauces, spices, coffee, tea
- Non-food (is_food=false): cleaning, laundry, toiletries, pet supplies, pet food, stationery, clothing, kitchenware, bags, gift cards, batteries, cosmetics

CATEGORIES: Fresh Produce, Meat & Seafood, Dairy, Bakery, Pantry, Frozen, Drinks, Snacks, Household, Health & Beauty, Pet, Baby, Deli, Other

Return ONLY valid JSON (no markdown fences):
{
  "store_name": "Full store name from receipt header",
  "receipt_date": "YYYY-MM-DD or null",
  "receipt_time": "HH:MM or null",
  "items": [
    {
      "raw_name": "Exact text from receipt line",
      "clean_name": "Human-readable product name (decode abbreviations)",
      "category": "One of the categories above",
      "price": 3.50,
      "quantity": 1,
      "is_discount": false,
      "is_food": true,
      "confidence": 0.9
    }
  ],
  "subtotal": 42.50,
  "total_discounts": -3.20,
  "total": 39.30
}

DISCOUNT LINES: Lines showing savings, member discounts, or multi-buy savings → is_discount=true, NEGATIVE price.
IMPORTANT: Double-check you haven't missed any items. Every line with a dollar amount must be captured.`,
  });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: messageContent }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI error:", response.status, errText);
    if (response.status === 429) return { ok: false, status: 429, error: "Rate limit exceeded. Please try again shortly." };
    if (response.status === 402) return { ok: false, status: 402, error: "AI credits exhausted." };
    return { ok: false, status: 500, error: "AI processing failed" };
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content ?? "";

  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return { ok: true, data: JSON.parse(cleaned) } as const;
  } catch {
    console.error("Failed to parse AI response:", content);
    return { ok: false, status: 500, error: "Failed to parse receipt data" } as const;
  }
}

// ── PASS 2: Validation & Correction ──
function validateReceipt(parsed: any) {
  const items = (parsed.items || []).map((item: any) => ({
    raw_name: item.raw_name || "",
    clean_name: item.clean_name || item.raw_name || "",
    category: item.category || "Other",
    price: typeof item.price === "number" ? item.price : parseFloat(item.price) || 0,
    quantity: item.quantity || 1,
    is_discount: item.is_discount || false,
    is_food: item.is_food !== undefined ? item.is_food : true,
    confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
  }));

  const warnings: string[] = [];

  // Validation 1: Check calculated total vs stated total
  const calcTotal = items.reduce(
    (sum: number, i: any) => sum + i.price * i.quantity,
    0
  );
  const statedTotal = parsed.total || null;

  if (statedTotal !== null) {
    const diff = Math.abs(calcTotal - statedTotal);
    if (diff > 1.0) {
      warnings.push(
        `Item total ($${calcTotal.toFixed(2)}) differs from receipt total ($${statedTotal.toFixed(2)}) by $${diff.toFixed(2)}. Some items may be missing or have incorrect prices.`
      );
    }
  }

  // Validation 2: Check for suspiciously high/low prices
  for (const item of items) {
    if (!item.is_discount && item.price > 100) {
      warnings.push(`${item.clean_name} has a high price ($${item.price.toFixed(2)}) — please verify.`);
      item.confidence = Math.min(item.confidence, 0.5);
    }
    if (!item.is_discount && item.price === 0 && !item.raw_name.toLowerCase().includes("free")) {
      warnings.push(`${item.clean_name} has a $0.00 price — may need correction.`);
      item.confidence = Math.min(item.confidence, 0.3);
    }
  }

  // Validation 3: Check for duplicate items (exact same name + price)
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.clean_name.toLowerCase()}|${item.price}`;
    if (seen.has(key) && !item.is_discount) {
      // Don't remove — could be legitimate (2 separate purchases of same item at different weights)
      // But flag it
      item.confidence = Math.min(item.confidence, 0.6);
    }
    seen.add(key);
  }

  // Validation 4: Ensure discounts are negative
  for (const item of items) {
    if (item.is_discount && item.price > 0) {
      item.price = -Math.abs(item.price);
    }
  }

  // Calculate overall confidence
  const confidences = items.map((i: any) => i.confidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
    : 0;

  // Adjust overall confidence based on total match
  let overallConfidence = avgConfidence;
  if (statedTotal !== null) {
    const totalDiffPct = Math.abs(calcTotal - statedTotal) / Math.max(statedTotal, 1);
    if (totalDiffPct < 0.01) overallConfidence = Math.min(overallConfidence + 0.1, 1.0);
    else if (totalDiffPct > 0.1) overallConfidence = Math.max(overallConfidence - 0.2, 0.1);
  }

  // Calculate subtotal and total discounts
  const nonDiscountTotal = items
    .filter((i: any) => !i.is_discount)
    .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const discountTotal = items
    .filter((i: any) => i.is_discount)
    .reduce((s: number, i: any) => s + i.price * i.quantity, 0);

  return {
    store_name: parsed.store_name || "Unknown",
    receipt_date: parsed.receipt_date || null,
    receipt_time: parsed.receipt_time || null,
    items,
    subtotal: parsed.subtotal || nonDiscountTotal,
    total_discounts: parsed.total_discounts || discountTotal,
    total: statedTotal || calcTotal,
    overall_confidence: Math.round(overallConfidence * 100) / 100,
    warnings,
  };
}

// ── Save to database ──
async function saveReceipt(supabase: any, receiptId: string, data: any) {
  // Update receipt metadata
  await supabase
    .from("receipts")
    .update({
      store_name: data.store_name,
      total_amount: data.total,
      subtotal: data.subtotal,
      total_discounts: data.total_discounts,
      overall_confidence: data.overall_confidence,
      receipt_time: data.receipt_time,
      raw_ocr_text: JSON.stringify({ warnings: data.warnings }),
      status: "reviewed",
      ...(data.receipt_date ? { shop_date: data.receipt_date } : {}),
    })
    .eq("id", receiptId);

  // Insert items
  const itemsToInsert = data.items.map((item: any) => ({
    receipt_id: receiptId,
    raw_name: item.raw_name,
    clean_name: item.clean_name,
    category: item.category,
    price: item.price,
    quantity: item.quantity,
    is_discount: item.is_discount,
    is_food: item.is_food,
    confidence: item.confidence,
  }));

  if (itemsToInsert.length > 0) {
    const { error } = await supabase.from("receipt_items").insert(itemsToInsert);
    if (error) console.error("Insert items error:", error);
  }
}
