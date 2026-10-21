export const EXPENSE_CATEGORIES = [
  "Stock purchase",
  "Transport",
  "Stall fee",
  "Packaging",
  "Airtime/Data",
  "Food",
  "Other",
] as const;

export const BUSINESS_CATEGORIES = [
  "Fashion & clothing",
  "Cosmetics & beauty",
  "Jewellery & accessories",
  "Shoes & bags",
  "Food & produce",
  "Crafts & art",
  "Home & decor",
  "Other",
] as const;

export const PRODUCT_CATEGORIES = [
  "Shoes",
  "Bags",
  "Dresses",
  "Shirts",
  "Trousers & jeans",
  "Skirts",
  "Accessories",
  "Other",
] as const;

export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export const SIZE_SETS: Record<string, string[]> = {
  Shoes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
  Bags: ["Small", "Medium", "Large"],
  "Trousers & jeans": [
    "28",
    "30",
    "32",
    "34",
    "36",
    "38",
    "40",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
  ],
  Accessories: ["One size"],
  Other: ["One size"],
};

export const CATEGORY_ICONS: Record<string, IconKey> = {
  Shoes: "shoe",
  Bags: "bag",
  Dresses: "shirt",
  Shirts: "shirt",
  Skirts: "shirt",
  "Trousers & jeans": "jeans",
};

export const STALL_COLORS = [
  "#0F8A4D",
  "#0F766E",
  "#1D4ED8",
  "#B45309",
  "#9D174D",
  "#4C1D95",
  "#10241F",
];

export const PAYMENT_METHODS = ["Cash", "MTN MoMo", "Airtel Money", "Card"];

export const DEFAULT_ACCENT = "#0F8A4D";

export const ANALYTICS_RANGES = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "3 months"],
  ["6m", "6 months"],
  ["12m", "12 months"],
] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number][0];
export type GroupBy = "day" | "week" | "month";
export type Metric = "sales" | "expenses" | "profit";

export const GROUPS: Record<AnalyticsRange, GroupBy[]> = {
  "7d": ["day"],
  "30d": ["day", "week"],
  "90d": ["day", "week", "month"],
  "6m": ["week", "month"],
  "12m": ["week", "month"],
};

export const GROUP_NAMES: Record<GroupBy, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export const METRIC_COLORS: Record<Metric, string> = {
  sales: "#0F8A4D",
  expenses: "#D97706",
  profit: "#2563EB",
};

export type IconKey =
  | "coins"
  | "calendar"
  | "bars"
  | "trend"
  | "plusc"
  | "moneybag"
  | "swap"
  | "cart"
  | "car"
  | "utensils"
  | "chevr"
  | "chevd"
  | "mobile"
  | "home"
  | "receipt"
  | "box"
  | "wallet"
  | "store"
  | "camera"
  | "check"
  | "link"
  | "shirt"
  | "basket"
  | "bottle"
  | "shoe"
  | "bag"
  | "jeans"
  | "chart"
  | "share"
  | "download"
  | "phone"
  | "mail"
  | "pin"
  | "user"
  | "edit"
  | "logout"
  | "lock"
  | "tag"
  | "quote"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "whatsapp";
