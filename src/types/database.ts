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
          memo: string | null
          name: string
          opening_balance: number
          transfer_priority: number
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
          memo?: string | null
          name: string
          opening_balance?: number
          transfer_priority?: number
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
          memo?: string | null
          name?: string
          opening_balance?: number
          transfer_priority?: number
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
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          last_total_tokens: number
          pinned: boolean
          title: string
          title_generated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_total_tokens?: number
          pinned?: boolean
          title: string
          title_generated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_total_tokens?: number
          pinned?: boolean
          title?: string
          title_generated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: number
          role: string
          sent: string
          shown: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: never
          role: string
          sent: string
          shown: string
          user_id?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: never
          role?: string
          sent?: string
          shown?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_user_id_conversation_id_fkey"
            columns: ["user_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          gemini_api_key: string | null
          model: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          gemini_api_key?: string | null
          model?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          gemini_api_key?: string | null
          model?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          id: number
          model: string
          output_tokens: number
          prompt_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          model: string
          output_tokens?: number
          prompt_tokens?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          model?: string
          output_tokens?: number
          prompt_tokens?: number
          user_id?: string
        }
        Relationships: []
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
      email_import_settings: {
        Row: {
          last_seen_at: string | null
          started_at: string | null
          summary_rules: string | null
          token_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string | null
          started_at?: string | null
          summary_rules?: string | null
          token_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          last_seen_at?: string | null
          started_at?: string | null
          summary_rules?: string | null
          token_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_import_sources: {
        Row: {
          account_id: string | null
          enabled: boolean
          source: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          enabled?: boolean
          source: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          enabled?: boolean
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_import_sources_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_import_sources_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_imports: {
        Row: {
          account_id: string | null
          amount: number | null
          category_id: string | null
          created_at: string
          date: string | null
          duplicate_of: string | null
          id: string
          item_index: number
          kind: string | null
          message_id: string
          notified: boolean
          payee: string | null
          raw_payee: string | null
          received_at: string | null
          status: string
          subject: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          category_id?: string | null
          created_at?: string
          date?: string | null
          duplicate_of?: string | null
          id?: string
          item_index?: number
          kind?: string | null
          message_id: string
          notified?: boolean
          payee?: string | null
          raw_payee?: string | null
          received_at?: string | null
          status: string
          subject?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          category_id?: string | null
          created_at?: string
          date?: string | null
          duplicate_of?: string | null
          id?: string
          item_index?: number
          kind?: string | null
          message_id?: string
          notified?: boolean
          payee?: string | null
          raw_payee?: string | null
          received_at?: string | null
          status?: string
          subject?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_imports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_imports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_imports_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
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
          salary_account_id: string | null
          salary_amount: number | null
          salary_generated_until: string | null
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
          salary_account_id?: string | null
          salary_amount?: number | null
          salary_generated_until?: string | null
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
          salary_account_id?: string | null
          salary_amount?: number | null
          salary_generated_until?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employers_salary_account_fk"
            columns: ["user_id", "salary_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      payee_rules: {
        Row: {
          category_id: string | null
          kind: Database["public"]["Enums"]["category_kind"]
          learned_from: string
          payee: string | null
          raw_payee: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          kind?: Database["public"]["Enums"]["category_kind"]
          learned_from?: string
          payee?: string | null
          raw_payee: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          category_id?: string | null
          kind?: Database["public"]["Enums"]["category_kind"]
          learned_from?: string
          payee?: string | null
          raw_payee?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payee_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
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
          auto_reviewed: boolean
          auto_salary: boolean
          auto_source: string | null
          category_id: string | null
          created_at: string
          date: string
          employer_id: string | null
          from_account_id: string | null
          id: string
          is_confirmed: boolean
          list_price: number | null
          memo: string | null
          needs_payee: boolean
          payee: string | null
          points_used: number | null
          raw_payee: string | null
          recurring_rule_id: string | null
          related_transaction_id: string | null
          to_account_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          auto_reviewed?: boolean
          auto_salary?: boolean
          auto_source?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          employer_id?: string | null
          from_account_id?: string | null
          id?: string
          is_confirmed?: boolean
          list_price?: number | null
          memo?: string | null
          needs_payee?: boolean
          payee?: string | null
          points_used?: number | null
          raw_payee?: string | null
          recurring_rule_id?: string | null
          related_transaction_id?: string | null
          to_account_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          auto_reviewed?: boolean
          auto_salary?: boolean
          auto_source?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          employer_id?: string | null
          from_account_id?: string | null
          id?: string
          is_confirmed?: boolean
          list_price?: number | null
          memo?: string | null
          needs_payee?: boolean
          payee?: string | null
          points_used?: number | null
          raw_payee?: string | null
          recurring_rule_id?: string | null
          related_transaction_id?: string | null
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_employer_fk"
            columns: ["user_id", "employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_recurring_rule_fk"
            columns: ["user_id", "recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_related_fk"
            columns: ["user_id", "related_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
      user_settings: {
        Row: {
          monthly_living_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          monthly_living_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          monthly_living_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          transfer_priority: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_usage: { Args: { target: string }; Returns: Json }
      category_usage: { Args: { target: string }; Returns: Json }
      delete_unused_account: { Args: { target: string }; Returns: undefined }
      delete_unused_category: { Args: { target: string }; Returns: undefined }
      move_category_records: {
        Args: { destination: string; source: string }
        Returns: number
      }
      rotate_email_import_token: { Args: never; Returns: string }
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
