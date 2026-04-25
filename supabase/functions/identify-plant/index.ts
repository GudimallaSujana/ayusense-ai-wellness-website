import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const doshaPlain: Record<string, string> = {
  vata: "air/movement imbalance such as dryness, worry, restlessness, pain, or poor sleep",
  pitta: "heat-related imbalance such as acidity, burning, inflammation, or irritability",
  kapha: "heaviness/mucus imbalance such as congestion, sluggishness, or excess mucus",
};

const propertyPlain: Record<string, string> = {
  tikta: "bitter taste that supports cleansing and lightness",
  kashaya: "astringent taste that helps tone tissues and dry excess fluid",
  madhura: "sweet nourishing effect that supports strength and recovery",
  katu: "pungent action that helps clear congestion and stimulate digestion",
  guru: "heavy/nourishing quality",
  snigdha: "moistening quality",
  laghu: "light/easy-to-digest quality",
  ruksha: "drying quality",
  medhya: "supports memory, focus, and calm mental function",
  balya: "supports strength and stamina",
  rasayan: "supports rejuvenation and resilience",
  rasayana: "supports rejuvenation and resilience",
  vrishya: "supports vitality",
  jwaraghna: "traditionally supports fever and heat management",
};

function explain(values: string[] | null | undefined, fallback = "") {
  const out = (values || []).filter(Boolean).map((v) => propertyPlain[String(v).toLowerCase().trim()] || String(v).toLowerCase());
  return out.length ? out.join("; ") : fallback;
}

function explainDoshas(values: string[] | null | undefined) {
  return (values || []).filter(Boolean).map((v) => doshaPlain[String(v).toLowerCase().trim()] || String(v).toLowerCase()).join(" and ");
}

