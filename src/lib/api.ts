const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://aohdlubsuktrakghwace.supabase.co";
const SUPABASE_API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvaGRsdWJzdWt0cmFrZ2h3YWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzE0MTYsImV4cCI6MjA5MjUwNzQxNn0.2t8NjyjP3Af-RE6cB7XgL7afvxBSSguGQk8Uv7iaXGw";

async function callEdgeFunction<T>(functionName: "identify-plant" | "find-remedy", body: Record<string, unknown>): Promise<T> {
  const apiUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
  console.log(`Calling API: ${apiUrl}`);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed with status ${response.status}`);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

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
  description?: string;
  databaseMatch?: boolean;
  warning?: string;
  treatedConditions?: {
    disease: string;
    symptoms: string;
    formulation: string;
    herbalRemedies: string;
  }[];
  error?: string;
}

export interface RemedyResult {
  matchedConditions?: string[];
  herbs?: string[];
  remedies?: string[];
  diet?: string[];
  yoga?: string[];
  explanation?: string;
  severity?: string;
  duration?: string;
  disclaimer?: string;
  error?: string;
}

export async function identifyPlant(imageBase64: string): Promise<PlantIdentificationResult> {
  return callEdgeFunction<PlantIdentificationResult>("identify-plant", { imageBase64 });
}

export async function findRemedy(symptoms: string, location?: string): Promise<RemedyResult> {
  return callEdgeFunction<RemedyResult>("find-remedy", { symptoms, location });
}
