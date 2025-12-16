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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_prompts: {
        Row: {
          analysis_type: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          system_prompt: string
          updated_at: string | null
          updated_by: string | null
          user_prompt_template: string
          variables_hint: Json | null
          version: number | null
        }
        Insert: {
          analysis_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          system_prompt: string
          updated_at?: string | null
          updated_by?: string | null
          user_prompt_template: string
          variables_hint?: Json | null
          version?: number | null
        }
        Update: {
          analysis_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          system_prompt?: string
          updated_at?: string | null
          updated_by?: string | null
          user_prompt_template?: string
          variables_hint?: Json | null
          version?: number | null
        }
        Relationships: []
      }
      analysis_queue: {
        Row: {
          analysis_type: string
          completed_at: string | null
          created_at: string | null
          depth_level: string
          error_message: string | null
          id: string
          project_id: string
          retry_count: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          analysis_type: string
          completed_at?: string | null
          created_at?: string | null
          depth_level?: string
          error_message?: string | null
          id?: string
          project_id: string
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          analysis_type?: string
          completed_at?: string | null
          created_at?: string | null
          depth_level?: string
          error_message?: string | null
          id?: string
          project_id?: string
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_usage: {
        Row: {
          analysis_type: string
          cost_estimated: number | null
          created_at: string | null
          depth_level: string | null
          id: string
          is_legacy_cost: boolean | null
          model_used: string | null
          project_id: string | null
          tokens_estimated: number | null
          user_id: string
        }
        Insert: {
          analysis_type: string
          cost_estimated?: number | null
          created_at?: string | null
          depth_level?: string | null
          id?: string
          is_legacy_cost?: boolean | null
          model_used?: string | null
          project_id?: string | null
          tokens_estimated?: number | null
          user_id: string
        }
        Update: {
          analysis_type?: string
          cost_estimated?: number | null
          created_at?: string | null
          depth_level?: string | null
          id?: string
          is_legacy_cost?: boolean | null
          model_used?: string | null
          project_id?: string | null
          tokens_estimated?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_items: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          is_completed: boolean | null
          plan_id: string
          sort_order: number | null
          source_analysis: string | null
          title: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          plan_id: string
          sort_order?: number | null
          source_analysis?: string | null
          title: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          plan_id?: string
          sort_order?: number | null
          source_analysis?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "implementation_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_plans: {
        Row: {
          analysis_types: string[]
          created_at: string | null
          focus_type: string
          id: string
          project_id: string
          title: string
          tokens_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_types?: string[]
          created_at?: string | null
          focus_type?: string
          id?: string
          project_id: string
          title: string
          tokens_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_types?: string[]
          created_at?: string | null
          focus_type?: string
          id?: string
          project_id?: string
          title?: string
          tokens_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          config: Json | null
          created_at: string | null
          daily_analyses: number | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_tokens_monthly: number | null
          monthly_analyses: number | null
          name: string
          price_monthly: number | null
          slug: string
          stripe_price_id: string | null
          stripe_product_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          daily_analyses?: number | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_tokens_monthly?: number | null
          monthly_analyses?: number | null
          name: string
          price_monthly?: number | null
          slug: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          daily_analyses?: number | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_tokens_monthly?: number | null
          monthly_analyses?: number | null
          name?: string
          price_monthly?: number | null
          slug?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          github_access_token: string | null
          github_username: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          github_access_token?: string | null
          github_username?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          github_access_token?: string | null
          github_username?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          analysis_status: string | null
          created_at: string
          error_message: string | null
          github_data: Json | null
          github_url: string
          id: string
          is_pinned: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          analysis_status?: string | null
          created_at?: string
          error_message?: string | null
          github_data?: Json | null
          github_url: string
          id?: string
          is_pinned?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          analysis_status?: string | null
          created_at?: string
          error_message?: string | null
          github_data?: Json | null
          github_url?: string
          id?: string
          is_pinned?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          requests_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          requests_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          requests_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          blocked: boolean | null
          created_at: string | null
          email: string | null
          id: string
          ip_address: string
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          blocked?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address: string
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          blocked?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      user_checklist_items: {
        Row: {
          analysis_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          item_hash: string
          user_id: string
        }
        Insert: {
          analysis_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          item_hash: string
          user_id: string
        }
        Update: {
          analysis_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          item_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_checklist_items_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          plan_id: string | null
          started_at: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_signup_abuse: {
        Args: { p_ip_address: string; p_max_attempts?: number }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: number }
      get_dashboard_data: { Args: { p_user_id: string }; Returns: Json }
      get_user_daily_usage: { Args: { p_user_id: string }; Returns: number }
      get_user_monthly_usage: { Args: { p_user_id: string }; Returns: number }
      get_user_plan: {
        Args: { p_user_id: string }
        Returns: {
          daily_analyses: number
          monthly_analyses: number
          plan_config: Json
          plan_id: string
          plan_name: string
          plan_slug: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_signup_attempt: {
        Args: {
          p_email: string
          p_ip_address: string
          p_success: boolean
          p_user_agent?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
