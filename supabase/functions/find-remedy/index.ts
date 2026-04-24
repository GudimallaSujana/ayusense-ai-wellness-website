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
    disease.disease,
    disease.disease,
    disease.symptoms,
    disease.symptoms,
    disease.diagnosis,
    disease.doshas,
    disease.prakriti,
    disease.risk_factors,
    disease.seasonal_variation,
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symptoms, location } = await req.json();
    if (!symptoms) throw new Error("No symptoms provided");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: diseases } = await supabase
      .from("diseases")
      .select("*");

    const { data: herbs } = await supabase
      .from("herbs")
      .select("name, preview, pacify, aggravate, tridosha, rasa, guna, virya, vipaka, prabhav");

    const diseaseRows = diseases || [];
    const herbRows = herbs || [];
    const symptomTerms = keywords(String(symptoms));
    const rankedDiseases = diseaseRows
      .map((d: any) => ({ ...d, _matchScore: scoreDisease(d, symptomTerms) }))
      .sort((a: any, b: any) => b._matchScore - a._matchScore);

    const matchedDiseases = rankedDiseases.filter((d: any) => d._matchScore > 0).slice(0, 12);
    const contextDiseases = matchedDiseases.length > 0 ? matchedDiseases : rankedDiseases.slice(0, 20);

    const diseaseHerbNames = contextDiseases.flatMap((d: any) => [
      ...splitNames(d.ayurvedic_herbs),
      ...splitNames(d.herbal_remedies),
      ...splitNames(d.formulation),
    ]);
    const candidateHerbs = uniqueByName(diseaseHerbNames.map((name) => findHerbByName(herbRows, name)).filter(Boolean)).slice(0, 30);
    const herbContextRows = candidateHerbs.length > 0 ? candidateHerbs : herbRows.slice(0, 60);

    const diseaseContext = contextDiseases.map((d: any) => 
      `${d.disease}|Symptoms:${d.symptoms}|Score:${d._matchScore || 0}|Herbs:${d.ayurvedic_herbs}|Formulation:${d.formulation}|Doshas:${d.doshas}|Prakriti:${d.prakriti}|Diet:${d.diet_lifestyle}|Yoga:${d.yoga_therapy}|Remedies:${d.herbal_remedies}|Severity:${d.severity}|Duration:${d.duration}|Prevention:${d.prevention}|Recommendations:${d.patient_recommendations}`
    ).join("\n");

    const herbContext = herbContextRows.map((h: any) =>
      `${h.name}|Preview:${h.preview || ""}|Pacifies:${(h.pacify||[]).join(",")}|Aggravates:${(h.aggravate||[]).join(",")}|Rasa:${(h.rasa||[]).join(",")}|Guna:${(h.guna||[]).join(",")}|Virya:${h.virya}|Vipaka:${h.vipaka}|Prabhav:${(h.prabhav||[]).join(",")}`
    ).join("\n");

    const systemPrompt = `You are AyuSense, an Ayurvedic remedy advisor. Use ONLY the disease and herb data below. Do not invent diseases, herbs, formulations, or dosha facts. Explain all Ayurvedic terms in simple human language. Do not output standalone technical words like Pitta, Kapha, Vata, Ushna, Virya, Rasa, Guna, Vipaka, or Prabhav without explaining what they mean in the same sentence.

=== BEST MATCHING DISEASE RECORDS (${contextDiseases.length}) ===
${diseaseContext}

=== RELEVANT HERB RECORDS (${herbContextRows.length}) ===
${herbContext}

RULES:
1. Match broadly but precisely: include every disease record that shares symptom meaning, body system, dosha pattern, or likely presentation.
2. Return 6 to 10 plant recommendations whenever database data supports them.
3. Return up to 12 matched conditions, ordered by relevance.
4. Prefer herbs and formulations explicitly listed in the matched disease records.
5. Cross-reference herb actions from the herb records.
6. If exact matching is weak, include closest database matches and explain uncertainty.
7. Safety guidance must be educational and advise consulting a qualified practitioner.

Respond only in this JSON format:
{
  "matchedConditions": ["Disease names matched from database"],
  "plants": [
    {
      "name": "Herb name from database",
      "reason": "Why this herb is recommended based on matched database records",
      "mechanism": "Ayurvedic mechanism from herb database",
      "doshaEffect": "Which doshas it pacifies/aggravates",
      "remedy": "Exact formulation or remedy from disease database",
      "precautions": "Safety information",
      "confidence": 85
    }
  ],
  "doshaAnalysis": "Dosha analysis based on symptoms and matched records",
  "prakritiInsight": "Constitution insight from database",
  "dietRecommendations": "Diet recommendations from matched records",
  "yogaRecommendations": "Yoga recommendations from matched records",
  "alternatives": ["More alternative herbs from database"],
  "severity": "Severity from database",
  "duration": "Treatment duration from database",
  "disclaimer": "Always consult a qualified Ayurvedic practitioner. This is for educational purposes only."
}`;

    const userMessage = location 
      ? `Symptoms: ${symptoms}\nLocation: ${location}\nReturn broader precise matches and more database-backed remedies.`
      : `Symptoms: ${symptoms}\nReturn broader precise matches and more database-backed remedies.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error("Gemini API error:", status, errorText);
      if (status >= 500) {
        return new Response(JSON.stringify({
          matchedConditions: contextDiseases.slice(0, 8).map((d: any) => d.disease),
          plants: [],
          alternatives: candidateHerbs.slice(0, 10).map((h: any) => h.name),
          disclaimer: "Always consult a qualified Ayurvedic practitioner. This is for educational purposes only.",
          error: "Remedy analysis is temporarily unavailable. Please try again in a moment.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited or API quota exceeded. Replace or recharge GEMINI_API_KEY, then update the GEMINI_API_KEY secret." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Gemini billing or credits are exhausted. Replace or recharge GEMINI_API_KEY, then update the GEMINI_API_KEY secret." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini API error: ${status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n") || "";

    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      parsed = { matchedConditions: [], plants: [], alternatives: [], error: "Failed to parse AI response" };
    }

    const verifiedConditionNames = contextDiseases.slice(0, 12).map((d: any) => d.disease);
    const aiConditions = Array.isArray(parsed.matchedConditions) ? parsed.matchedConditions : [];
    parsed.matchedConditions = [...new Set([...aiConditions, ...verifiedConditionNames])].slice(0, 12);

    const existingPlants = Array.isArray(parsed.plants) ? parsed.plants : [];
    const fallbackPlants = candidateHerbs.slice(0, 10).map((h: any, index: number) => {
      const related = contextDiseases.find((d: any) => (d.ayurvedic_herbs || "").toLowerCase().includes(h.name.toLowerCase()) || (d.herbal_remedies || "").toLowerCase().includes(h.name.toLowerCase())) || contextDiseases[0];
      return {
        name: h.name,
        reason: `Recommended from database match for ${related?.disease || "the closest matched condition"}.`,
        mechanism: `Rasa: ${(h.rasa || []).join(", ") || "not specified"}; Guna: ${(h.guna || []).join(", ") || "not specified"}; Virya: ${h.virya || "not specified"}; Vipaka: ${h.vipaka || "not specified"}.`,
        doshaEffect: `Pacifies: ${(h.pacify || []).join(", ") || "not specified"} | Aggravates: ${(h.aggravate || []).join(", ") || "not specified"}`,
        remedy: related?.formulation || related?.herbal_remedies || "Use only under guidance from a qualified Ayurvedic practitioner.",
        precautions: "Avoid self-medication during pregnancy, chronic disease, allergies, or when taking prescription medicines.",
        confidence: Math.max(68, Math.min(92, 88 - index * 2)),
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
          doshaEffect: `May help calm: ${(matchedHerb.pacify||[]).join(", ") || "not specified"}. May increase imbalance in: ${(matchedHerb.aggravate||[]).join(", ") || "not specified"}. Use with guidance if you are sensitive to heat, dryness, or heaviness.`,
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
