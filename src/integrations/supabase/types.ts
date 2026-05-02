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
          brand_preference: string | null
          budget_priority: string
          bulk_buying: boolean | null
          child_ages: string | null
          children: number
          cooking_skill: string | null
          created_at: string
          dietary_preferences: string | null
          disliked_foods: string | null
          household_type: string
          id: string
          leftover_comfort: string | null
          meal_planning: string | null
          preferred_meal_count: number
          preferred_stores: string | null
          shopping_frequency: string | null
          updated_at: string
          user_id: string
          weekly_budget: string | null
        }
        Insert: {
          adults?: number
          brand_preference?: string | null
          budget_priority?: string
          bulk_buying?: boolean | null
          child_ages?: string | null
          children?: number
          cooking_skill?: string | null
          created_at?: string
          dietary_preferences?: string | null
          disliked_foods?: string | null
          household_type?: string
          id?: string
          leftover_comfort?: string | null
          meal_planning?: string | null
          preferred_meal_count?: number
          preferred_stores?: string | null
          shopping_frequency?: string | null
          updated_at?: string
          user_id: string
          weekly_budget?: string | null
        }
        Update: {
          adults?: number
          brand_preference?: string | null
          budget_priority?: string
          bulk_buying?: boolean | null
          child_ages?: string | null
          children?: number
          cooking_skill?: string | null
          created_at?: string
          dietary_preferences?: string | null
          disliked_foods?: string | null
          household_type?: string
          id?: string
          leftover_comfort?: string | null
          meal_planning?: string | null
          preferred_meal_count?: number
          preferred_stores?: string | null
          shopping_frequency?: string | null
          updated_at?: string
          user_id?: string
          weekly_budget?: string | null
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
      pantry_items: {
        Row: {
          category: string | null
          created_at: string
          estimated_expiry_date: string | null
          id: string
          ingredient_keyword: string | null
          name: string
          quantity: number
          source_receipt_item_id: string | null
          status: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          estimated_expiry_date?: string | null
          id?: string
          ingredient_keyword?: string | null
          name: string
          quantity?: number
          source_receipt_item_id?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          estimated_expiry_date?: string | null
          id?: string
          ingredient_keyword?: string | null
          name?: string
          quantity?: number
          source_receipt_item_id?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_aliases: {
        Row: {
          category: string | null
          cleaned_name: string
          created_at: string
          id: string
          ingredient_keyword: string | null
          raw_text: string
          store_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cleaned_name: string
          created_at?: string
          id?: string
          ingredient_keyword?: string | null
          raw_text: string
          store_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          cleaned_name?: string
          created_at?: string
          id?: string
          ingredient_keyword?: string | null
          raw_text?: string
          store_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          confidence: number | null
          created_at: string
          id: string
          ingredient_keyword: string | null
          is_discount: boolean | null
          is_food: boolean | null
          price: number | null
          quantity: number
          raw_name: string | null
          receipt_id: string
          unit: string | null
        }
        Insert: {
          category?: string | null
          clean_name?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          ingredient_keyword?: string | null
          is_discount?: boolean | null
          is_food?: boolean | null
          price?: number | null
          quantity?: number
          raw_name?: string | null
          receipt_id: string
          unit?: string | null
        }
        Update: {
          category?: string | null
          clean_name?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          ingredient_keyword?: string | null
          is_discount?: boolean | null
          is_food?: boolean | null
          price?: number | null
          quantity?: number
          raw_name?: string | null
          receipt_id?: string
          unit?: string | null
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
          detected_abn: string | null
          extraction_method: string | null
          health_score: number | null
          id: string
          image_paths: string[] | null
          image_url: string | null
          meal_potential_score: number | null
          original_image_paths: string[] | null
          original_image_url: string | null
          overall_confidence: number | null
          raw_extraction_json: Json | null
          raw_ocr_text: string | null
          receipt_time: string | null
          shop_date: string | null
          status: string
          store_confidence: number | null
          store_name: string | null
          store_review_required: boolean | null
          subtotal: number | null
          total_amount: number | null
          total_discounts: number | null
          updated_at: string
          user_id: string
          value_score: number | null
          waste_risk_score: number | null
        }
        Insert: {
          created_at?: string
          detected_abn?: string | null
          extraction_method?: string | null
          health_score?: number | null
          id?: string
          image_paths?: string[] | null
          image_url?: string | null
          meal_potential_score?: number | null
          original_image_paths?: string[] | null
          original_image_url?: string | null
          overall_confidence?: number | null
          raw_extraction_json?: Json | null
          raw_ocr_text?: string | null
          receipt_time?: string | null
          shop_date?: string | null
          status?: string
          store_confidence?: number | null
          store_name?: string | null
          store_review_required?: boolean | null
          subtotal?: number | null
          total_amount?: number | null
          total_discounts?: number | null
          updated_at?: string
          user_id: string
          value_score?: number | null
          waste_risk_score?: number | null
        }
        Update: {
          created_at?: string
          detected_abn?: string | null
          extraction_method?: string | null
          health_score?: number | null
          id?: string
          image_paths?: string[] | null
          image_url?: string | null
          meal_potential_score?: number | null
          original_image_paths?: string[] | null
          original_image_url?: string | null
          overall_confidence?: number | null
          raw_extraction_json?: Json | null
          raw_ocr_text?: string | null
          receipt_time?: string | null
          shop_date?: string | null
          status?: string
          store_confidence?: number | null
          store_name?: string | null
          store_review_required?: boolean | null
          subtotal?: number | null
          total_amount?: number | null
          total_discounts?: number | null
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
      scan_errors: {
        Row: {
          created_at: string
          error_message: string | null
          error_type: string
          id: string
          raw_response: string | null
          receipt_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          error_type: string
          id?: string
          raw_response?: string | null
          receipt_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          error_type?: string
          id?: string
          raw_response?: string | null
          receipt_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          id: string
          scans_this_week: number
          tier: string
          updated_at: string
          user_id: string
          week_reset_at: string
          weekly_scan_limit: number
        }
        Insert: {
          created_at?: string
          id?: string
          scans_this_week?: number
          tier?: string
          updated_at?: string
          user_id: string
          week_reset_at?: string
          weekly_scan_limit?: number
        }
        Update: {
          created_at?: string
          id?: string
          scans_this_week?: number
          tier?: string
          updated_at?: string
          user_id?: string
          week_reset_at?: string
          weekly_scan_limit?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_scan: { Args: never; Returns: Json }
      get_subscription_info: { Args: never; Returns: Json }
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
