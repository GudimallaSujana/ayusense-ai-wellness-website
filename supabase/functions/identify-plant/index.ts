import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) throw new Error("No image provided");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are AyuSense, a premium AI-powered Ayurvedic plant identification system. You are an expert botanist and Ayurvedic practitioner.

When analyzing a plant image, provide a comprehensive identification with Ayurvedic context.

You MUST respond in this exact JSON format:
{
  "plantName": "Common name (e.g., Tulsi / Holy Basil)",
  "scientificName": "Latin binomial name",
  "family": "Botanical family",
  "confidence": 92,
  "features": ["List of visual features detected that led to identification"],
  "ayurvedicProfile": {
    "rasa": ["Taste qualities - Madhura, Amla, Lavana, Katu, Tikta, Kashaya"],
    "guna": ["Qualities - Laghu, Guru, Snigdha, Ruksha etc."],
    "virya": "Potency - Ushna or Sheeta",
    "vipaka": "Post-digestive effect",
    "doshaEffect": {
      "pacifies": ["Doshas it pacifies"],
      "aggravates": ["Doshas it may aggravate"]
    },
    "prabhav": ["Special therapeutic actions"]
  },
  "benefits": ["Detailed health benefits with Ayurvedic reasoning"],
  "remedies": [
    "Detailed safe home remedy with exact measurements and preparation steps"
  ],
  "climate": "Climate suitability and growing conditions",
  "availability": "Regional availability across India and globally",
  "alternatives": ["Alternative plants with similar properties if this one is unavailable"],
  "precautions": ["Safety precautions and contraindications"],
  "traditionalUses": "How this plant is used in traditional Ayurvedic texts (Charaka Samhita, Sushruta Samhita etc.)",
  "whyIdentified": "Detailed explanation of the visual analysis - what leaf shape, color, texture, stem characteristics, and other morphological features were used to identify this plant"
}

If you cannot identify the plant, set confidence below 30 and explain what you see.
Always be accurate and cite traditional Ayurvedic knowledge.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify this medicinal plant and provide its complete Ayurvedic profile." },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Service credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      parsed = { raw: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("identify-plant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
