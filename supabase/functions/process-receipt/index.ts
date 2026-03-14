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

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing server config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
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
    const imageContents: { url: string; base64: string; mimeType: string }[] = [];

    for (const path of image_paths) {
      const { data: imageData, error: downloadError } = await supabase.storage
        .from("receipts")
        .download(path);

      if (downloadError || !imageData) {
        console.error(`Failed to download ${path}:`, downloadError);
        continue;
      }

      const arrayBuffer = await imageData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const mimeType = imageData.type || "image/jpeg";

      imageContents.push({ url: path, base64, mimeType });
    }

    if (imageContents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not download any images" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build message content with all images
    const messageContent: any[] = imageContents.map((img) => ({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    }));

    messageContent.push({
      type: "text",
      text: `You are an Australian grocery receipt OCR system. You are given ${imageContents.length} image(s) that may be PARTS OF THE SAME RECEIPT (a long docket photographed in sections) or separate dockets from the same shopping trip.

CRITICAL RULES:
1. DETERMINE if images are parts of the same receipt by looking for:
   - Overlapping items between images
   - Same store branding/header/footer
   - Sequential item numbering
   - Matching subtotals or running totals
2. DEDUPLICATE items that appear in multiple images (overlapping sections)
3. Classify each item as food or non-food:
   - Food: groceries, drinks, fresh produce, meat, dairy, bakery, pantry items, frozen food, snacks, baby food
   - Non-food: cleaning products, toiletries, pet supplies, stationery, clothing, kitchenware, bags, gift cards

Return a JSON object (no markdown fences, raw JSON only):
{
  "store_name": "Store name from the receipt",
  "items": [
    {
      "raw_name": "Exact text from receipt",
      "clean_name": "Human-readable product name",
      "category": "One of: Fresh Produce, Meat, Dairy, Bakery, Pantry, Frozen, Drinks, Snacks, Household, Health & Beauty, Pet, Baby, Other",
      "price": 3.50,
      "quantity": 1,
      "is_discount": false,
      "is_food": true
    }
  ],
  "total": 45.60
}

Rules:
- Include ALL unique items across all images (no duplicates from overlapping photos)
- If an item is a discount/savings line, set is_discount to true and make price negative
- Quantity should reflect multiples if shown (e.g., "2 @ $3.50" = quantity 2, price 3.50)
- clean_name should be a short, clear product name without codes or abbreviations
- Set is_food to false for non-food items like cleaning products, bags, toiletries, pet supplies`,
    });

    // Call Lovable AI Gateway
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: messageContent,
            },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    // Parse the JSON from AI response
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse receipt data", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update receipt with store name and total
    await supabase
      .from("receipts")
      .update({
        store_name: parsed.store_name || "Unknown",
        total_amount: parsed.total || null,
        raw_ocr_text: content,
        status: "reviewed",
      })
      .eq("id", receipt_id);

    // Insert receipt items
    const itemsToInsert = (parsed.items || []).map(
      (item: any) => ({
        receipt_id,
        raw_name: item.raw_name || "",
        clean_name: item.clean_name || item.raw_name || "",
        category: item.category || "Other",
        price: item.price || 0,
        quantity: item.quantity || 1,
        is_discount: item.is_discount || false,
        is_food: item.is_food !== undefined ? item.is_food : true,
      })
    );

    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("receipt_items")
        .insert(itemsToInsert);

      if (insertError) {
        console.error("Insert items error:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        receipt_id,
        store_name: parsed.store_name,
        item_count: itemsToInsert.length,
        food_items: itemsToInsert.filter((i: any) => i.is_food).length,
        non_food_items: itemsToInsert.filter((i: any) => !i.is_food).length,
        total: parsed.total,
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
