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

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { receipt_id } = await req.json();
    if (!receipt_id) {
      return new Response(JSON.stringify({ error: "receipt_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get receipt record
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", receipt_id)
      .single();

    if (receiptError || !receipt) {
      return new Response(
        JSON.stringify({ error: "Receipt not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Download image from storage
    const imagePath = receipt.image_url;
    const { data: imageData, error: downloadError } = await supabase.storage
      .from("receipts")
      .download(imagePath);

    if (downloadError || !imageData) {
      return new Response(
        JSON.stringify({ error: "Could not download image" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Convert to base64 (chunked to avoid stack overflow)
    const arrayBuffer = await imageData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const mimeType = imageData.type || "image/jpeg";

    // Call Lovable AI Gateway with vision to extract receipt items
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
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: `You are an Australian grocery receipt OCR system. Extract all items from this receipt image.

Return a JSON object with this exact structure (no markdown, no code fences, just raw JSON):
{
  "store_name": "Store name from the receipt",
  "items": [
    {
      "raw_name": "Exact text from receipt",
      "clean_name": "Human-readable product name",
      "category": "One of: Fresh Produce, Meat, Dairy, Bakery, Pantry, Frozen, Drinks, Snacks, Household, Health & Beauty, Other",
      "price": 3.50,
      "quantity": 1,
      "is_discount": false
    }
  ],
  "total": 45.60
}

Rules:
- Include ALL items on the receipt
- If an item is a discount/savings line, set is_discount to true and make price negative
- Quantity should reflect multiples if shown (e.g., "2 @ $3.50" = quantity 2, price 3.50)
- Use Australian grocery categories
- clean_name should be a short, clear product name without codes or abbreviations`,
                },
              ],
            },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", errText);
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    // Parse the JSON from AI response
    let parsed;
    try {
      // Strip markdown fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse receipt data", raw: content }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
      (item: {
        raw_name?: string;
        clean_name?: string;
        category?: string;
        price?: number;
        quantity?: number;
        is_discount?: boolean;
      }) => ({
        receipt_id,
        raw_name: item.raw_name || "",
        clean_name: item.clean_name || item.raw_name || "",
        category: item.category || "Other",
        price: item.price || 0,
        quantity: item.quantity || 1,
        is_discount: item.is_discount || false,
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
        total: parsed.total,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
