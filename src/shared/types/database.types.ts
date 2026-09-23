export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      category: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
        ]
      }
      equivalence_group: {
        Row: {
          created_at: string
          id: string
          label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
        }
        Relationships: []
      }
      equivalence_member: {
        Row: {
          confidence: string
          created_at: string
          group_id: string
          store_product_id: string
        }
        Insert: {
          confidence: string
          created_at?: string
          group_id: string
          store_product_id: string
        }
        Update: {
          confidence?: string
          created_at?: string
          group_id?: string
          store_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equivalence_member_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "equivalence_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equivalence_member_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equivalence_member_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "store_product"
            referencedColumns: ["id"]
          },
        ]
      }
      list_item: {
        Row: {
          created_at: string
          id: string
          is_checked: boolean
          list_id: string
          note: string | null
          position: number
          price_cop_at_add: number
          quantity: number
          store_product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_checked?: boolean
          list_id: string
          note?: string | null
          position?: number
          price_cop_at_add: number
          quantity?: number
          store_product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_checked?: boolean
          list_id?: string
          note?: string | null
          position?: number
          price_cop_at_add?: number
          quantity?: number
          store_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_item_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_item_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_item_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "store_product"
            referencedColumns: ["id"]
          },
        ]
      }
      list_reminder: {
        Row: {
          anchor_date: string | null
          created_at: string
          day_of_month: number | null
          frequency: string
          id: string
          is_enabled: boolean
          list_id: string
          owner_id: string
          time_local: string
          weekday: number | null
        }
        Insert: {
          anchor_date?: string | null
          created_at?: string
          day_of_month?: number | null
          frequency: string
          id?: string
          is_enabled?: boolean
          list_id: string
          owner_id: string
          time_local: string
          weekday?: number | null
        }
        Update: {
          anchor_date?: string | null
          created_at?: string
          day_of_month?: number | null
          frequency?: string
          id?: string
          is_enabled?: boolean
          list_id?: string
          owner_id?: string
          time_local?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "list_reminder_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["id"]
          },
        ]
      }
      price_snapshot: {
        Row: {
          captured_at: string
          id: number
          list_price_cop: number | null
          price_cop: number
          region_code: string
          store_product_id: string
        }
        Insert: {
          captured_at?: string
          id?: never
          list_price_cop?: number | null
          price_cop: number
          region_code: string
          store_product_id: string
        }
        Update: {
          captured_at?: string
          id?: never
          list_price_cop?: number | null
          price_cop?: number
          region_code?: string
          store_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshot_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "region"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_snapshot_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_snapshot_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "store_product"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          region_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          region_code?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          region_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "region"
            referencedColumns: ["code"]
          },
        ]
      }
      region: {
        Row: {
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      shopping_list: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          name: string
          notes: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          notes?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_path: string | null
          name: string
          slug: string
          source_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name: string
          slug: string
          source_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name?: string
          slug?: string
          source_type?: string
        }
        Relationships: []
      }
      store_product: {
        Row: {
          brand: string | null
          category_id: string | null
          ean: string | null
          external_id: string
          first_seen_at: string
          id: string
          image_url: string | null
          is_available: boolean
          last_seen_at: string
          name: string
          search_vector: unknown
          store_id: string
          unit_kind: string
          unit_measure: string | null
          unit_value: number | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          ean?: string | null
          external_id: string
          first_seen_at?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          last_seen_at?: string
          name: string
          search_vector?: unknown
          store_id: string
          unit_kind?: string
          unit_measure?: string | null
          unit_value?: number | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          ean?: string | null
          external_id?: string
          first_seen_at?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          last_seen_at?: string
          name?: string
          search_vector?: unknown
          store_id?: string
          unit_kind?: string
          unit_measure?: string | null
          unit_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_summary"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      catalog_product: {
        Row: {
          brand: string | null
          category_id: string | null
          category_slug: string | null
          ean: string | null
          id: string | null
          image_url: string | null
          is_available: boolean | null
          last_seen_at: string | null
          name: string | null
          price_cop: number | null
          search_vector: unknown
          store_id: string | null
          store_name: string | null
          store_slug: string | null
          unit_kind: string | null
          unit_measure: string | null
          unit_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      current_price: {
        Row: {
          captured_at: string | null
          list_price_cop: number | null
          price_cop: number | null
          region_code: string | null
          store_product_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshot_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "region"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_snapshot_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_snapshot_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "store_product"
            referencedColumns: ["id"]
          },
        ]
      }
      list_totals: {
        Row: {
          item_count: number | null
          list_id: string | null
          store_id: string | null
          store_name: string | null
          store_slug: string | null
          subtotal_at_add_cop: number | null
          subtotal_cop: number | null
        }
        Relationships: [
          {
            foreignKeyName: "list_item_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      store_summary: {
        Row: {
          id: string | null
          is_active: boolean | null
          last_updated_at: string | null
          logo_path: string | null
          name: string | null
          product_count: number | null
          slug: string | null
          source_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_region: { Args: never; Returns: string }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      price_for: {
        Args: { p_region_code: string; p_store_product_id: string }
        Returns: number
      }
      refresh_current_price: { Args: never; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

