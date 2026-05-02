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

    // Quality gate removed — we trust Gemini to read most photos and only
    // surface a problem if extraction itself fails or returns nothing usable.

    // ── PASS 1: Extract directly from the optimised docket photo(s) ──
    const extractionResult = await runExtraction(imageContents, LOVABLE_API_KEY);
    let validated: any = null;

    if (extractionResult.ok) {
      const parsed = extractionResult.data!;
      validated = validateReceipt(parsed, detectStore(parsed));
      validated.extraction_method = "vision_direct";
    } else if (extractionResult.status === 429 || extractionResult.status === 402) {
      return new Response(
        JSON.stringify({ error: extractionResult.error }),
        { status: extractionResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PASS 2: If the direct read looks weak, transcribe text first then parse that text ──
    if (!validated || shouldRunFallback(validated)) {
      const fallback = await runOcrTextFallback(imageContents, LOVABLE_API_KEY);
      if (fallback.ok) {
        const fallbackValidated = validateReceipt(fallback.data!, detectStore(fallback.data!));
        fallbackValidated.extraction_method = "ocr_text_fallback";
        validated = chooseBestExtraction(validated, fallbackValidated);
      } else if (!validated) {
        return new Response(
          JSON.stringify({ error: fallback.error || extractionResult.error || "Could not read the docket" }),
          { status: fallback.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Save to database
    await saveReceipt(supabase, receipt_id, validated);

    return new Response(
      JSON.stringify({
        success: true,
        receipt_id,
        store_name: validated.store_name,
        store_confidence: validated.store_confidence,
        store_review_required: validated.store_review_required,
        detected_abn: validated.detected_abn,
        item_count: validated.items.length,
        food_items: validated.items.filter((i: any) => i.is_food).length,
        non_food_items: validated.items.filter((i: any) => !i.is_food).length,
        total: validated.total,
        subtotal: validated.subtotal,
        total_discounts: validated.total_discounts,
        overall_confidence: validated.overall_confidence,
        date_confidence: validated.date_confidence,
        total_confidence: validated.total_confidence,
        item_extraction_confidence: validated.item_extraction_confidence,
        needs_review: validated.needs_review,
        extraction_method: validated.extraction_method,
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

// ── PASS 0: Server-side quality check ──
async function runQualityCheck(
  images: { base64: string; mimeType: string }[],
  apiKey: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const messageContent: any[] = images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    }));

    messageContent.push({
      type: "text",
      text: `You are an image quality assessor for grocery receipt photos. Evaluate whether these ${images.length} image(s) are usable for OCR text extraction.

CHECK THESE QUALITY FACTORS:
1. Is a grocery receipt clearly visible in the image(s)?
2. Is the receipt text readable (not too blurry)?
3. Is the receipt reasonably complete (not severely cropped)?
4. Is the lighting adequate (not too dark or washed out)?
5. Is the receipt not severely folded, crumpled, or obscured?

Return ONLY valid JSON (no markdown fences):
{
  "usable": true/false,
  "reason": "If not usable, explain why in a friendly user message. If usable, null."
}

Be lenient — slight blur, minor shadows, or partial overlap between photos is fine (we merge multi-photo receipts). Only reject truly unusable images.`,
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: messageContent }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      // If quality check fails due to rate limit etc, skip it and proceed
      console.error("Quality check API error:", response.status);
      return { ok: true };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.usable === false) {
      return {
        ok: false,
        reason: parsed.reason || "Please retake the receipt photo with the full receipt visible in good lighting.",
      };
    }

    return { ok: true };
  } catch (err) {
    // On any error, don't block — proceed to extraction
    console.error("Quality check error:", err);
    return { ok: true };
  }
}

// ── Store-specific parsing templates ──
function getStoreTemplate(): string {
  return `

═══════════════════════════════════════════
STORE-SPECIFIC PARSING TEMPLATES
═══════════════════════════════════════════
After detecting the store from the header, apply the matching template below.

──── COLES ────
Header: "Coles Supermarkets Australia Pty Ltd", ABN 45 004 089 936
Item format: Items prefixed with "CLS " (e.g. "CLS MINCE BF 500G"). Strip "CLS " from clean_name.
Abbreviations: CLS=Coles brand, BF=Beef, CHK=Chicken, F/R=Free Range, S/L=Skinless, ORG=Organic
Discounts: "MEMBER OFFER", "FLYBUYS OFFER", "PRICES DROPPED" lines appear AFTER the item, negative price.
Weighted items: Show "X.XXkg @ $Y.YY/kg" on one line, final price on the next. Use final price only.
Loyalty: "flybuys" section at bottom — IGNORE entirely. "TOTAL SAVINGS" line — IGNORE.
Totals: "SUBTOTAL", "TOTAL", "ROUND" labels. "ROUND" is a rounding adjustment — IGNORE.
Date format: DD/MM/YYYY HH:MM on the same line, near the top.

──── WOOLWORTHS ────
Header: "Woolworths", sometimes "Woolworths Group" or "Woolworths Metro"
Item format: Items may be prefixed with "WW " (e.g. "WW MILK F/CREAM 2L"). Strip "WW " from clean_name.
Abbreviations: WW=Woolworths brand, F/CREAM=Full Cream, SM=Skim, L/F=Low Fat, F/F=Full Fat
Discounts: "MEMBER PRICE", "SPECIAL", "EVERYDAY REWARDS SAVING" lines appear AFTER the item, negative price.
Weighted items: "NET X.XXkg @ $Y.YY/kg" then final price. Use final price.
Multi-buy: "X @ $Y.YY" means quantity=X, unit_price=Y.YY.
Loyalty: "Everyday Rewards" section — IGNORE. "TOTAL SAVINGS THIS SHOP" — IGNORE.
Totals: "SUBTOTAL", "TOTAL". Sometimes "AMOUNT DUE".
Date format: DD/MM/YYYY and time HH:MM:SS on separate lines or same line.

──── ALDI ────
Header: "ALDI" or "ALDI Stores", ABN 90 070 541 833
Item format: Items are plain text, no store prefix. Names tend to be UPPERCASE and heavily abbreviated.
Abbreviations: More aggressive shortening — "CHOC" = Chocolate, "ORG" = Organic, "WHL" = Whole, "GRN" = Green
Discounts: Aldi rarely shows per-item discounts. Look for "SPECIAL BUY" items at regular price.
Weighted items: "X.XXkg NET @ $Y.YY/kg" with final price on the next line.
Loyalty: No loyalty program — no lines to ignore for this.
Totals: "TOTAL", "SUBTOTAL", "GST INCLUDED". "ROUNDING" — IGNORE.
Date format: DD.MM.YYYY or DD/MM/YYYY, time HH:MM.

──── IGA ────
Header: Varies by franchise — "IGA", "IGA Supermarket", "Supa IGA", "IGA Xpress", or the franchise owner name.
Item format: No consistent prefix. Names are UPPERCASE, moderate abbreviation.
Abbreviations: Standard Australian grocery abbreviations apply.
Discounts: "SPECIAL", "MEMBER SPECIAL", "IGA REWARDS" lines after items.
Weighted items: Similar to Coles/Woolworths format.
Loyalty: "IGA Rewards" — IGNORE summary lines.
Totals: "SUBTOTAL", "TOTAL", "GST". Some franchises show "AMOUNT" instead of "TOTAL".
Date format: DD/MM/YYYY HH:MM, position varies by franchise.

──── SPUDSHED ────
Header: "Spudshed" or "Spud Shed", ABN 16 138 344 668
Item format: Plain text, UPPERCASE. Heavy on fresh produce with weight-based pricing.
Discounts: Minimal discount lines. "PRICE DROP" occasionally.
Totals: "TOTAL", "SUBTOTAL".
Date format: DD/MM/YYYY.

──── FARMER JACKS ────
Header: "Farmer Jacks" or "Farmer Jack's"
Item format: Plain text, UPPERCASE. Similar to IGA formatting.
Discounts: "SPECIAL" lines after items.
Totals: "SUBTOTAL", "TOTAL".
Date format: DD/MM/YYYY.

──── UNKNOWN / GENERIC ────
If you cannot match any of the above stores, use generic parsing:
- Extract all lines with prices as items
- Use standard abbreviation decoding
- Mark confidence lower (0.5-0.7 range for most items)
- Still ignore totals, payment lines, loyalty text
`;
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

  const storeTemplates = getStoreTemplate();

  messageContent.push({
    type: "text",
    text: `You are an expert Australian grocery receipt OCR system. Extract ONLY real purchasable product items from the receipt image(s).

You are given ${images.length} image(s) that may be PARTS OF THE SAME RECEIPT (a long docket photographed in sections).

═══════════════════════════════════════════
CRITICAL: WHAT TO EXTRACT vs WHAT TO IGNORE
═══════════════════════════════════════════

EXTRACT — real purchased products only:
- Grocery items (food, drinks, household products)
- Weighted/per-kg items (use the FINAL PRICE charged, not the per-kg rate)
- Multi-buy items (e.g. "2 @ $3.50"): quantity=2, price=3.50 (unit price)
- Price-reduced / markdown items (is_discount=false, use the reduced price)
- Separate discount lines that follow an item (is_discount=true, NEGATIVE price)

IGNORE — do NOT include any of these as items:
- SUBTOTAL, TOTAL, ROUND, BALANCE DUE
- GST, TAX, TAX INVOICE lines
- EFTPOS, VISA, MASTERCARD, AMEX, CASH, CARD payment lines
- CHANGE, TENDER, AMOUNT TENDERED
- Flybuys, Everyday Rewards, Team Member Discount headers
- "TOTAL SAVINGS", "YOU SAVED", "MEMBER PRICE SAVING" summary lines
- Receipt number, date/time lines, register/operator info
- ABN lines, store address, phone number
- "THANK YOU", "HAVE A GREAT DAY", promotional messages
- Bag levy lines (unless it's a purchased reusable bag product)
- Barcode lines, QR code references
- "PRICE REDUCED" section headers (but DO extract the items within)
- Any line that is not a real product the customer took home

═══════════════════════════════════════════
HANDLING TRICKY RECEIPT FORMATTING
═══════════════════════════════════════════

1. WRAPPED TEXT: Some items span 2 lines — the product name is on one line and the price on the next. Merge them into a single item.
2. SEPARATED PRICES: If the item name and price are far apart on the same line, still capture both.
3. DISCOUNT LINES AFTER ITEMS: Lines like "MEMBER OFFER -$1.00" or "SPECIAL -0.50" that appear directly after an item are discount lines. Set is_discount=true with a NEGATIVE price. Associate them as separate line items (not merged into the product).
4. ABBREVIATIONS — decode ALL grocery abbreviations into clean names:
   - "CLS" / "COLES" prefix → Coles brand
   - "WW" prefix → Woolworths brand  
   - "CHK BRST FILT" → "Chicken Breast Fillet"
   - "TOM SCE PSTA" → "Tomato Pasta Sauce"
   - "BRCCLI" → "Broccoli"
   - "MLK F/F 2L" → "Full Fat Milk 2L"
   - "BNNA" → "Banana"
   - "MINCE BF 500G" → "Beef Mince 500g"
   - "F/R" → "Free Range", "O/S" → "On Special", "F/F" → "Full Fat", "S/L" → "Skinless"
   - "CHK" → "Chicken", "VEG" → "Vegetables", "BF" → "Beef", "LMB" → "Lamb", "PRK" → "Pork"
   - "ORG" → "Organic", "GF" → "Gluten Free"
   - Strip store prefixes (CLS, WW) from the clean_name — they're not part of the product name
5. QUANTITY INDICATORS: "2 @", "x2", "QTY 2" all mean quantity=2.
6. DUPLICATE CHECK: If images overlap, include each unique item ONLY ONCE.

═══════════════════════════════════════════
STORE DETECTION
═══════════════════════════════════════════
- Identify the store from the header. Common Australian stores: Coles, Woolworths, Aldi, IGA, Spudshed, Farmer Jacks, Costco, Harris Farm, FoodWorks, Drakes, NQR
- Use the FULL store name as printed (e.g. "Coles Supermarkets Australia Pty Ltd")

DATE & TIME:
- Extract the receipt date and time. Australian format: DD/MM/YYYY or DD MMM YYYY
- Convert date to ISO format YYYY-MM-DD
- Time in HH:MM format (24hr)

═══════════════════════════════════════════
CONFIDENCE SCORING (0.0-1.0 per item)
═══════════════════════════════════════════
- 1.0: Text clearly readable, price unambiguous
- 0.7-0.9: Minor abbreviation decoded, price clear
- 0.4-0.6: Text partially obscured, price or name uncertain
- 0.1-0.3: Heavily obscured, significant guessing

═══════════════════════════════════════════
CLASSIFICATION
═══════════════════════════════════════════
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
      "raw_name": "CHK BRST FILT 500G",
      "clean_name": "Chicken Breast Fillet 500g",
      "ingredient_keyword": "chicken breast",
      "category": "Meat & Seafood",
      "price": 7.50,
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

INGREDIENT_KEYWORD RULES:
- Extract the core grocery ingredient, lowercase, no brand, no size, no packaging.
- Examples: "Coles Chicken Breast Fillet 500g" → "chicken breast", "WW Full Cream Milk 2L" → "milk", "Broccoli" → "broccoli", "Tomato Pasta Sauce 500g" → "pasta sauce", "Dishwashing Liquid" → null (non-food)
- For non-food items, set ingredient_keyword to null.
- For discount lines, set ingredient_keyword to null.

DISCOUNT LINES: Lines showing savings, member discounts, or multi-buy savings → is_discount=true, NEGATIVE price. These are separate items in the array, NOT merged into the product they apply to.

${storeTemplates}

INSTRUCTIONS: First identify the store from the receipt header, then apply the matching store template above for parsing rules. If the store doesn't match any template, use the UNKNOWN/GENERIC rules and set item confidence to 0.5-0.7.

FINAL CHECK: Review your output. Every item must be a real product. No totals, no payment lines, no loyalty info.`,
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

async function runOcrTextFallback(
  images: { base64: string; mimeType: string }[],
  apiKey: string
) {
  const textResult = await transcribeDocketText(images, apiKey);
  if (!textResult.ok) return textResult;
  const transcribedText = textResult.text.trim();

  if (transcribedText.replace(/\s+/g, " ").length < 40) {
    return { ok: false, status: 422, error: "The docket text could not be read clearly enough." } as const;
  }

  return parseTranscribedDocketText(transcribedText, apiKey);
}

async function transcribeDocketText(
  images: { base64: string; mimeType: string }[],
  apiKey: string
) {
  const messageContent: any[] = images.map((img) => ({
    type: "image_url",
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }));

  messageContent.push({
    type: "text",
    text: `Read this Australian grocery docket as accurately as possible.

Return plain text only. Preserve the original line order, product abbreviations, prices, totals, date/time, ABN, and store header. If the docket is split across multiple photos, combine the sections in top-to-bottom order and avoid duplicating overlapping lines.`,
  });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: messageContent }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OCR fallback transcription error:", response.status, errText);
    if (response.status === 429) return { ok: false, status: 429, error: "Rate limit exceeded. Please try again shortly." } as const;
    if (response.status === 402) return { ok: false, status: 402, error: "AI credits exhausted." } as const;
    return { ok: false, status: 500, error: "Fallback docket reading failed" } as const;
  }

  const result = await response.json();
  return { ok: true, text: result.choices?.[0]?.message?.content ?? "" } as const;
}

async function parseTranscribedDocketText(text: string, apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{
        role: "user",
        content: `Parse this OCR text from an Australian grocery docket into the exact JSON shape below. Use the same rules as a receipt scanner: extract only purchased products, ignore payment/GST/loyalty/total lines as items, decode Aussie grocery abbreviations, keep discounts as separate negative line items, and use AUD prices.

Return ONLY valid JSON, no markdown fences:
{
  "store_name": "Full store name from docket header",
  "receipt_date": "YYYY-MM-DD or null",
  "receipt_time": "HH:MM or null",
  "items": [{
    "raw_name": "original line name",
    "clean_name": "human readable name",
    "ingredient_keyword": "core food keyword or null",
    "category": "Fresh Produce | Meat & Seafood | Dairy | Bakery | Pantry | Frozen | Drinks | Snacks | Household | Health & Beauty | Pet | Baby | Deli | Other",
    "price": 1.23,
    "quantity": 1,
    "is_discount": false,
    "is_food": true,
    "confidence": 0.8
  }],
  "subtotal": 0,
  "total_discounts": 0,
  "total": 0
}

OCR TEXT:
${text}`,
      }],
      temperature: 0.05,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OCR fallback parse error:", response.status, errText);
    if (response.status === 429) return { ok: false, status: 429, error: "Rate limit exceeded. Please try again shortly." } as const;
    if (response.status === 402) return { ok: false, status: 402, error: "AI credits exhausted." } as const;
    return { ok: false, status: 500, error: "Fallback docket parsing failed" } as const;
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content ?? "";
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return { ok: true, data: JSON.parse(cleaned) } as const;
  } catch {
    console.error("Failed to parse fallback response:", content);
    return { ok: false, status: 500, error: "Fallback returned unreadable docket data" } as const;
  }
}

// ── Australian Store Database ──
const KNOWN_STORES = [
  {
    canonical: "Coles",
    patterns: ["coles", "coles supermarket", "coles express", "coles group", "coles online"],
    abbreviations: ["cls", "col"],
    abns: ["11004089936", "45004089936"],
    itemPrefixes: ["CLS ", "COLES "],
  },
  {
    canonical: "Woolworths",
    patterns: ["woolworths", "woolworths group", "woolworths metro", "woolworths online", "woolies"],
    abbreviations: ["ww", "wws", "wow"],
    abns: ["88000014675", "63063297862"],
    itemPrefixes: ["WW ", "WOOLWORTHS "],
  },
  {
    canonical: "Aldi",
    patterns: ["aldi", "aldi stores", "aldi australia"],
    abbreviations: [],
    abns: ["90070541833"],
    itemPrefixes: [],
  },
  {
    canonical: "IGA",
    patterns: ["iga", "iga supermarket", "iga xpress", "iga express", "supa iga"],
    abbreviations: [],
    abns: [], // varies by franchise
    itemPrefixes: ["IGA "],
  },
  {
    canonical: "Spudshed",
    patterns: ["spudshed", "spud shed"],
    abbreviations: [],
    abns: ["16138344668"],
    itemPrefixes: [],
  },
  {
    canonical: "Farmer Jacks",
    patterns: ["farmer jack", "farmer jacks", "farmer jack's"],
    abbreviations: ["fj"],
    abns: [],
    itemPrefixes: [],
  },
  {
    canonical: "Costco",
    patterns: ["costco", "costco wholesale"],
    abbreviations: [],
    abns: ["84096175383"],
    itemPrefixes: [],
  },
  {
    canonical: "Harris Farm",
    patterns: ["harris farm", "harris farm markets"],
    abbreviations: [],
    abns: [],
    itemPrefixes: [],
  },
  {
    canonical: "FoodWorks",
    patterns: ["foodworks", "food works"],
    abbreviations: [],
    abns: [],
    itemPrefixes: [],
  },
  {
    canonical: "Drakes",
    patterns: ["drakes", "drakes supermarket", "drake supermarket"],
    abbreviations: [],
    abns: [],
    itemPrefixes: [],
  },
];

interface StoreDetection {
  store_name: string;
  store_confidence: number;
  store_review_required: boolean;
  detected_abn: string | null;
  detection_method: string;
}

// ── PASS 1.5: Store Detection ──
function detectStore(parsed: any): StoreDetection {
  const aiStoreName = (parsed.store_name || "").trim();
  const aiStoreNameLower = aiStoreName.toLowerCase();

  // Extract ABN if present in raw OCR or store name
  const abnMatch = aiStoreName.match(/\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/);
  const detectedAbn = abnMatch ? abnMatch[1].replace(/\s/g, "") : null;

  let bestMatch: typeof KNOWN_STORES[0] | null = null;
  let bestScore = 0;
  let method = "unknown";

  // Method 1: ABN lookup (highest confidence)
  if (detectedAbn) {
    for (const store of KNOWN_STORES) {
      if (store.abns.includes(detectedAbn)) {
        bestMatch = store;
        bestScore = 1.0;
        method = "abn";
        break;
      }
    }
  }

  // Method 2: Direct name match
  if (!bestMatch || bestScore < 0.9) {
    for (const store of KNOWN_STORES) {
      for (const pattern of store.patterns) {
        if (aiStoreNameLower.includes(pattern)) {
          const score = pattern.length / Math.max(aiStoreNameLower.length, 1);
          const matchScore = Math.max(0.7, Math.min(0.95, score + 0.3));
          if (matchScore > bestScore) {
            bestMatch = store;
            bestScore = matchScore;
            method = "name_match";
          }
        }
      }
    }
  }

  // Method 3: Abbreviation match in store name
  if (!bestMatch || bestScore < 0.7) {
    for (const store of KNOWN_STORES) {
      for (const abbr of store.abbreviations) {
        const abbrRegex = new RegExp(`\\b${abbr}\\b`, "i");
        if (abbrRegex.test(aiStoreNameLower)) {
          if (bestScore < 0.6) {
            bestMatch = store;
            bestScore = 0.6;
            method = "abbreviation";
          }
        }
      }
    }
  }

  // Method 4: Item prefix analysis (look at item names for store-branded items)
  if (!bestMatch || bestScore < 0.7) {
    const items = parsed.items || [];
    const prefixCounts: Record<string, number> = {};

    for (const store of KNOWN_STORES) {
      let count = 0;
      for (const item of items) {
        const rawUpper = (item.raw_name || "").toUpperCase();
        for (const prefix of store.itemPrefixes) {
          if (rawUpper.startsWith(prefix)) count++;
        }
      }
      if (count > 0) prefixCounts[store.canonical] = count;
    }

    const topPrefix = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0];
    if (topPrefix && topPrefix[1] >= 3) {
      const store = KNOWN_STORES.find((s) => s.canonical === topPrefix[0]);
      if (store) {
        const prefixScore = Math.min(0.85, 0.5 + topPrefix[1] * 0.05);
        if (prefixScore > bestScore) {
          bestMatch = store;
          bestScore = prefixScore;
          method = "item_prefixes";
        }
      }
    }
  }

  // Determine result
  if (bestMatch && bestScore >= 0.7) {
    return {
      store_name: bestMatch.canonical,
      store_confidence: Math.round(bestScore * 100) / 100,
      store_review_required: bestScore < 0.85,
      detected_abn: detectedAbn,
      detection_method: method,
    };
  }

  if (bestMatch && bestScore >= 0.4) {
    return {
      store_name: bestMatch.canonical,
      store_confidence: Math.round(bestScore * 100) / 100,
      store_review_required: true,
      detected_abn: detectedAbn,
      detection_method: method,
    };
  }

  // No confident match — use AI's raw output but flag for review
  return {
    store_name: aiStoreName || "Unknown Store",
    store_confidence: 0.3,
    store_review_required: true,
    detected_abn: detectedAbn,
    detection_method: "ai_raw",
  };
}

// ── PASS 2: Validation & Correction ──
function validateReceipt(parsed: any, storeDetection: StoreDetection) {
  const items = (parsed.items || []).map((item: any) => ({
    raw_name: item.raw_name || "",
    clean_name: item.clean_name || item.raw_name || "",
    ingredient_keyword: item.ingredient_keyword || null,
    category: item.category || "Other",
    price: typeof item.price === "number" ? item.price : parseFloat(item.price) || 0,
    quantity: item.quantity || 1,
    is_discount: item.is_discount || false,
    is_food: item.is_food !== undefined ? item.is_food : true,
    confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
  }));

  const warnings: string[] = [];

  // Store detection warning
  if (storeDetection.store_review_required) {
    warnings.push(
      `Store detected as "${storeDetection.store_name}" (${Math.round(storeDetection.store_confidence * 100)}% confidence). Please confirm.`
    );
  }

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

  // Validation 3: Check for duplicate items
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.clean_name.toLowerCase()}|${item.price}`;
    if (seen.has(key) && !item.is_discount) {
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

  // ── Granular confidence scores ──
  const confidences = items.map((i: any) => i.confidence);
  const avgItemConfidence = confidences.length > 0
    ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
    : 0;

  // Date confidence
  const dateConfidence = parsed.receipt_date ? 0.95 : 0.0;

  // Total confidence: how well do items add up to the stated total?
  let totalConfidence = 0.5;
  if (statedTotal !== null) {
    const totalDiffPct = Math.abs(calcTotal - statedTotal) / Math.max(statedTotal, 1);
    if (totalDiffPct < 0.01) totalConfidence = 1.0;
    else if (totalDiffPct < 0.05) totalConfidence = 0.8;
    else if (totalDiffPct < 0.1) totalConfidence = 0.6;
    else totalConfidence = 0.3;
  }

  // Store confidence comes from storeDetection
  const storeConf = storeDetection.store_confidence;

  // Items with low confidence
  const lowConfItemCount = items.filter((i: any) => i.confidence < 0.5).length;
  const itemExtractionConfidence = items.length > 0
    ? Math.max(0.1, avgItemConfidence - (lowConfItemCount / items.length) * 0.2)
    : 0.1;

  // Overall confidence: weighted average of all dimensions
  let overallConfidence = (
    storeConf * 0.15 +
    dateConfidence * 0.1 +
    itemExtractionConfidence * 0.45 +
    totalConfidence * 0.3
  );
  overallConfidence = Math.round(overallConfidence * 100) / 100;

  // ── Review threshold: if ANY dimension is weak, require review ──
  const REVIEW_THRESHOLD = 0.6;
  const needsReview = overallConfidence < 0.75 ||
    storeConf < REVIEW_THRESHOLD ||
    totalConfidence < REVIEW_THRESHOLD ||
    lowConfItemCount > 0 ||
    dateConfidence < REVIEW_THRESHOLD ||
    warnings.length > 0;

  const nonDiscountTotal = items
    .filter((i: any) => !i.is_discount)
    .reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const discountTotal = items
    .filter((i: any) => i.is_discount)
    .reduce((s: number, i: any) => s + i.price * i.quantity, 0);

  return {
    store_name: storeDetection.store_name,
    store_confidence: storeDetection.store_confidence,
    store_review_required: storeDetection.store_review_required,
    detected_abn: storeDetection.detected_abn,
    receipt_date: parsed.receipt_date || null,
    receipt_time: parsed.receipt_time || null,
    date_confidence: dateConfidence,
    total_confidence: totalConfidence,
    item_extraction_confidence: itemExtractionConfidence,
    items,
    subtotal: parsed.subtotal || nonDiscountTotal,
    total_discounts: parsed.total_discounts || discountTotal,
    total: statedTotal || calcTotal,
    overall_confidence: overallConfidence,
    needs_review: needsReview,
    warnings,
  };
}

function shouldRunFallback(data: any): boolean {
  return !data ||
    data.items.length < 3 ||
    data.item_extraction_confidence < 0.7 ||
    data.total_confidence < 0.6 ||
    data.store_name === "Unknown Store";
}

function chooseBestExtraction(primary: any | null, fallback: any) {
  if (!primary) return fallback;

  const primaryScore = primary.items.length * 0.08 + primary.overall_confidence + primary.total_confidence * 0.4;
  const fallbackScore = fallback.items.length * 0.08 + fallback.overall_confidence + fallback.total_confidence * 0.4;

  return fallbackScore > primaryScore + 0.15 ? fallback : primary;
}

// ── Save to database ──
async function saveReceipt(supabase: any, receiptId: string, data: any) {
  // Update receipt metadata
  await supabase
    .from("receipts")
    .update({
      store_name: data.store_name,
      store_confidence: data.store_confidence,
      store_review_required: data.store_review_required,
      detected_abn: data.detected_abn,
      total_amount: data.total,
      subtotal: data.subtotal,
      total_discounts: data.total_discounts,
      overall_confidence: data.overall_confidence,
      receipt_time: data.receipt_time,
      raw_ocr_text: JSON.stringify({
        warnings: data.warnings,
        extraction_method: data.extraction_method,
        date_confidence: data.date_confidence,
        total_confidence: data.total_confidence,
        item_extraction_confidence: data.item_extraction_confidence,
        needs_review: data.needs_review,
      }),
      status: data.needs_review ? "needs_review" : "reviewed",
      ...(data.receipt_date ? { shop_date: data.receipt_date } : {}),
    })
    .eq("id", receiptId);

  // Insert items
  const itemsToInsert = data.items.map((item: any) => ({
    receipt_id: receiptId,
    raw_name: item.raw_name,
    clean_name: item.clean_name,
    ingredient_keyword: item.ingredient_keyword,
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