async function callVisionAI(systemPrompt: string, userText: string, imageDataUrl: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENROUTER_KEY = Deno.env.get("AI_GATEWAY_KEY");

  const providers: { url: string; key: string; models: string[]; headers?: Record<string, string> }[] = [];
  if (LOVABLE_API_KEY) {
    providers.push({
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: LOVABLE_API_KEY,
      // Gemini flash models support vision via OpenAI-compatible image_url content
      models: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "google/gemini-2.5-pro"],
    });
  }
  if (OPENROUTER_KEY) {
    providers.push({
      url: Deno.env.get("AI_GATEWAY_URL") || "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_KEY,
      models: ["google/gemini-flash-1.5", "meta-llama/llama-3.2-11b-vision-instruct"],
      headers: { "HTTP-Referer": "https://ayusense.app", "X-Title": "AyuSense" },
    });
  }
  if (providers.length === 0) throw new Error("No AI provider configured");

  let lastErr = "";
  for (const p of providers) {
    for (const model of p.models) {
      const resp = await fetch(p.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${p.key}`,
          "Content-Type": "application/json",
          ...(p.headers || {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || "";
      }
      lastErr = `${resp.status} ${await resp.text()}`;
      console.error(`Vision model ${model} on ${p.url} failed:`, lastErr);
      if (resp.status !== 429 && resp.status !== 402 && resp.status !== 404) break;
    }
  }
  throw new Error(`Vision AI error: ${lastErr}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) throw new Error("No image provided");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: herbs } = await supabase
      .from("herbs")
      .select("name, preview, pacify, aggravate, tridosha, rasa, guna, virya, vipaka, prabhav");
    const { data: diseases } = await supabase
      .from("diseases")
      .select("disease, ayurvedic_herbs, formulation, herbal_remedies, symptoms, doshas, diet_lifestyle, yoga_therapy");

    const herbNames = (herbs || []).map((h: any) => h.name);

    const systemPrompt = `You are an expert botanist and Ayurvedic practitioner. Identify medicinal plants from images and match them to a known herb database. Always respond with valid JSON only. Use plain human language, never raw Sanskrit terms without explanation. Benefits, remedies, precautions, and whyIdentified must be specific to the identified plant, not generic.`;

    const userText = `Identify this medicinal plant. Match it to ONE of these herb names from our database (use the EXACT name):

${herbNames.join(", ")}

Respond with JSON only:
{
  "plantName": "exact name from list",
  "scientificName": "Latin name",
  "family": "botanical family",
  "confidence": 85,
  "features": ["visible features"],
  "benefits": ["plant-specific health benefits in plain language"],
  "remedies": ["plant-specific safe home remedies with measurements"],
  "climate": "climate suitability",
  "availability": "where it grows",
  "precautions": ["specific safety notes based on this plant's action, dose, and body imbalance it may worsen"],
  "traditionalUses": "traditional uses in plain words",
  "whyIdentified": "2–3 lines explaining the visible features that led to this identification and why this plant's known actions fit the database match"
}

If unsure, set confidence below 30.`;

    const imageDataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    let content = "";
    try {
      content = await callVisionAI(systemPrompt, userText, imageDataUrl);
    } catch (aiErr) {
      console.error("Vision AI failed:", aiErr);
      return new Response(JSON.stringify({
        plantName: "Identification unavailable",
        scientificName: "",
        confidence: 0,
        features: [], benefits: [], remedies: [], alternatives: [],
        climate: "", availability: "",
        precautions: ["Plant identification service is temporarily busy. Please try again in a moment."],
        databaseMatch: false,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      parsed = { plantName: "Unknown", confidence: 0 };
    }

    const identifiedName = parsed.plantName || "";
    const nameLower = identifiedName.toLowerCase().trim();
    let matchedHerb = (herbs || []).find((h: any) => h.name.toLowerCase() === nameLower);
    if (!matchedHerb) {
      matchedHerb = (herbs || []).find((h: any) =>
        nameLower.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(nameLower)
      );
    }
    if (!matchedHerb) {
      const firstWord = nameLower.split(/[\s\/,\(]+/)[0]?.trim();
      if (firstWord) matchedHerb = (herbs || []).find((h: any) => h.name.toLowerCase() === firstWord);
    }

    if (matchedHerb) {
      parsed.plantName = matchedHerb.name;
      parsed.databaseMatch = true;
      parsed.ayurvedicProfile = {
        rasa: matchedHerb.rasa || [],
        guna: matchedHerb.guna || [],
        virya: matchedHerb.virya || "",
        vipaka: matchedHerb.vipaka || "",
        doshaEffect: {
          pacifies: matchedHerb.pacify || [],
          aggravates: matchedHerb.aggravate || [],
        },
        prabhav: matchedHerb.prabhav || [],
      };
      if (matchedHerb.preview) parsed.description = matchedHerb.preview;

      const relatedDiseases = (diseases || []).filter((d: any) =>
        (d.ayurvedic_herbs || "").toLowerCase().includes(matchedHerb.name.toLowerCase())
      );
      if (relatedDiseases.length > 0) {
        parsed.treatedConditions = relatedDiseases.map((d: any) => ({
          disease: d.disease, symptoms: d.symptoms,
          formulation: d.formulation, herbalRemedies: d.herbal_remedies,
        }));
        const dbRemedies = relatedDiseases.filter((d: any) => d.formulation).map((d: any) => `For ${d.disease}: ${d.formulation}`);
        if (dbRemedies.length > 0) parsed.remedies = [...(parsed.remedies || []), ...dbRemedies];
      }

      const samePacify = matchedHerb.pacify || [];
      const alternatives = (herbs || [])
        .filter((h: any) => h.name !== matchedHerb.name && (h.pacify || []).some((p: string) => samePacify.includes(p)))
        .slice(0, 5).map((h: any) => h.name);
      if (alternatives.length > 0) parsed.alternatives = alternatives;
    } else {
      parsed.databaseMatch = false;
      parsed.warning = "This plant was not found in our verified database. Results are AI-generated.";
    }

    // Ensure all array fields exist so the frontend never crashes on .map()
    parsed.features = Array.isArray(parsed.features) ? parsed.features : [];
    parsed.benefits = Array.isArray(parsed.benefits) ? parsed.benefits : [];
    parsed.remedies = Array.isArray(parsed.remedies) ? parsed.remedies : [];
    parsed.alternatives = Array.isArray(parsed.alternatives) ? parsed.alternatives : [];
    parsed.precautions = Array.isArray(parsed.precautions) ? parsed.precautions : [];
    parsed.scientificName = parsed.scientificName || "";
    parsed.climate = parsed.climate || "";
    parsed.availability = parsed.availability || "";

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
