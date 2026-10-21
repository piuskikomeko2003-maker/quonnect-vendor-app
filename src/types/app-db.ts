import type { Database } from "@/types/database.types";

export type AppDatabase = Database;

type T<K extends keyof AppDatabase["public"]["Tables"]> =
  AppDatabase["public"]["Tables"][K];

export type Vendor = T<"vendors">["Row"];
export type Stall = T<"stalls">["Row"];
export type Product = T<"products">["Row"];
export type Sale = T<"sales">["Row"];
export type SaleItem = T<"sale_items">["Row"];
export type FinanceEntry = T<"finance_entries">["Row"];
export type Budget = T<"budgets">["Row"];
export type StockMovement = T<"stock_movements">["Row"];
