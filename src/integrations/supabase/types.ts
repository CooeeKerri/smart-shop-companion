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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      households: {
        Row: {
          adults: number
          budget_priority: string
          child_ages: string | null
          children: number
          created_at: string
          dietary_preferences: string | null
          disliked_foods: string | null
          household_type: string
          id: string
          preferred_meal_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          adults?: number
          budget_priority?: string
          child_ages?: string | null
          children?: number
          created_at?: string
          dietary_preferences?: string | null
          disliked_foods?: string | null
          household_type?: string
          id?: string
          preferred_meal_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          adults?: number
          budget_priority?: string
          child_ages?: string | null
          children?: number
          created_at?: string
          dietary_preferences?: string | null
          disliked_foods?: string | null
          household_type?: string
          id?: string
          preferred_meal_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_suggestions: {
        Row: {
          category: string
          created_at: string
          id: string
          ingredients: Json | null
          pantry_staples: Json | null
          reason: string | null
          receipt_id: string
          serves: number | null
          title: string
          use_first: boolean | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          ingredients?: Json | null
          pantry_staples?: Json | null
          reason?: string | null
          receipt_id: string
          serves?: number | null
          title: string
          use_first?: boolean | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          ingredients?: Json | null
          pantry_staples?: Json | null
          reason?: string | null
          receipt_id?: string
          serves?: number | null
          title?: string
          use_first?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_suggestions_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          category: string | null
          clean_name: string | null
          created_at: string
          id: string
          is_discount: boolean | null
          is_food: boolean | null
          price: number | null
          quantity: number
          raw_name: string | null
          receipt_id: string
        }
        Insert: {
          category?: string | null
          clean_name?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean | null
          is_food?: boolean | null
          price?: number | null
          quantity?: number
          raw_name?: string | null
          receipt_id: string
        }
        Update: {
          category?: string | null
          clean_name?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean | null
          is_food?: boolean | null
          price?: number | null
          quantity?: number
          raw_name?: string | null
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          health_score: number | null
          id: string
          image_url: string | null
          meal_potential_score: number | null
          raw_ocr_text: string | null
          shop_date: string | null
          status: string
          store_name: string | null
          total_amount: number | null
          updated_at: string
          user_id: string
          value_score: number | null
          waste_risk_score: number | null
        }
        Insert: {
          created_at?: string
          health_score?: number | null
          id?: string
          image_url?: string | null
          meal_potential_score?: number | null
          raw_ocr_text?: string | null
          shop_date?: string | null
          status?: string
          store_name?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
          value_score?: number | null
          waste_risk_score?: number | null
        }
        Update: {
          created_at?: string
          health_score?: number | null
          id?: string
          image_url?: string | null
          meal_potential_score?: number | null
          raw_ocr_text?: string | null
          shop_date?: string | null
          status?: string
          store_name?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          value_score?: number | null
          waste_risk_score?: number | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          current_item: string
          id: string
          potential_saving: number | null
          reason: string | null
          receipt_id: string
          suggested_item: string
          type: string
        }
        Insert: {
          created_at?: string
          current_item: string
          id?: string
          potential_saving?: number | null
          reason?: string | null
          receipt_id: string
          suggested_item: string
          type: string
        }
        Update: {
          created_at?: string
          current_item?: string
          id?: string
          potential_saving?: number | null
          reason?: string | null
          receipt_id?: string
          suggested_item?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
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
