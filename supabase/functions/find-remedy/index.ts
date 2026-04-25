import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stopWords = new Set([
  "and", "with", "from", "have", "having", "the", "for", "that", "this", "pain", "very", "mild", "severe", "days", "week", "weeks",
]);

function keywords(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 2 && !stopWords.has(w)))];
}

function scoreDisease(disease: any, terms: string[]): number {
  const weightedText = [
    disease.disease, disease.disease, disease.symptoms, disease.symptoms,
    disease.diagnosis, disease.doshas, disease.prakriti, disease.risk_factors, disease.seasonal_variation,
  ].filter(Boolean).join(" ").toLowerCase();
  return terms.reduce((score, term) => {
    if (weightedText.includes(term)) return score + (disease.disease?.toLowerCase().includes(term) ? 4 : 2);
    return score;
  }, 0);
}

function splitNames(value: string | null | undefined): string[] {
  return [...new Set((value || "").split(/[,;|\n/&]+/).map((v) => v.replace(/\([^)]*\)/g, "").trim()).filter((v) => v.length > 1))];
}

function findHerbByName(herbs: any[], name: string) {
  const normalized = name.toLowerCase();
  return herbs.find((h) => h.name.toLowerCase() === normalized)
    || herbs.find((h) => normalized.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(normalized));
}

