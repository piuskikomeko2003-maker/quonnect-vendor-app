export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Application database contract for the rebuilt Quonnect Vendor app.
 *
 * This mirrors supabase/migrations/20261021_01_ui_rebuild.sql. Once the
 * schema is reachable, replace this file with
 * `supabase gen types typescript --linked > src/types/database.types.ts`.
 */
export type Database = {
  public: {
    Tables: {
      vendors: {
        Row: {
          id: string;
          user_id: string;
          owner_name: string | null;
          business_name: string;
          category: string | null;
          region: string | null;
          phone: string | null;
          phone2: string | null;
          email: string | null;
          motto: string | null;
          logo_url: string | null;
          instagram: string | null;
          facebook: string | null;
          tiktok: string | null;
          whatsapp: string | null;
          features_enabled: Json;
          month_start_day: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          owner_name?: string | null;
          business_name: string;
          category?: string | null;
          region?: string | null;
          phone?: string | null;
          phone2?: string | null;
          email?: string | null;
          motto?: string | null;
          logo_url?: string | null;
          instagram?: string | null;
          facebook?: string | null;
          tiktok?: string | null;
          whatsapp?: string | null;
          features_enabled?: Json;
          month_start_day?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vendors"]["Insert"]>;
        Relationships: [];
      };
      stalls: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          tagline: string;
          accent_color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          tagline?: string;
          accent_color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stalls"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          description: string | null;
          category: string | null;
          sizes: string[] | null;
          colors: string[] | null;
          cost: number;
          price: number;
          stock: number;
          discount_pct: number;
          is_active: boolean;
          photo_url: string | null;
          photo_urls: string[];
          min_stock_alert: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          description?: string | null;
          category?: string | null;
          sizes?: string[] | null;
          colors?: string[] | null;
          cost?: number;
          price: number;
          stock?: number;
          discount_pct?: number;
          is_active?: boolean;
          photo_url?: string | null;
          photo_urls?: string[];
          min_stock_alert?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          vendor_id: string;
          order_no: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          subtotal: number;
          discount: number;
          total: number;
          paid_amount: number;
          due_amount: number;
          profit: number;
          price_reduction: number;
          payment_method: string;
          status: string;
          sale_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          order_no: string;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          subtotal?: number;
          discount?: number;
          total: number;
          paid_amount?: number;
          due_amount?: number;
          profit?: number;
          price_reduction?: number;
          payment_method?: string;
          status?: string;
          sale_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sales"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          total_orders: number;
          total_spent: number;
          due_amount: number;
          is_sample: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          total_orders?: number;
          total_spent?: number;
          due_amount?: number;
          is_sample?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          vendor_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          unit_cost: number;
          listed_price: number;
          sold_price: number;
          total: number;
          profit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          vendor_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          unit_cost?: number;
          listed_price?: number;
          sold_price?: number;
          total: number;
          profit?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sale_items"]["Insert"]>;
        Relationships: [];
      };
      finance_entries: {
        Row: {
          id: string;
          vendor_id: string;
          type: "income" | "expense";
          category: string;
          amount: number;
          source: string;
          entry_date: string;
          notes: string | null;
          frequency: "daily" | "monthly";
          account_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          type: "income" | "expense";
          category: string;
          amount: number;
          source?: string;
          entry_date?: string;
          notes?: string | null;
          frequency?: "daily" | "monthly";
          account_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["finance_entries"]["Insert"]>;
        Relationships: [];
      };
      finance_categories: {
        Row: {
          id: string;
          vendor_id: string;
          type: "income" | "expense";
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          type: "income" | "expense";
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["finance_categories"]["Insert"]>;
        Relationships: [];
      };
      product_categories: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_categories"]["Insert"]>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          vendor_id: string;
          category: string;
          monthly_limit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          category: string;
          monthly_limit: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          vendor_id: string;
          product_id: string;
          delta: number;
          reason: "sale" | "restock" | "adjustment";
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          product_id: string;
          delta: number;
          reason: "sale" | "restock" | "adjustment";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Insert"]>;
        Relationships: [];
      };
      financial_accounts: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          kind: string;
          opening_balance: number;
          description: string | null;
          color: string | null;
          icon: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          kind?: string;
          opening_balance?: number;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["financial_accounts"]["Insert"]>;
        Relationships: [];
      };
      account_transactions: {
        Row: {
          id: string;
          vendor_id: string;
          account_id: string;
          amount: number;
          kind: string;
          source_type: string | null;
          source_id: string | null;
          occurred_on: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          account_id: string;
          amount: number;
          kind: string;
          source_type?: string | null;
          source_id?: string | null;
          occurred_on?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_transactions"]["Insert"]>;
        Relationships: [];
      };
      settlement_payments: {
        Row: {
          id: string;
          vendor_id: string;
          settlement_type: "customer_collection" | "supplier_payment";
          customer_id: string | null;
          customer_name: string | null;
          supplier_name: string | null;
          account_id: string;
          payment_method: string | null;
          amount: number;
          reference: string | null;
          paid_on: string;
          idempotency_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          settlement_type: "customer_collection" | "supplier_payment";
          customer_id?: string | null;
          customer_name?: string | null;
          supplier_name?: string | null;
          account_id: string;
          payment_method?: string | null;
          amount: number;
          reference?: string | null;
          paid_on?: string;
          idempotency_key: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settlement_payments"]["Insert"]>;
        Relationships: [];
      };
      settlement_allocations: {
        Row: {
          id: string;
          vendor_id: string;
          payment_id: string;
          sale_id: string | null;
          purchase_id: string | null;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          payment_id: string;
          sale_id?: string | null;
          purchase_id?: string | null;
          amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settlement_allocations"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_sale: {
        Args: {
          p_vendor_id: string;
          p_items: Json;
          p_payment_method?: string;
          p_customer_name?: string | null;
          p_customer_phone?: string | null;
        };
        Returns: Json;
      };
      restock_product: {
        Args: {
          p_vendor_id: string;
          p_product_id: string;
          p_qty: number;
          p_new_cost?: number | null;
          p_create_expense?: boolean;
        };
        Returns: Json;
      };
      vendor_home_overview: {
        Args: { p_vendor_id: string; p_month?: string | null };
        Returns: Json;
      };
      vendor_daily_series: {
        Args: { p_vendor_id: string; p_from: string; p_to: string };
        Returns: Json;
      };
      vendor_recent_transactions: {
        Args: { p_vendor_id: string; p_limit?: number };
        Returns: Json;
      };
      vendor_monthly_series: {
        Args: { p_vendor_id: string; p_months?: number };
        Returns: Json;
      };
      vendor_expense_categories: {
        Args: { p_vendor_id: string; p_from: string };
        Returns: Json;
      };
      vendor_item_stats: {
        Args: { p_vendor_id: string };
        Returns: Json;
      };
      vendor_dashboard: {
        Args: { p_vendor_id: string; p_from: string; p_to: string };
        Returns: Json;
      };
      create_financial_account: {
        Args: {
          p_vendor_id: string;
          p_name: string;
          p_kind?: string;
          p_opening_balance?: number;
          p_description?: string | null;
          p_color?: string | null;
          p_icon?: string | null;
        };
        Returns: Json;
      };
      update_financial_account: {
        Args: {
          p_vendor_id: string;
          p_account_id: string;
          p_name: string;
          p_kind?: string;
          p_description?: string | null;
          p_color?: string | null;
          p_icon?: string | null;
        };
        Returns: Json;
      };
      set_financial_account_active: {
        Args: { p_vendor_id: string; p_account_id: string; p_active: boolean };
        Returns: Json;
      };
      transfer_between_accounts: {
        Args: {
          p_vendor_id: string;
          p_from_account_id: string;
          p_to_account_id: string;
          p_amount: number;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      vendor_accounts_overview: {
        Args: { p_vendor_id: string; p_transaction_limit?: number };
        Returns: Json;
      };
      record_stock_purchase: {
        Args: {
          p_vendor_id: string;
          p_items: Json;
          p_account_id?: string | null;
          p_amount_paid?: number;
          p_supplier_name?: string | null;
          p_purchase_date?: string | null;
          p_notes?: string | null;
          p_idempotency_key?: string | null;
        };
        Returns: Json;
      };
      vendor_purchases_overview: {
        Args: { p_vendor_id: string; p_limit?: number };
        Returns: Json;
      };
      reverse_stock_purchase: {
        Args: { p_vendor_id: string; p_purchase_id: string };
        Returns: Json;
      };
      reverse_sale: {
        Args: { p_vendor_id: string; p_sale_id: string };
        Returns: Json;
      };
      record_customer_payment: {
        Args: {
          p_vendor_id: string;
          p_customer_id?: string | null;
          p_customer_name?: string | null;
          p_allocations: Json;
          p_payment_method?: string | null;
          p_account_id?: string | null;
          p_reference?: string | null;
          p_paid_on?: string | null;
          p_idempotency_key?: string | null;
        };
        Returns: Json;
      };
      record_supplier_payment: {
        Args: {
          p_vendor_id: string;
          p_supplier_name: string;
          p_allocations: Json;
          p_account_id?: string | null;
          p_reference?: string | null;
          p_paid_on?: string | null;
          p_idempotency_key?: string | null;
        };
        Returns: Json;
      };
      vendor_settlements_overview: {
        Args: { p_vendor_id: string; p_history_limit?: number };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
