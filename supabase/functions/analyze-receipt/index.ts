import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { receipt_id } = await req.json();
    if (!receipt_id) {
      return new Response(JSON.stringify({ error: "receipt_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get receipt
    const { data: receipt } = await supabase
      .from("receipts")
      .select("id, store_name, total_amount, shop_date")
      .eq("id", receipt_id)
      .eq("user_id", user.id)
      .single();

    if (!receipt) {
      return new Response(JSON.stringify({ error: "Receipt not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get items
    const { data: items } = await supabase
      .from("receipt_items")
      .select("clean_name, category, price, quantity, is_discount, is_food")
      .eq("receipt_id", receipt_id);

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemList = items
      .filter((i) => !i.is_discount)
      .map((i) => `${i.clean_name} — $${i.price} x${i.quantity} [${i.category}] ${i.is_food ? "food" : "non-food"}`)
      .join("\n");

    const prompt = `You are an Australian grocery shopping analyst. Analyse this receipt and return a JSON object.

Store: ${receipt.store_name}
Total: $${receipt.total_amount}
Items:
${itemList}

Return ONLY valid JSON (no markdown fences):
{
  "scores": {
    "value": <0-100 int — are they getting good prices? store brands score higher>,
    "health": <0-100 int — ratio of whole foods vs processed/junk>,
    "meal_potential": <0-100 int — can these items make complete meals?>,
    "waste_risk": <0-100 int — LOW is good. high perishable count + large quantities = higher risk>
  },
  "best_value": [
    { "item": "<item name from their receipt>", "note": "<why it's good value, keep short>" }
  ],
  "cheaper_swaps": [
    { "current": "<exact item name from receipt>", "current_price": "<price they paid>", "swap": "<cheaper alternative>", "swap_price": "<estimated price>", "save": "<dollar saving>" }
  ],
  "healthier_swaps": [
    { "current": "<exact item name from receipt>", "swap": "<healthier alternative>", "reason": "<2-4 word reason>" }
  ]
}

Rules:
- best_value: pick 2-3 items that are genuinely well-priced
- cheaper_swaps: pick 2-3 items where a store-brand or alternative saves money. Use REAL item names from their receipt, not made up ones.
- healthier_swaps: pick 2-3 items where a simple swap improves nutrition. Use REAL item names from their receipt.
- All item names must come from the receipt data above — never invent items they didn't buy
- Keep notes/reasons brief and casual Australian English`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: aiResponse.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save scores to receipt
    await supabase
      .from("receipts")
      .update({
        value_score: parsed.scores?.value ?? null,
        health_score: parsed.scores?.health ?? null,
        meal_potential_score: parsed.scores?.meal_potential ?? null,
        waste_risk_score: parsed.scores?.waste_risk ?? null,
      })
      .eq("id", receipt_id);

    // Save recommendations
    const recs = [
      ...(parsed.cheaper_swaps || []).map((s: any) => ({
        receipt_id,
        type: "cheaper_swap",
        current_item: s.current,
        suggested_item: `${s.swap} ~${s.swap_price}`,
        potential_saving: parseFloat(String(s.save).replace("$", "")) || null,
        reason: `Save ${s.save}`,
      })),
      ...(parsed.healthier_swaps || []).map((s: any) => ({
        receipt_id,
        type: "healthier_swap",
        current_item: s.current,
        suggested_item: s.swap,
        potential_saving: null,
        reason: s.reason,
      })),
    ];

    if (recs.length > 0) {
      // Clear old recommendations for this receipt first
      await supabase.from("recommendations").delete().eq("receipt_id", receipt_id);
      await supabase.from("recommendations").insert(recs);
    }

    return new Response(
      JSON.stringify({
        scores: parsed.scores,
        best_value: parsed.best_value,
        cheaper_swaps: parsed.cheaper_swaps,
        healthier_swaps: parsed.healthier_swaps,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
