import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stopWords = new Set([
  "and", "with", "from", "have", "having", "the", "for", "that", "this", "very", "mild", "severe", "days", "week", "weeks", "feel", "feeling", "body", "also", "near", "often",
]);

function words(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).map((word) => word.trim()).filter((word) => word.length > 2 && !stopWords.has(word)))];
}

function scoreDisease(disease: any, userWords: string[]): number {
  const fields = [
    { value: disease.symptoms, weight: 5 },
    { value: disease.disease, weight: 4 },
    { value: disease.diagnosis, weight: 3 },
    { value: disease.risk_factors, weight: 2 },
    { value: disease.doshas, weight: 1 },
    { value: disease.prakriti, weight: 1 },
    { value: disease.seasonal_variation, weight: 1 },
  ];

  return userWords.reduce((total, word) => {
    return total + fields.reduce((fieldTotal, field) => {
      const text = String(field.value || "").toLowerCase();
      if (!text) return fieldTotal;
      if (text.split(/[^a-z0-9-]+/).includes(word)) return fieldTotal + field.weight + 2;
      if (text.includes(word)) return fieldTotal + field.weight;
      return fieldTotal;
    }, 0);
  }, 0);
}

function splitItems(value: string | null | undefined): string[] {
  return [...new Set(String(value || "").split(/[,;|\n/&]+/).map((item) => item.replace(/\([^)]*\)/g, "").trim()).filter((item) => item.length > 1))];
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function plainDoshaText(value: string): string {
  return value
    .replace(/\bPitta\b/g, "heat and acidity imbalance")
    .replace(/\bKapha\b/g, "heaviness, mucus, or sluggishness imbalance")
    .replace(/\bVata\b/g, "dryness, gas, or restlessness imbalance")
    .replace(/\bUshna\b/g, "warming")
    .replace(/\bVirya\b/g, "effect on the body")
    .replace(/\bRasa\b/g, "taste profile")
    .replace(/\bGuna\b/g, "natural qualities")
    .replace(/\bVipaka\b/g, "after-digestion effect")
    .replace(/\bPrabhav\b/g, "special traditional action");
}

async function explainWithAI(input: {
  disease?: string;
  symptoms: string;
  herbs: string;
  remedies: string;
  diet: string;
  yoga: string;
}) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey || !input.disease) {
    return "Basic recommendations based on Ayurvedic database (AI temporarily unavailable).";
  }

  const prompt = `Explain in simple human language:
Disease: ${input.disease}
Symptoms: ${input.symptoms}
Herbs: ${input.herbs || "Not listed"}
Remedies: ${input.remedies || "Not listed"}
Diet: ${input.diet || "Not listed"}
Yoga: ${input.yoga || "Not listed"}

Explain briefly:
- Why these herbs may help
- How to use them safely
- Simple precautions
Use easy, non-technical language. Do not use words like Pitta, Kapha, Vata, Ushna, Virya, Rasa, Guna, Vipaka, or Prabhav unless you explain them immediately in plain words.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    });

    if (!response.ok) {
      console.error("Gemini explanation failed:", response.status, await response.text());
      return "Basic recommendations based on Ayurvedic database (AI temporarily unavailable).";
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n").trim();
    return plainDoshaText(content || "Basic recommendations based on Ayurvedic database (AI temporarily unavailable).");
  } catch (error) {
    console.error("AI explanation fallback used:", error);
    return "Basic recommendations based on Ayurvedic database (AI temporarily unavailable).";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symptoms, location } = await req.json();
    if (!symptoms || !String(symptoms).trim()) {
      return new Response(JSON.stringify({ error: "Please enter symptoms before searching." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("find-remedy request received", { hasLocation: Boolean(location) });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: diseases, error: diseaseError } = await supabase.from("diseases").select("*");
    if (diseaseError) throw diseaseError;

    const diseaseRows = diseases || [];
    const userWords = words(String(symptoms));
    const ranked = diseaseRows
      .map((d: any) => ({ ...d, _score: scoreDisease(d, userWords) }))
      .filter((d: any) => d._score > 0)
      .sort((a: any, b: any) => b._score - a._score);

    const topMatches = ranked.slice(0, 5);
    const primary = topMatches[0];
    const herbs = unique(topMatches.flatMap((d: any) => [...splitItems(d.ayurvedic_herbs), ...splitItems(d.herbal_remedies), ...splitItems(d.formulation)])).slice(0, 12);
    const remedies = topMatches.map((d: any) => d.herbal_remedies || d.formulation).filter(Boolean).slice(0, 5);
    const diet = topMatches.map((d: any) => d.diet_lifestyle).filter(Boolean).slice(0, 5);
    const yoga = topMatches.map((d: any) => d.yoga_therapy).filter(Boolean).slice(0, 5);

    const explanation = await explainWithAI({
      disease: primary?.disease,
      symptoms: String(symptoms),
      herbs: String(primary?.ayurvedic_herbs || herbs.slice(0, 6).join(", ")),
      remedies: String(primary?.herbal_remedies || primary?.formulation || ""),
      diet: String(primary?.diet_lifestyle || ""),
      yoga: String(primary?.yoga_therapy || ""),
    });

    return new Response(JSON.stringify({
      matchedConditions: topMatches.map((d: any) => d.disease),
      herbs,
      remedies: remedies.map(plainDoshaText),
      diet: diet.map(plainDoshaText),
      yoga: yoga.map(plainDoshaText),
      explanation,
      severity: primary?.severity || undefined,
      duration: primary?.duration || undefined,
      disclaimer: "Always consult a qualified Ayurvedic practitioner. This is for educational purposes only and best suited for minor ailments.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("find-remedy error:", error);
    return new Response(JSON.stringify({
      matchedConditions: [],
      herbs: [],
      remedies: [],
      diet: [],
      yoga: [],
      explanation: "Basic recommendations based on Ayurvedic database (AI temporarily unavailable).",
      error: "Could not load remedy recommendations right now. Please try again.",
      disclaimer: "Always consult a qualified Ayurvedic practitioner. This is for educational purposes only and best suited for minor ailments.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
