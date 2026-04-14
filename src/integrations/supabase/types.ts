export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      diseases: {
        Row: {
          activity_levels: string | null
          age_group: string | null
          allergies: string | null
          ayurvedic_herbs: string | null
          complications: string | null
          created_at: string
          cultural_preferences: string | null
          current_medications: string | null
          diagnosis: string | null
          diet_lifestyle: string | null
          dietary_habits: string | null
          disease: string
          doshas: string | null
          duration: string | null
          environmental_factors: string | null
          family_history: string | null
          formulation: string | null
          gender: string | null
          herbal_remedies: string | null
          hindi_name: string | null
          id: string
          marathi_name: string | null
          medical_history: string | null
          medical_intervention: string | null
          occupation: string | null
          patient_recommendations: string | null
          prakriti: string | null
          prevention: string | null
          prognosis: string | null
          risk_factors: string | null
          seasonal_variation: string | null
          severity: string | null
          sleep_patterns: string | null
          stress_levels: string | null
          symptoms: string | null
          yoga_therapy: string | null
        }
        Insert: {
          activity_levels?: string | null
          age_group?: string | null
          allergies?: string | null
          ayurvedic_herbs?: string | null
          complications?: string | null
          created_at?: string
          cultural_preferences?: string | null
          current_medications?: string | null
          diagnosis?: string | null
          diet_lifestyle?: string | null
          dietary_habits?: string | null
          disease: string
          doshas?: string | null
          duration?: string | null
          environmental_factors?: string | null
          family_history?: string | null
          formulation?: string | null
          gender?: string | null
          herbal_remedies?: string | null
          hindi_name?: string | null
          id?: string
          marathi_name?: string | null
          medical_history?: string | null
          medical_intervention?: string | null
          occupation?: string | null
          patient_recommendations?: string | null
          prakriti?: string | null
          prevention?: string | null
          prognosis?: string | null
          risk_factors?: string | null
          seasonal_variation?: string | null
          severity?: string | null
          sleep_patterns?: string | null
          stress_levels?: string | null
          symptoms?: string | null
          yoga_therapy?: string | null
        }
        Update: {
          activity_levels?: string | null
          age_group?: string | null
          allergies?: string | null
          ayurvedic_herbs?: string | null
          complications?: string | null
          created_at?: string
          cultural_preferences?: string | null
          current_medications?: string | null
          diagnosis?: string | null
          diet_lifestyle?: string | null
          dietary_habits?: string | null
          disease?: string
          doshas?: string | null
          duration?: string | null
          environmental_factors?: string | null
          family_history?: string | null
          formulation?: string | null
          gender?: string | null
          herbal_remedies?: string | null
          hindi_name?: string | null
          id?: string
          marathi_name?: string | null
          medical_history?: string | null
          medical_intervention?: string | null
          occupation?: string | null
          patient_recommendations?: string | null
          prakriti?: string | null
          prevention?: string | null
          prognosis?: string | null
          risk_factors?: string | null
          seasonal_variation?: string | null
          severity?: string | null
          sleep_patterns?: string | null
          stress_levels?: string | null
          symptoms?: string | null
          yoga_therapy?: string | null
        }
        Relationships: []
      }
      herbs: {
        Row: {
          aggravate: string[] | null
          created_at: string
          guna: string[] | null
          id: string
          link: string | null
          name: string
          pacify: string[] | null
          prabhav: string[] | null
          preview: string | null
          rasa: string[] | null
          tridosha: boolean | null
          vipaka: string | null
          virya: string | null
        }
        Insert: {
          aggravate?: string[] | null
          created_at?: string
          guna?: string[] | null
          id?: string
          link?: string | null
          name: string
          pacify?: string[] | null
          prabhav?: string[] | null
          preview?: string | null
          rasa?: string[] | null
          tridosha?: boolean | null
          vipaka?: string | null
          virya?: string | null
        }
        Update: {
          aggravate?: string[] | null
          created_at?: string
          guna?: string[] | null
          id?: string
          link?: string | null
          name?: string
          pacify?: string[] | null
          prabhav?: string[] | null
          preview?: string | null
          rasa?: string[] | null
          tridosha?: boolean | null
          vipaka?: string | null
          virya?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
