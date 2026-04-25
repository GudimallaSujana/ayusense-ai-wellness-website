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

async function callAI(systemPrompt: string, userMessage: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENROUTER_KEY = Deno.env.get("AI_GATEWAY_KEY");

  // Provider chain: Lovable AI Gateway first (auto-provisioned), then OpenRouter as fallback
  const providers: { url: string; key: string; models: string[]; headers?: Record<string, string> }[] = [];
  if (LOVABLE_API_KEY) {
    providers.push({
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: LOVABLE_API_KEY,
      models: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"],
    });
  }
  if (OPENROUTER_KEY) {
    providers.push({
      url: Deno.env.get("AI_GATEWAY_URL") || "https://openrouter.ai/api/v1/chat/completions",
      key: OPENROUTER_KEY,
      models: ["google/gemini-flash-1.5", "mistralai/mistral-7b-instruct"],
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
            { role: "user", content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || "";
      }
      lastErr = `${resp.status} ${await resp.text()}`;
      console.error(`Model ${model} on ${p.url} failed:`, lastErr);
      if (resp.status !== 429 && resp.status !== 402 && resp.status !== 404) break;
    }
  }
  throw new Error(`AI error: ${lastErr}`);
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

    // Pair each candidate herb with its most relevant disease so AI can produce UNIQUE per-herb output
    const primaryDisease = contextDiseases[0];
    const slimDiseases = contextDiseases.slice(0, 3);
    const slimHerbs = herbContextRows.slice(0, 8);

    const herbWithDisease = slimHerbs.map((h: any) => {
      const related =
        contextDiseases.find((d: any) =>
          (d.ayurvedic_herbs || "").toLowerCase().includes(h.name.toLowerCase()) ||
          (d.herbal_remedies || "").toLowerCase().includes(h.name.toLowerCase())
        ) || primaryDisease;
      return { herb: h, disease: related };
    });

    const diseaseContext = slimDiseases.map((d: any) =>
      `• ${d.disease}\n   Symptoms: ${d.symptoms || "n/a"}\n   Doshas involved: ${d.doshas || "n/a"}\n   Prakriti: ${d.prakriti || "n/a"}\n   Diet & Lifestyle: ${d.diet_lifestyle || "n/a"}\n   Yoga & Therapy: ${d.yoga_therapy || "n/a"}`
    ).join("\n\n");

    const herbContext = herbWithDisease.map(({ herb: h, disease: d }) =>
      `• ${h.name} (for ${d?.disease || "general support"})\n   Calms (pacifies): ${(h.pacify||[]).join(", ") || "n/a"}\n   May worsen: ${(h.aggravate||[]).join(", ") || "n/a"}\n   Taste (rasa): ${(h.rasa||[]).join(", ") || "n/a"}\n   Qualities (guna): ${(h.guna||[]).join(", ") || "n/a"}\n   Potency (virya): ${h.virya || "n/a"}\n   Post-digestion (vipaka): ${h.vipaka || "n/a"}\n   Special action (prabhav): ${(h.prabhav||[]).join(", ") || "n/a"}\n   Suggested preparation: ${d?.formulation || d?.herbal_remedies || "n/a"}`
    ).join("\n\n");

    const systemPrompt = `You are a senior Ayurvedic practitioner writing a personalized consultation. Rules:
1. Write in simple, warm, human English. NEVER use raw Sanskrit (Pitta, Kapha, Vata, Ushna, Virya, Rasa, Guna, Vipaka, Prabhav) without immediately explaining it in plain English in the same sentence.
2. Every herb must have a UNIQUE explanation tailored to its OWN properties and the user's symptoms — no copy-paste, no template phrases, no repeated sentences across herbs.
3. Ground every claim in the database facts provided. Do not invent herbs.
4. Respond with ONLY valid JSON. No markdown, no commentary.`;

    const userMessage = `The user reports: "${symptoms}"${location ? `\nLocation: ${location}` : ""}

=== MATCHED CONDITIONS (from verified database) ===
${diseaseContext}

=== CANDIDATE HERBS (from verified database — use ONLY these) ===
${herbContext}

=== TASK ===
Produce a personalized Ayurvedic consultation as JSON in this EXACT shape:
{
  "matchedConditions": ["disease names from above"],
  "plants": [
    {
      "name": "<herb name exactly as listed>",
      "reason": "1–2 sentences: why THIS herb helps THIS user's symptoms (mention the specific symptom + the matched disease).",
      "mechanism": "1–2 sentences: how it works in the body, derived from its taste/qualities/potency above, explained in plain English.",
      "doshaEffect": "Plain-English description of which body imbalance it calms and which it may worsen, derived from its pacify/aggravate fields.",
      "remedy": "Concrete home preparation: ingredients, dose, frequency, time of day. Use the suggested preparation when present.",
      "precautions": "Specific safety notes for THIS herb (pregnancy, BP, diabetes, allergies, drug interactions).",
      "confidence": 70-95
    }
    // ONE entry per candidate herb — every entry MUST be different
  ],
  "doshaAnalysis": "2–3 sentences explaining, in plain English, which body imbalances are involved based on the user's symptoms and the matched conditions' doshas/prakriti. Example tone: 'Your symptoms point to an imbalance in the body's air/movement energy (causing dryness and restlessness) along with excess heat (causing irritability).'",
  "prakritiInsight": "1–2 sentences on the user's likely constitutional tendency based on the prakriti field.",
  "dietRecommendations": "Actionable diet advice as a short paragraph derived from the diet_lifestyle field of the top matched condition. Be specific: foods to favor, foods to avoid, meal timing.",
  "yogaRecommendations": "Actionable yoga & lifestyle advice as a short paragraph derived from the yoga_therapy field of the top matched condition. Name specific asanas, pranayama, or routines.",
  "severity": "mild | moderate | severe",
  "duration": "short-term | chronic",
  "alternatives": ["other herb names from the candidate list not used above"],
  "disclaimer": "Always consult a qualified Ayurvedic practitioner. This is for educational purposes only."
}

Return 6–10 plants. Every plant must have its OWN unique reason, mechanism, doshaEffect, remedy, and precautions — no two herbs should share sentences.`;

    let content = "";
    try {
      content = await callAI(systemPrompt, userMessage);
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