function uniqueByName(items: any[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item?.name || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function callOpenRouter(systemPrompt: string, userMessage: string) {
  const AI_GATEWAY_KEY = Deno.env.get("AI_GATEWAY_KEY");
  const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://openrouter.ai/api/v1/chat/completions";
  if (!AI_GATEWAY_KEY) throw new Error("AI_GATEWAY_KEY not configured");

  const models = [
    "mistralai/mistral-7b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "openchat/openchat-7b:free",
    "mistralai/mistral-7b-instruct",
  ];

  let lastErr = "";
  for (const model of models) {
    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_GATEWAY_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ayusense.app",
        "X-Title": "AyuSense",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || "";
    }
    lastErr = `${resp.status} ${await resp.text()}`;
    console.error(`OpenRouter model ${model} failed:`, lastErr);
    if (resp.status !== 429 && resp.status !== 402 && resp.status !== 404) break;
  }
  throw new Error(`OpenRouter error: ${lastErr}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symptoms, location } = await req.json();
    if (!symptoms) throw new Error("No symptoms provided");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: diseases } = await supabase.from("diseases").select("*");
    const { data: herbs } = await supabase.from("herbs").select("name, preview, pacify, aggravate, tridosha, rasa, guna, virya, vipaka, prabhav");

    const diseaseRows = diseases || [];
    const herbRows = herbs || [];
    const symptomTerms = keywords(String(symptoms));
    const rankedDiseases = diseaseRows
      .map((d: any) => ({ ...d, _matchScore: scoreDisease(d, symptomTerms) }))
      .sort((a: any, b: any) => b._matchScore - a._matchScore);

    const matchedDiseases = rankedDiseases.filter((d: any) => d._matchScore > 0).slice(0, 12);
    const contextDiseases = matchedDiseases.length > 0 ? matchedDiseases : rankedDiseases.slice(0, 12);

    const diseaseHerbNames = contextDiseases.flatMap((d: any) => [
      ...splitNames(d.ayurvedic_herbs), ...splitNames(d.herbal_remedies), ...splitNames(d.formulation),
    ]);
    const candidateHerbs = uniqueByName(diseaseHerbNames.map((name) => findHerbByName(herbRows, name)).filter(Boolean)).slice(0, 15);
    const herbContextRows = candidateHerbs.length > 0 ? candidateHerbs : herbRows.slice(0, 10);

    // Slim context: only top 3 diseases + top 6 herbs to save tokens
    const slimDiseases = contextDiseases.slice(0, 3);
    const slimHerbs = herbContextRows.slice(0, 6);

    const diseaseContext = slimDiseases.map((d: any) =>
      `- ${d.disease} | Symptoms: ${d.symptoms} | Herbs: ${d.ayurvedic_herbs} | Formulation: ${d.formulation} | Doshas: ${d.doshas} | Diet: ${d.diet_lifestyle} | Yoga: ${d.yoga_therapy}`
    ).join("\n");

    const herbContext = slimHerbs.map((h: any) =>
      `- ${h.name}: pacifies ${(h.pacify||[]).join(",")}, aggravates ${(h.aggravate||[]).join(",")}, taste ${(h.rasa||[]).join(",")}, effect ${h.virya}`
    ).join("\n");

    const systemPrompt = `You are an Ayurvedic expert. Explain remedies in simple human language. Never output untranslated Sanskrit terms (Pitta, Kapha, Vata, Ushna, Virya, Rasa, Guna, Vipaka, Prabhav) without a plain-English explanation in the same sentence. Respond ONLY with valid JSON.`;

    const userMessage = `Symptoms: ${symptoms}${location ? `\nLocation: ${location}` : ""}

Matched conditions from database:
${diseaseContext}

Available herbs from database:
${herbContext}

Return JSON in this exact shape (use only herbs from the list above):
{
  "matchedConditions": ["disease names"],
  "plants": [
    {
      "name": "herb name",
      "reason": "why this herb helps in plain language",
      "mechanism": "how it works in simple words",
      "doshaEffect": "which body imbalance it calms, in plain English",
      "remedy": "how to prepare and take it",
      "precautions": "safety notes",
      "confidence": 85
    }
  ],
  "doshaAnalysis": "plain-language body imbalance analysis",
  "dietRecommendations": "diet advice",
  "yogaRecommendations": "yoga advice",
  "alternatives": ["other herb names"],
  "disclaimer": "Always consult a qualified Ayurvedic practitioner."
}

Return 6-10 plants. Keep language simple and human-friendly.`;

    let content = "";
    try {
      content = await callOpenRouter(systemPrompt, userMessage);
    } catch (aiErr) {
      console.error("AI gateway failed, using database fallback:", aiErr);
      const fallbackPlants = candidateHerbs.slice(0, 10).map((h: any, index: number) => {
        const related = contextDiseases.find((d: any) => (d.ayurvedic_herbs || "").toLowerCase().includes(h.name.toLowerCase())) || contextDiseases[0];
        return {
          name: h.name,
          reason: `Recommended from database match for ${related?.disease || "your symptoms"}.`,
          mechanism: `Taste: ${(h.rasa || []).join(", ") || "n/a"}; warming or cooling effect: ${h.virya || "n/a"}.`,
          doshaEffect: `May help calm: ${(h.pacify || []).join(", ") || "n/a"}. May worsen: ${(h.aggravate || []).join(", ") || "n/a"}.`,
          remedy: related?.formulation || related?.herbal_remedies || "Use under guidance from a qualified practitioner.",
          precautions: "Avoid during pregnancy, allergies, or with prescription medicines without guidance.",
          confidence: Math.max(68, 88 - index * 2),
          verified: true,
        };
      });
      return new Response(JSON.stringify({
        matchedConditions: contextDiseases.slice(0, 12).map((d: any) => d.disease),
        plants: fallbackPlants,
        alternatives: candidateHerbs.slice(0, 12).map((h: any) => h.name),
        doshaAnalysis: "Results based on closest matching database records.",
        disclaimer: "Always consult a qualified Ayurvedic practitioner. This is for educational purposes only.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      parsed = { matchedConditions: [], plants: [], alternatives: [] };
    }

    const verifiedConditionNames = contextDiseases.slice(0, 12).map((d: any) => d.disease);
    const aiConditions = Array.isArray(parsed.matchedConditions) ? parsed.matchedConditions : [];
    parsed.matchedConditions = [...new Set([...aiConditions, ...verifiedConditionNames])].slice(0, 12);

    const existingPlants = Array.isArray(parsed.plants) ? parsed.plants : [];
    const fallbackPlants = candidateHerbs.slice(0, 10).map((h: any, index: number) => {
      const related = contextDiseases.find((d: any) => (d.ayurvedic_herbs || "").toLowerCase().includes(h.name.toLowerCase())) || contextDiseases[0];
      return {
        name: h.name,
        reason: `Recommended from database match for ${related?.disease || "your symptoms"}.`,
        mechanism: `Taste: ${(h.rasa || []).join(", ") || "n/a"}; effect: ${h.virya || "n/a"}.`,
        doshaEffect: `May help calm: ${(h.pacify || []).join(", ") || "n/a"}.`,
        remedy: related?.formulation || related?.herbal_remedies || "Use under practitioner guidance.",
        precautions: "Avoid self-medication during pregnancy or with prescription medicines.",
        confidence: Math.max(68, 88 - index * 2),
        verified: true,
      };
    });

    parsed.plants = uniqueByName([...existingPlants, ...fallbackPlants]).slice(0, 10).map((p: any) => {
      const matchedHerb = findHerbByName(herbRows, p.name || "");
      if (matchedHerb) {
        return {
          ...p,
          name: matchedHerb.name,
          verified: true,
          doshaEffect: p.doshaEffect || `May help calm: ${(matchedHerb.pacify||[]).join(", ") || "n/a"}.`,
        };
      }
      return { ...p, verified: false };
    });

    parsed.alternatives = [...new Set([
      ...(Array.isArray(parsed.alternatives) ? parsed.alternatives : []),
      ...candidateHerbs.map((h: any) => h.name),
    ])].filter((name) => !parsed.plants.some((p: any) => p.name === name)).slice(0, 12);

    parsed.disclaimer = parsed.disclaimer || "Always consult a qualified Ayurvedic practitioner. This is for educational purposes only.";

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
