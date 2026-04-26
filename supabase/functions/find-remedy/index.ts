import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symptoms, location } = await req.json();
    if (!symptoms) throw new Error("No symptoms provided");

    const AI_GATEWAY_KEY = Deno.env.get("AI_GATEWAY_KEY");
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://openrouter.ai/api/v1/chat/completions";
    if (!AI_GATEWAY_KEY) throw new Error("AI_GATEWAY_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Fetch all diseases for matching
    const { data: diseases } = await supabase
      .from("diseases")
      .select("*");

    // Fetch all herbs for cross-referencing
    const { data: herbs } = await supabase
      .from("herbs")
      .select("name, preview, pacify, aggravate, tridosha, rasa, guna, virya, vipaka, prabhav");

    const symptomTokens = String(symptoms)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2);

    const scoreRecord = (value: string) =>
      symptomTokens.reduce((score, token) => score + (value.includes(token) ? 1 : 0), 0);

    const relevantDiseases = (diseases || [])
      .map((d: any) => ({
        ...d,
        matchScore: scoreRecord(`${d.disease || ""} ${d.symptoms || ""} ${d.doshas || ""} ${d.ayurvedic_herbs || ""}`.toLowerCase()),
      }))
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 25);

    const relevantHerbText = relevantDiseases.map((d: any) => d.ayurvedic_herbs || "").join(" ").toLowerCase();
    const relevantHerbs = (herbs || [])
      .filter((h: any) => relevantHerbText.includes(String(h.name || "").toLowerCase()) || scoreRecord(`${h.name || ""} ${h.preview || ""}`.toLowerCase()) > 0)
      .slice(0, 45);

    // Build compact disease context for AI
    const diseaseContext = relevantDiseases.map((d: any) => 
      `${d.disease}|${d.symptoms}|Herbs:${d.ayurvedic_herbs}|Formulation:${d.formulation}|Doshas:${d.doshas}|Prakriti:${d.prakriti}|Diet:${d.diet_lifestyle}|Yoga:${d.yoga_therapy}|Remedies:${d.herbal_remedies}|Severity:${d.severity}|Duration:${d.duration}|Prevention:${d.prevention}|Complications:${d.complications}|Recommendations:${d.patient_recommendations}`
    ).join("\n");

    // Build herb context
    const herbContext = relevantHerbs.map((h: any) =>
      `${h.name}|Pacifies:${(h.pacify||[]).join(",")}|Aggravates:${(h.aggravate||[]).join(",")}|Rasa:${(h.rasa||[]).join(",")}|Guna:${(h.guna||[]).join(",")}|Virya:${h.virya}|Vipaka:${h.vipaka}|Prabhav:${(h.prabhav||[]).join(",")}`
    ).join("\n");

    const systemPrompt = `You are AyuSense, an AI Ayurvedic remedy advisor. You MUST use ONLY the disease and herb data provided below to generate recommendations. Do NOT invent data.

=== RELEVANT DISEASE DATABASE (${relevantDiseases.length} of ${(diseases || []).length} records) ===
${diseaseContext}

=== RELEVANT HERB DATABASE (${relevantHerbs.length} of ${(herbs || []).length} records) ===
${herbContext}

INSTRUCTIONS:
1. Match user symptoms to diseases in the database using keyword/semantic matching
2. For each matched disease, extract the herbs, formulations, and recommendations FROM THE DATABASE
3. Cross-reference herbs with the herb database for dosha profiles
4. If a location is provided, mention regional availability
5. NEVER invent diseases or herbs not in the database
6. If no match found, say so honestly and suggest the closest matches

Respond with valid compact JSON only. Do not use markdown fences. Use this JSON format:
{
  "matchedConditions": ["Disease names matched from database"],
  "plants": [
    {
      "name": "Herb name from database",
      "reason": "Why this herb is recommended based on database data",
      "mechanism": "Ayurvedic mechanism from herb database (dosha, rasa, etc.)",
      "doshaEffect": "Which doshas it pacifies/aggravates",
      "remedy": "Exact formulation from disease database",
      "precautions": "Safety information",
      "confidence": 85
    }
  ],
  "doshaAnalysis": "Dosha analysis based on symptoms and database",
  "prakritiInsight": "Constitution insight from database",
  "dietRecommendations": "Diet recommendations from matched disease records",
  "yogaRecommendations": "Yoga recommendations from matched disease records",
  "alternatives": ["Alternative herbs from database"],
  "severity": "Severity from database",
  "duration": "Treatment duration from database",
  "disclaimer": "Always consult a qualified Ayurvedic practitioner. This is for educational purposes only."
}`;

    const userMessage = location 
      ? `Symptoms: ${symptoms}\nLocation: ${location}\nFind matching diseases and remedies from the database.`
      : `Symptoms: ${symptoms}\nFind matching diseases and remedies from the database.`;

    const freeModels = [
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "openai/gpt-oss-120b:free",
      "openai/gpt-oss-20b:free",
      "openrouter/free",
    ];

    let response: Response | null = null;
    let lastError = "";

    for (const model of freeModels) {
      response = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_GATEWAY_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://lovable.dev",
          "X-Title": "AyuSense",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4096,
        }),
      });

      if (response.ok) break;
      lastError = await response.text();
      if (![402, 404, 429, 500, 502, 503, 504].includes(response.status)) break;
    }

    if (!response) throw new Error("AI gateway did not respond");

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Free AI models are busy. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "The free AI provider rejected this request. Please try again later." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}${lastError ? ` - ${lastError}` : ""}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      parsed = { error: "Failed to parse AI response", raw: content };
    }

    // Validate and enrich: ensure all herb names exist in our database
    if (parsed.plants && Array.isArray(parsed.plants)) {
      const herbNames = new Set((herbs || []).map((h: any) => h.name.toLowerCase()));
      parsed.plants = parsed.plants.map((p: any) => {
        const matchedHerb = (herbs || []).find((h: any) => 
          h.name.toLowerCase() === (p.name || "").toLowerCase()
        );
        if (matchedHerb) {
          p.verified = true;
          p.doshaEffect = `Pacifies: ${(matchedHerb.pacify||[]).join(", ")} | Aggravates: ${(matchedHerb.aggravate||[]).join(", ")}`;
        } else {
          p.verified = false;
        }
        return p;
      });
    }

    // Validate matched conditions exist in database
    if (parsed.matchedConditions && Array.isArray(parsed.matchedConditions)) {
      const diseaseNames = new Set((diseases || []).map((d: any) => d.disease.toLowerCase()));
      parsed.matchedConditions = parsed.matchedConditions.map((c: string) => {
        const found = diseaseNames.has(c.toLowerCase());
        return found ? c : `${c} (approximate match)`;
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("find-remedy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
