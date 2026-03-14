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

    // Get recent receipt items from last 2 weeks
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentReceipts } = await supabase
      .from("receipts")
      .select("id, store_name, shop_date, created_at")
      .eq("user_id", user.id)
      .in("status", ["confirmed", "reviewed"])
      .gte("created_at", twoWeeksAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!recentReceipts || recentReceipts.length === 0) {
      return new Response(
        JSON.stringify({
          suggestion: "You haven't scanned any dockets recently! Scan a receipt after your next shop and I'll suggest meals based on what you bought. 🛒",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const receiptIds = recentReceipts.map((r) => r.id);

    const { data: items } = await supabase
      .from("receipt_items")
      .select("clean_name, category, is_food, is_discount, price, quantity")
      .in("receipt_id", receiptIds)
      .eq("is_food", true)
      .eq("is_discount", false);

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ suggestion: "No food items found in your recent shops. Scan a grocery receipt to get meal ideas! 🍽️" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get household context
    const { data: household } = await supabase
      .from("households")
      .select("adults, children, dietary_preferences, cooking_skill, disliked_foods")
      .eq("user_id", user.id)
      .single();

    const itemList = items.map((i) => `${i.clean_name} (${i.category})`).join(", ");
    const stores = [...new Set(recentReceipts.map((r) => r.store_name).filter(Boolean))].join(", ");

    let householdContext = "";
    if (household) {
      const parts = [`${household.adults} adults`];
      if (household.children > 0) parts.push(`${household.children} children`);
      if (household.dietary_preferences) parts.push(`Dietary: ${household.dietary_preferences}`);
      if (household.cooking_skill) parts.push(`Cooking skill: ${household.cooking_skill}`);
      if (household.disliked_foods) parts.push(`Dislikes: ${household.disliked_foods}`);
      householdContext = `\nHousehold: ${parts.join(", ")}`;
    }

    const prompt = `You are a friendly Australian meal suggestion assistant. Based on the user's recent grocery purchases, suggest 3 quick, practical meals they can make tonight or this week.

Recent purchases from ${stores}: ${itemList}${householdContext}

Rules:
- Suggest exactly 3 meals — one quick (under 20 min), one hearty family meal, one creative/fun option
- Each meal should primarily use ingredients from their purchases
- Mention which purchased items each meal uses
- Note any common pantry staples needed (oil, salt, garlic etc)
- Use a warm, encouraging Australian tone
- Keep it concise — max 3-4 lines per meal
- Add a cooking time estimate
- End with one fun tip about using up perishables first

Format with markdown: use **bold** for meal names and bullet points for the list.`;

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
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "Couldn't generate suggestions right now.";

    return new Response(
      JSON.stringify({ suggestion: content, item_count: items.length, store: stores }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
