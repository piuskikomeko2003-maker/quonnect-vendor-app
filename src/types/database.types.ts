export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type FeatureKey =
  | 'expense'
  | 'income'
  | 'suppliers'
  | 'purchases'
  | 'damaged_items'
  | 'activity_log'
  | 'quotations'
  | 'deep_analytics'
  | 'representatives'
  | 'multi_store'
  | 'stock_transfer';

export type FeaturesEnabled = Partial<Record<FeatureKey, boolean>>;

export interface ProductColor {
  name: string;
  hex: string;
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      vendors: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          category: string | null;
          region: string | null;
          phone: string | null;
          features_enabled?: FeaturesEnabled;
          currency?: string;
          logo_url?: string | null;
          signature_url?: string | null;
          address?: string | null;
          email?: string | null;
          owner_name?: string | null;
          created_at: string;
          updated_at: string;
          deleted_at?: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_name: string;
          category?: string | null;
          region?: string | null;
          phone?: string | null;
          features_enabled?: FeaturesEnabled;
          currency?: string;
          logo_url?: string | null;
          signature_url?: string | null;
          address?: string | null;
          email?: string | null;
          owner_name?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          business_name?: string;
          category?: string | null;
          region?: string | null;
          phone?: string | null;
          features_enabled?: FeaturesEnabled;
          currency?: string;
          logo_url?: string | null;
          signature_url?: string | null;
          address?: string | null;
          email?: string | null;
          owner_name?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          description: string | null;
          price: number;
          cost?: number;
          photo_url: string | null;
          stock: number | null;
          is_service?: boolean;
          min_stock_alert?: number;
          sku?: string | null;
          barcode?: string | null;
          expiry_date?: string | null;
          category?: string | null;
          quantity_unit?: string;
          is_sample?: boolean;
          colors?: ProductColor[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at?: string | null;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          description?: string | null;
          price: number;
          cost?: number;
          photo_url?: string | null;
          stock?: number | null;
          is_service?: boolean;
          min_stock_alert?: number;
          sku?: string | null;
          barcode?: string | null;
          expiry_date?: string | null;
          category?: string | null;
          quantity_unit?: string;
          is_sample?: boolean;
          colors?: ProductColor[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          cost?: number;
          photo_url?: string | null;
          stock?: number | null;
          is_service?: boolean;
          min_stock_alert?: number;
          sku?: string | null;
          barcode?: string | null;
          expiry_date?: string | null;
          category?: string | null;
          quantity_unit?: string;
          is_sample?: boolean;
          colors?: ProductColor[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
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
        Update: {
          id?: string;
          vendor_id?: string;
          name?: string;
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
        Relationships: [
          {
            foreignKeyName: "customers_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          id: string;
          vendor_id: string;
          order_no: string;
          customer_id: string | null;
          customer_name: string | null;
          subtotal: number;
          discount: number;
          tax: number;
          shipping: number;
          total: number;
          paid_amount: number;
          due_amount: number;
          profit: number;
          status: 'completed' | 'partial' | 'credit' | 'cancelled';
          payment_method: string;
          sold_by: string | null;
          notes: string | null;
          sale_date: string;
          is_sample: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          order_no: string;
          customer_id?: string | null;
          customer_name?: string | null;
          subtotal?: number;
          discount?: number;
          tax?: number;
          shipping?: number;
          total: number;
          paid_amount?: number;
          due_amount?: number;
          profit?: number;
          status?: 'completed' | 'partial' | 'credit' | 'cancelled';
          payment_method?: string;
          sold_by?: string | null;
          notes?: string | null;
          sale_date?: string;
          is_sample?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          order_no?: string;
          customer_id?: string | null;
          customer_name?: string | null;
          subtotal?: number;
          discount?: number;
          tax?: number;
          shipping?: number;
          total?: number;
          paid_amount?: number;
          due_amount?: number;
          profit?: number;
          status?: 'completed' | 'partial' | 'credit' | 'cancelled';
          payment_method?: string;
          sold_by?: string | null;
          notes?: string | null;
          sale_date?: string;
          is_sample?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
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
          quantity?: number;
          unit_price: number;
          unit_cost?: number;
          total: number;
          profit?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          vendor_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          unit_cost?: number;
          total?: number;
          profit?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          vendor_id: string;
          sale_id: string | null;
          customer_id: string | null;
          amount: number;
          payment_method: string;
          payment_date: string;
          notes: string | null;
          is_sample: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          sale_id?: string | null;
          customer_id?: string | null;
          amount: number;
          payment_method?: string;
          payment_date?: string;
          notes?: string | null;
          is_sample?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          sale_id?: string | null;
          customer_id?: string | null;
          amount?: number;
          payment_method?: string;
          payment_date?: string;
          notes?: string | null;
          is_sample?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      finance_entries: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          entry_date: string;
          id: string;
          notes: string | null;
          source: string;
          type: 'income' | 'expense';
          vendor_id: string;
          receipt_url?: string | null;
          is_sample?: boolean;
          deleted_at?: string | null;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          entry_date?: string;
          id?: string;
          notes?: string | null;
          source?: string;
          type: 'income' | 'expense';
          vendor_id: string;
          receipt_url?: string | null;
          is_sample?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          entry_date?: string;
          id?: string;
          notes?: string | null;
          source?: string;
          type?: 'income' | 'expense';
          vendor_id?: string;
          receipt_url?: string | null;
          is_sample?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "finance_entries_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_suggestions: {
        Row: {
          id: string;
          vendor_id: string;
          feature_key: string;
          status: 'pending' | 'dismissed' | 'enabled' | 'snoozed';
          snoozed_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          feature_key: string;
          status?: 'pending' | 'dismissed' | 'enabled' | 'snoozed';
          snoozed_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          feature_key?: string;
          status?: 'pending' | 'dismissed' | 'enabled' | 'snoozed';
          snoozed_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          vendor_id: string;
          product_id: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          service_or_product: string;
          quantity: number;
          total_price: number;
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
          booking_date: string;
          booking_time: string | null;
          delivery_location: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          product_id?: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email?: string | null;
          service_or_product: string;
          quantity?: number;
          total_price: number;
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
          booking_date?: string;
          booking_time?: string | null;
          delivery_location?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          product_id?: string | null;
          customer_name?: string;
          customer_phone?: string;
          customer_email?: string | null;
          service_or_product?: string;
          quantity?: number;
          total_price?: number;
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
          booking_date?: string;
          booking_time?: string | null;
          delivery_location?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      damaged_items: {
        Row: {
          id: string;
          vendor_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          estimated_loss: number;
          reason: string;
          loss_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          estimated_loss?: number;
          reason: string;
          loss_date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          estimated_loss?: number;
          reason?: string;
          loss_date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          name?: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          vendor_id: string;
          supplier_id: string | null;
          reference_no: string | null;
          purchase_date: string;
          total_amount: number;
          paid_amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          supplier_id?: string | null;
          reference_no?: string | null;
          purchase_date?: string;
          total_amount?: number;
          paid_amount?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          supplier_id?: string | null;
          reference_no?: string | null;
          purchase_date?: string;
          total_amount?: number;
          paid_amount?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      quotations: {
        Row: {
          id: string;
          vendor_id: string;
          quotation_no: string;
          customer_id: string | null;
          customer_name: string | null;
          quote_date: string;
          expiry_date: string | null;
          items: Json;
          subtotal: number;
          discount: number;
          tax: number;
          shipping: number;
          total: number;
          notes: string | null;
          status: string;
          converted_sale_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          quotation_no: string;
          customer_id?: string | null;
          customer_name?: string | null;
          quote_date?: string;
          expiry_date?: string | null;
          items?: Json;
          subtotal?: number;
          discount?: number;
          tax?: number;
          shipping?: number;
          total: number;
          notes?: string | null;
          status?: string;
          converted_sale_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          quotation_no?: string;
          customer_id?: string | null;
          customer_name?: string | null;
          quote_date?: string;
          expiry_date?: string | null;
          items?: Json;
          subtotal?: number;
          discount?: number;
          tax?: number;
          shipping?: number;
          total?: number;
          notes?: string | null;
          status?: string;
          converted_sale_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          vendor_id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          description: string;
          performed_by: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          description: string;
          performed_by?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          description?: string;
          performed_by?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      shop_members: {
        Row: {
          id: string;
          vendor_id: string;
          user_id: string | null;
          username: string;
          email: string | null;
          role: string;
          permissions: Json;
          commission_type: string;
          commission_rate: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          user_id?: string | null;
          username: string;
          email?: string | null;
          role?: string;
          permissions?: Json;
          commission_type?: string;
          commission_rate?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          user_id?: string | null;
          username?: string;
          email?: string | null;
          role?: string;
          permissions?: Json;
          commission_type?: string;
          commission_rate?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          location: string | null;
          phone: string | null;
          is_main: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          name: string;
          location?: string | null;
          phone?: string | null;
          is_main?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          name?: string;
          location?: string | null;
          phone?: string | null;
          is_main?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      stock_levels: {
        Row: {
          id: string;
          vendor_id: string;
          store_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          store_id: string;
          product_id: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          store_id?: string;
          product_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_transfers: {
        Row: {
          id: string;
          vendor_id: string;
          from_store_id: string;
          to_store_id: string;
          product_id: string;
          quantity: number;
          transfer_date: string;
          notes: string | null;
          transferred_by: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          from_store_id: string;
          to_store_id: string;
          product_id: string;
          quantity?: number;
          transfer_date?: string;
          notes?: string | null;
          transferred_by?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          from_store_id?: string;
          to_store_id?: string;
          product_id?: string;
          quantity?: number;
          transfer_date?: string;
          notes?: string | null;
          transferred_by?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      report_stock: {
        Args: {
          p_vendor_id: string;
          p_from?: string | null;
          p_to?: string | null;
          p_category?: string | null;
          p_exclude_zero?: boolean | null;
          p_viewer_user_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Vendor = Database['public']['Tables']['vendors']['Row'];
export type VendorInsert = Database['public']['Tables']['vendors']['Insert'];
export type VendorUpdate = Database['public']['Tables']['vendors']['Update'];

export type Product = Database['public']['Tables']['products']['Row'];
export type ProductInsert = Database['public']['Tables']['products']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products']['Update'];

export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleInsert = Database['public']['Tables']['sales']['Insert'];
export type SaleUpdate = Database['public']['Tables']['sales']['Update'];

export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type SaleItemInsert = Database['public']['Tables']['sale_items']['Insert'];

export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];

export type FinanceEntry = Database['public']['Tables']['finance_entries']['Row'];
export type FinanceEntryInsert = Database['public']['Tables']['finance_entries']['Insert'];

export type Booking = Database['public']['Tables']['bookings']['Row'];
export type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
export type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

export type ShopSuggestion = Database['public']['Tables']['shop_suggestions']['Row'];
export type DamagedItem = Database['public']['Tables']['damaged_items']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type Purchase = Database['public']['Tables']['purchases']['Row'];
export type Quotation = Database['public']['Tables']['quotations']['Row'];
export type ActivityLogEntry = Database['public']['Tables']['activity_log']['Row'];
export type ShopMember = Database['public']['Tables']['shop_members']['Row'];
export type Store = Database['public']['Tables']['stores']['Row'];
