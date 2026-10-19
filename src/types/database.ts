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
    PostgrestVersion: "14.18"
  }
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
      accounts: {
        Row: {
          created_at: string
          default_category_id: string | null
          id: string
          include_in_available: boolean
          is_archived: boolean
          is_reserved: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening_balance: number
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          default_category_id?: string | null
          id?: string
          include_in_available?: boolean
          is_archived?: boolean
          is_reserved?: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening_balance?: number
          sort_order?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          default_category_id?: string | null
          id?: string
          include_in_available?: boolean
          is_archived?: boolean
          is_reserved?: boolean
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          opening_balance?: number
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_default_category_fk"
            columns: ["user_id", "default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          parent_id: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          parent_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          parent_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_parent_id_fkey"
            columns: ["user_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      credit_card_settings: {
        Row: {
          account_id: string
          closing_day: number
          payment_account_id: string
          payment_day: number
          payment_month_offset: number
          user_id: string
        }
        Insert: {
          account_id: string
          closing_day: number
          payment_account_id: string
          payment_day: number
          payment_month_offset?: number
          user_id?: string
        }
        Update: {
          account_id?: string
          closing_day?: number
          payment_account_id?: string
          payment_day?: number
          payment_month_offset?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_settings_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "credit_card_settings_user_id_payment_account_id_fkey"
            columns: ["user_id", "payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      employers: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          name: string
          payday: number
          payday_shift: Database["public"]["Enums"]["payday_shift"]
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          payday: number
          payday_shift?: Database["public"]["Enums"]["payday_shift"]
          sort_order?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          payday?: number
          payday_shift?: Database["public"]["Enums"]["payday_shift"]
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      recurring_rules: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          day_of_month: number
          from_account_id: string | null
          generated_until: string | null
          holiday_shift: Database["public"]["Enums"]["recurring_shift"]
          id: string
          interval_months: number
          is_active: boolean
          name: string
          sort_order: number
          start_date: string
          to_account_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          day_of_month: number
          from_account_id?: string | null
          generated_until?: string | null
          holiday_shift?: Database["public"]["Enums"]["recurring_shift"]
          id?: string
          interval_months?: number
          is_active?: boolean
          name: string
          sort_order?: number
          start_date: string
          to_account_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          from_account_id?: string | null
          generated_until?: string | null
          holiday_shift?: Database["public"]["Enums"]["recurring_shift"]
          id?: string
          interval_months?: number
          is_active?: boolean
          name?: string
          sort_order?: number
          start_date?: string
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_user_id_category_id_fkey"
            columns: ["user_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "recurring_rules_user_id_from_account_id_fkey"
            columns: ["user_id", "from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "recurring_rules_user_id_to_account_id_fkey"
            columns: ["user_id", "to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          date: string
          from_account_id: string | null
          id: string
          is_confirmed: boolean
          list_price: number | null
          memo: string | null
          payee: string | null
          points_used: number | null
          recurring_rule_id: string | null
          to_account_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          from_account_id?: string | null
          id?: string
          is_confirmed?: boolean
          list_price?: number | null
          memo?: string | null
          payee?: string | null
          points_used?: number | null
          recurring_rule_id?: string | null
          to_account_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          from_account_id?: string | null
          id?: string
          is_confirmed?: boolean
          list_price?: number | null
          memo?: string | null
          payee?: string | null
          points_used?: number | null
          recurring_rule_id?: string | null
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_recurring_rule_fk"
            columns: ["user_id", "recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_user_id_category_id_fkey"
            columns: ["user_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_user_id_from_account_id_fkey"
            columns: ["user_id", "from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_user_id_to_account_id_fkey"
            columns: ["user_id", "to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          balance: number | null
          id: string | null
          include_in_available: boolean | null
          is_archived: boolean | null
          is_reserved: boolean | null
          kind: Database["public"]["Enums"]["account_kind"] | null
          name: string | null
          sort_order: number | null
        }
        Relationships: []
      }
      category_monthly_expense: {
        Row: {
          amount: number | null
          category_id: string | null
          month: string | null
        }
        Relationships: []
      }
      monthly_summary: {
        Row: {
          expense: number | null
          income: number | null
          month: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_kind:
        | "cash"
        | "bank"
        | "emoney"
        | "investment"
        | "credit_card"
        | "payable"
        | "receivable"
      category_kind: "expense" | "income"
      payday_shift: "before" | "after"
      recurring_shift: "none" | "before" | "after"
      txn_type:
        | "expense"
        | "income"
        | "transfer"
        | "advance"
        | "lend"
        | "collect"
        | "borrow"
        | "repay"
        | "adjustment"
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
    Enums: {
      account_kind: [
        "cash",
        "bank",
        "emoney",
        "investment",
        "credit_card",
        "payable",
        "receivable",
      ],
      category_kind: ["expense", "income"],
      payday_shift: ["before", "after"],
      recurring_shift: ["none", "before", "after"],
      txn_type: [
        "expense",
        "income",
        "transfer",
        "advance",
        "lend",
        "collect",
        "borrow",
        "repay",
        "adjustment",
      ],
    },
  },
} as const
