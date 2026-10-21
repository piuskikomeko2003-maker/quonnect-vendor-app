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
          customer_name: string | null;
          customer_phone: string | null;
          subtotal: number;
          discount: number;
          total: number;
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
          customer_name?: string | null;
          customer_phone?: string | null;
          subtotal?: number;
          discount?: number;
          total: number;
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
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
