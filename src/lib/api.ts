import { supabase } from "@/integrations/supabase/client";

export interface PlantIdentificationResult {
  plantName: string;
  scientificName: string;
  family?: string;
  confidence: number;
  features: string[];
  ayurvedicProfile?: {
    rasa: string[];
    guna: string[];
    virya: string;
    vipaka: string;
    doshaEffect: {
      pacifies: string[];
      aggravates: string[];
    };
    prabhav: string[];
  };
  benefits: string[];
  remedies: string[];
  climate: string;
  availability: string;
  alternatives: string[];
  precautions?: string[];
  traditionalUses?: string;
  whyIdentified?: string;
  error?: string;
}

export interface RemedyResult {
  matchedConditions?: string[];
  plants: {
    name: string;
    reason: string;
    mechanism: string;
    doshaEffect?: string;
    remedy: string;
    precautions: string;
    confidence: number;
  }[];
  doshaAnalysis?: string;
  prakritiInsight?: string;
  dietRecommendations?: string;
  yogaRecommendations?: string;
  alternatives: string[];
  severity?: string;
  duration?: string;
  disclaimer?: string;
  error?: string;
}

export async function identifyPlant(imageBase64: string): Promise<PlantIdentificationResult> {
  const { data, error } = await supabase.functions.invoke("identify-plant", {
    body: { imageBase64 },
  });

  if (error) throw new Error(error.message || "Failed to identify plant");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function findRemedy(symptoms: string, location?: string): Promise<RemedyResult> {
  const { data, error } = await supabase.functions.invoke("find-remedy", {
    body: { symptoms, location },
  });

  if (error) throw new Error(error.message || "Failed to find remedy");
  if (data?.error) throw new Error(data.error);
  return data;
}
