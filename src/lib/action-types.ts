export interface ProductInput {
  name: string;
  category: string;
  sizes: string[];
  colors: string[];
  description: string;
  cost: number;
  price: number;
  quantity: number;
  discount_pct: number;
  is_published: boolean;
  photo_url: string | null;
}

export interface CartLineInput {
  product_id: string;
  qty: number;
  sold_price: number;
}

export interface SaleActionResult {
  ok: boolean;
  error?: string;
  sale?: {
    id: string;
    order_no: string;
    total: number;
    profit: number;
    price_reduction: number;
    payment_method: string;
  };
  items?: {
    product_id: string;
    name: string;
    qty: number;
    listed: number;
    sold: number;
    cost: number;
  }[];
}

export interface ReceiptInput {
  sale_id: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
}

export interface ExpenseInput {
  category: string;
  amount: number;
  note: string;
  frequency: "daily" | "monthly";
  entry_date: string;
}

export interface ExpenseUpdateInput extends ExpenseInput {
  id: string;
}

export interface IncomeInput {
  category: string;
  amount: number;
  note: string;
}

export interface BudgetInput {
  category: string;
  monthly_limit: number;
}

export interface StallInput {
  name: string;
  tagline: string;
  accent_color: string;
}

export interface ProfileInput {
  owner_name: string;
  business_name: string;
  phone: string;
  phone2: string;
  email: string;
  category: string;
  location: string;
  motto: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
  logo_url: string | null;
}

export interface SimpleResult {
  ok: boolean;
  error?: string;
}
