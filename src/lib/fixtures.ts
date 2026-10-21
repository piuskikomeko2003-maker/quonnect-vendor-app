import { addDays, dayMonthLabel, monthsAgoKey, todayKey } from "@/lib/format";
import type {
  AnalyticsData,
  HomeData,
  MoneyData,
  SaleWithItems,
  SellData,
  StallData,
} from "@/lib/types";
import type { Budget, FinanceEntry, Product, Sale, SaleItem, Stall, Vendor } from "@/types/app-db";

const today = todayKey();
const month = today.slice(0, 7);

export const previewVendor: Vendor = {
  id: "preview-vendor",
  user_id: "preview-user",
  owner_name: "Amina Nakato",
  business_name: "Amina Fashions",
  category: "Fashion & clothing",
  region: "Owino Market, Kampala",
  phone: "+256 772 000 111",
  phone2: null,
  email: "amina@example.com",
  motto: "Quality styles, fair prices",
  logo_url: null,
  instagram: "aminafashions",
  facebook: "AminaFashions",
  tiktok: "aminafashions",
  whatsapp: "+256772000111",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const previewStall: Stall = {
  id: "preview-stall",
  vendor_id: previewVendor.id,
  name: "Amina Fashions",
  tagline: "Quality styles, fair prices",
  accent_color: "#0F8A4D",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function product(
  id: string,
  name: string,
  category: string,
  price: number,
  cost: number,
  stock: number,
  extra: Partial<Product> = {},
): Product {
  return {
    id,
    vendor_id: previewVendor.id,
    name,
    description: "Handmade, quality checked and ready for market day.",
    category,
    sizes: ["S", "M", "L"],
    colors: ["Blue", "Black"],
    cost,
    price,
    stock,
    discount_pct: 0,
    is_active: true,
    photo_url: null,
    min_stock_alert: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

export const previewProducts: Product[] = [
  product("p1", "Kitenge Dress", "Dresses", 65000, 40000, 12, { discount_pct: 0, colors: ["Blue", "Red", "Yellow"], sizes: ["S", "M", "L", "XL"] }),
  product("p2", "Leather Sandals", "Shoes", 35000, 20000, 3, { discount_pct: 10, colors: ["Brown", "Black"], sizes: ["38", "39", "40", "41", "42"] }),
  product("p3", "Woven Basket", "Other", 25000, 12000, 20, { colors: ["Natural"], sizes: ["One size"] }),
  product("p4", "Shea Body Butter", "Other", 18000, 9000, 2, { is_active: false, colors: [], sizes: ["One size"] }),
  product("p5", "Denim Jeans", "Trousers & jeans", 27000, 16000, 9, { sizes: ["30", "32", "34", "36"] }),
];

const daily = Array.from({ length: 30 }, (_, index) => {
  const day = addDays(today, index - 29);
  const values = [42000, 18000, 76000, -9000, 54000, 92000, 31000, 64000, 27000];
  const value = values[index % values.length];
  const sales = Math.max(0, value + 45000);
  return {
    day,
    sales,
    gross_profit: value,
    price_reduction: index % 5 === 0 ? 2000 : 0,
    expected_revenue: sales + 2000,
    expenses: index % 4 === 0 ? 18000 : 0,
    operating_expenses: index % 4 === 0 ? 12000 : 0,
    other_income: index % 9 === 0 ? 25000 : 0,
    net_profit: value,
  };
});

export const previewHome: HomeData = {
  overview: {
    today: todayKey(),
    selected_month: month,
    sales_today: 65000,
    sales_yesterday: 120000,
    net_today: 25000,
    net_yesterday: 18000,
    expenses_today: 5000,
    expenses_yesterday: 12000,
    net_month: 843000,
    net_prev_month: 712000,
    month: {
      sales: 2450000,
      gross_profit: 912000,
      price_reduction: 34000,
      other_income: 120000,
      expenses: 189000,
      net_profit: 843000,
    },
    budget: { spent: 214000, total: 300000 },
    low_stock: [
      {
        id: "p4",
        name: "Shea Body Butter",
        stock: 2,
        category: "Other",
        photo_url: null,
        price: 18000,
        cost: 9000,
        discount_pct: 0,
      },
      {
        id: "p2",
        name: "Leather Sandals",
        stock: 3,
        category: "Shoes",
        photo_url: null,
        price: 35000,
        cost: 20000,
        discount_pct: 10,
      },
    ],
  },
  daily: daily.slice(-7).map((row, index) =>
    index === 3 ? { ...row, net_profit: -12000, gross_profit: -12000 } : row,
  ),
  transactions: [
    { id: "t1", kind: "sale", title: "Sales", category: "Sales", amount: 65000, date: today, ts: new Date().toISOString(), items: ["Kitenge Dress"] },
    { id: "t2", kind: "sale", title: "Sales", category: "Sales", amount: 25000, date: today, ts: new Date().toISOString(), items: ["Denim Jeans"] },
    { id: "t3", kind: "expense", title: "Bags", category: "Packaging", amount: -12000, date: today, ts: new Date().toISOString(), items: null },
    { id: "t4", kind: "expense", title: "Market day fee", category: "Stall fee", amount: -92000, date: addDays(today, -2), ts: null, items: null },
    { id: "t5", kind: "income", title: "Custom tailoring", category: "Other Income", amount: 50000, date: addDays(today, -3), ts: null, items: null },
    { id: "t6", kind: "expense", title: "Boda delivery", category: "Transport", amount: -15000, date: addDays(today, -4), ts: null, items: null },
  ],
};

const previewSaleItem = (
  saleId: string,
  name: string,
  unit: number,
  cost: number,
  listed = unit,
): SaleItem => ({
  id: `${saleId}-item`,
  sale_id: saleId,
  vendor_id: previewVendor.id,
  product_id: "p5",
  product_name: name,
  quantity: 1,
  unit_price: unit,
  unit_cost: cost,
  listed_price: listed,
  sold_price: unit,
  total: unit,
  profit: unit - cost,
  created_at: new Date().toISOString(),
});

const recentSale: SaleWithItems = {
  id: "preview-sale-1",
  vendor_id: previewVendor.id,
  order_no: "S-DEMO-0001",
  customer_name: null,
  customer_phone: null,
  subtotal: 25000,
  discount: 0,
  total: 25000,
  profit: 9000,
  price_reduction: 2000,
  payment_method: "Cash",
  status: "completed",
  sale_date: today,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  items: [previewSaleItem("preview-sale-1", "Denim Jeans", 25000, 16000, 27000)],
};

export const previewSell: SellData = {
  products: previewProducts,
  recentSales: [
    recentSale,
    {
      ...recentSale,
      id: "preview-sale-2",
      total: 65000,
      profit: 25000,
      price_reduction: 0,
      items: [previewSaleItem("preview-sale-2", "Kitenge Dress", 65000, 40000)],
    },
  ],
};

const expense = (
  id: string,
  category: string,
  amount: number,
  note: string,
  day: string,
  frequency: "daily" | "monthly" = "daily",
): FinanceEntry => ({
  id,
  vendor_id: previewVendor.id,
  type: "expense",
  category,
  amount,
  source: "manual",
  entry_date: day,
  notes: note,
  frequency,
  created_at: new Date().toISOString(),
});

const budget = (category: string, limit: number): Budget => ({
  id: category,
  vendor_id: previewVendor.id,
  category,
  monthly_limit: limit,
  created_at: new Date().toISOString(),
});

export const previewMoney: MoneyData = {
  expenses: [
    expense("e1", "Stall fee", 92000, "Market day fee", today, "monthly"),
    expense("e2", "Transport", 15000, "", addDays(today, -1)),
    expense("e3", "Packaging", 12000, "Bags", addDays(today, -2)),
    expense("e4", "Airtime/Data", 5000, "", addDays(today, -3)),
  ],
  income: [
    { ...expense("i1", "Custom tailoring", 50000, "", addDays(today, -4)), type: "income" },
    { ...expense("i2", "Delivery fee", 20000, "", addDays(today, -10)), type: "income" },
  ],
  budgets: [
    budget("Stock purchase", 1200000),
    budget("Transport", 40000),
    budget("Stall fee", 120000),
    budget("Packaging", 30000),
    budget("Airtime/Data", 20000),
  ],
  spentByCategory: {
    "Stock purchase": 640000,
    Transport: 34000,
    "Stall fee": 92000,
    Packaging: 26000,
    "Airtime/Data": 18000,
  },
  categories: {
    expense: [
      "Stock purchase",
      "Transport",
      "Stall fee",
      "Packaging",
      "Airtime/Data",
      "Food",
      "Other",
      "Salon supplies",
    ],
    income: ["Tailoring", "Repairs", "Delivery", "Commission", "Gift", "Other"],
  },
};

const monthly = Array.from({ length: 12 }, (_, index) => {
  const key = monthsAgoKey(11 - index).slice(0, 7);
  const salesValues = [1250000, 1480000, 1330000, 1760000, 1590000, 1880000, 2020000, 1950000, 2210000, 2340000, 2180000, 2450000];
  const sales = salesValues[index];
  return {
    month: key,
    sales,
    gross_profit: Math.round(sales * 0.37),
    cogs: sales - Math.round(sales * 0.37),
    expected_revenue: sales + (index % 4 === 0 ? 34000 : 12000),
    expenses: 160000 + index * 3000,
    operating_expenses: 90000 + index * 2000,
    other_income: index % 3 === 0 ? 50000 : 0,
    net_profit: Math.round(sales * 0.37) - (90000 + index * 2000) + (index % 3 === 0 ? 50000 : 0),
  };
});

export const previewAnalytics: AnalyticsData = {
  daily,
  previous: daily.map((row) => ({ ...row, day: addDays(row.day, -30), sales: row.sales * 0.9 })),
  monthly,
  categories: [
    { category: "Stock purchase", total: 640000 },
    { category: "Stall fee", total: 276000 },
    { category: "Transport", total: 82000 },
    { category: "Packaging", total: 46000 },
    { category: "Airtime/Data", total: 18000 },
  ],
  items: previewProducts.map((item, index) => ({
    name: item.name,
    cost: item.cost,
    expected: item.price,
    actual: index % 2 ? item.price - 2000 : item.price,
    sold: index === 3 ? 0 : 4 - (index % 3),
  })),
  grouped: {
    labels: daily.map((row) => dayMonthLabel(row.day)),
    buckets: daily.map((row) => ({ key: row.day, days: [row.day], label: dayMonthLabel(row.day) })),
    sales: daily.map((row) => Number(row.sales)),
    expenses: daily.map((row) => Number(row.expenses)),
    profit: daily.map((row) => Number(row.net_profit)),
  },
  totals: {
    sales: daily.reduce((total, row) => total + Number(row.sales), 0),
    expenses: daily.reduce((total, row) => total + Number(row.expenses), 0),
    profit: daily.reduce((total, row) => total + Number(row.net_profit), 0),
  },
  previousSales: daily.reduce((total, row) => total + Number(row.sales) * 0.9, 0),
};

export const previewStallData: StallData = {
  vendor: previewVendor,
  stall: previewStall,
  products: previewProducts,
};

export const previewSale: Sale = recentSale;
export const previewMoneyEntry = previewMoney;
