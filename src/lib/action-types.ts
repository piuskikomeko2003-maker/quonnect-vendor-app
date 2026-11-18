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
  photo_urls: string[];
}

export interface ProductUpdateInput extends ProductInput {
  id: string;
}

export interface CartLineInput {
  product_id: string;
  qty: number;
  sold_price: number;
}

export interface SaleCustomerInput {
  name: string;
  phone: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
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
  warning?: string;
}

export interface ReceiptInput {
  sale_id: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
}

export interface ReverseSaleResult extends SimpleResult {
  reversal?: {
    sale_id: string;
    order_no: string;
    total: number;
    refunded_amount: number;
    account_name: string | null;
    account_balance_after: number | null;
    items_reversed: number;
  };
}

export interface ExpenseInput {
  category: string;
  amount: number;
  note: string;
  frequency: "daily" | "monthly";
  entry_date: string;
  account_id?: string | null;
}

export interface ExpenseUpdateInput extends ExpenseInput {
  id: string;
}

export interface IncomeInput {
  category: string;
  amount: number;
  note: string;
  entry_date?: string;
  account_id?: string | null;
}

export interface BudgetInput {
  category: string;
  monthly_limit: number;
}

export interface FinancialAccountInput {
  name: string;
  kind: string;
  opening_balance: number;
  description: string;
  color: string | null;
  icon: string | null;
}

export interface FinancialAccountUpdateInput {
  id: string;
  name: string;
  kind: string;
  description: string;
  color: string | null;
  icon: string | null;
}

export interface AccountTransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  notes: string;
}

export interface StockPurchaseLineInput {
  product_id: string;
  quantity: number;
  unit_cost: number;
}

export interface StockPurchaseInput {
  items: StockPurchaseLineInput[];
  account_id: string | null;
  amount_paid: number;
  supplier_name: string;
  purchase_date: string;
  notes: string;
  idempotency_key: string;
}

export interface StockPurchaseResult extends SimpleResult {
  purchase?: {
    id: string;
    reference_no: string | null;
    total_amount: number;
    paid_amount: number;
    due_amount: number;
    account_name: string | null;
    account_balance_after: number | null;
    duplicate: boolean;
  };
}

export interface ReverseStockPurchaseResult extends SimpleResult {
  reversal?: {
    purchase_id: string;
    reference_no: string | null;
    refunded_amount: number;
    account_name: string | null;
    account_balance_after: number | null;
    items_reversed: number;
  };
}

export interface SettlementSaleAllocationInput {
  sale_id: string;
  amount: number;
}

export interface SettlementPurchaseAllocationInput {
  purchase_id: string;
  amount: number;
}

export interface CustomerPaymentInput {
  customer_id: string | null;
  customer_name: string;
  allocations: SettlementSaleAllocationInput[];
  payment_method: string;
  account_id: string;
  reference: string;
  paid_on: string;
  idempotency_key: string;
}

export interface SupplierPaymentInput {
  supplier_name: string;
  allocations: SettlementPurchaseAllocationInput[];
  account_id: string;
  reference: string;
  paid_on: string;
  idempotency_key: string;
}

export interface SettlementPaymentResult extends SimpleResult {
  payment?: {
    id: string;
    settlement_type: "customer_collection" | "supplier_payment";
    party_name: string;
    total: number;
    account_name: string | null;
    account_balance_after: number | null;
    party_outstanding_after: number | null;
    allocations: {
      sale_id?: string | null;
      purchase_id?: string | null;
      reference_no?: string | null;
      amount: number;
      due_after: number;
    }[];
    duplicate: boolean;
  };
}

export interface FinanceEntrySummary {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  entry_date: string;
  account_name: string | null;
  account_balance_after: number | null;
  updated: boolean;
}

export interface FinanceEntryResult extends SimpleResult {
  entry?: FinanceEntrySummary;
}

export interface ReverseFinanceEntryResult extends SimpleResult {
  reversal?: {
    id: string;
    type: "income" | "expense";
    category: string;
    amount: number;
    account_name: string | null;
    account_balance_after: number | null;
  };
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
