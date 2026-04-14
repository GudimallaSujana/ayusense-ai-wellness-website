
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.herbs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  link TEXT,
  preview TEXT,
  pacify TEXT[] DEFAULT '{}',
  aggravate TEXT[] DEFAULT '{}',
  tridosha BOOLEAN DEFAULT false,
  rasa TEXT[] DEFAULT '{}',
  guna TEXT[] DEFAULT '{}',
  virya TEXT,
  vipaka TEXT,
  prabhav TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_herbs_name ON public.herbs USING btree (lower(name));
CREATE INDEX idx_herbs_name_trgm ON public.herbs USING gin (name gin_trgm_ops);

ALTER TABLE public.herbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herbs are publicly readable" ON public.herbs FOR SELECT USING (true);

CREATE TABLE public.diseases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  disease TEXT NOT NULL,
  hindi_name TEXT,
  marathi_name TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  severity TEXT,
  duration TEXT,
  medical_history TEXT,
  current_medications TEXT,
  risk_factors TEXT,
  environmental_factors TEXT,
  sleep_patterns TEXT,
  stress_levels TEXT,
  activity_levels TEXT,
  family_history TEXT,
  dietary_habits TEXT,
  allergies TEXT,
  seasonal_variation TEXT,
  age_group TEXT,
  gender TEXT,
  occupation TEXT,
  cultural_preferences TEXT,
  herbal_remedies TEXT,
  ayurvedic_herbs TEXT,
  formulation TEXT,
  doshas TEXT,
  prakriti TEXT,
  diet_lifestyle TEXT,
  yoga_therapy TEXT,
  medical_intervention TEXT,
  prevention TEXT,
  prognosis TEXT,
  complications TEXT,
  patient_recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diseases_disease ON public.diseases USING btree (lower(disease));
CREATE INDEX idx_diseases_symptoms ON public.diseases USING gin (to_tsvector('english', coalesce(symptoms, '')));
CREATE INDEX idx_diseases_herbs ON public.diseases USING gin (to_tsvector('english', coalesce(ayurvedic_herbs, '')));

ALTER TABLE public.diseases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diseases are publicly readable" ON public.diseases FOR SELECT USING (true);
