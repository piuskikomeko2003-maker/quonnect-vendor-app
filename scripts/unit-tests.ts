import assert from "node:assert/strict";
import { formatMoney, formatUGX, shortMoney, addDays, clampDateRange } from "../src/lib/format";
import { businessMonthKey } from "../src/lib/format";
import {
  businessMonthStartKey,
  defaultRange,
  monthRange,
  periodPresets,
  resolveReportingPeriod,
  sameRange,
} from "../src/lib/reporting-period";
import {
  hasFeature,
  mergeFeatureDefaults,
  NEW_VENDOR_FEATURES,
} from "../src/lib/features";
import { effectivePrice } from "../src/lib/product";
import {
  addProductImages,
  cleanProductImageUrls,
  coverImageUrl,
  MAX_PRODUCT_IMAGES,
  moveProductImage,
  productImages,
  removeProductImage,
  setCoverProductImage,
} from "../src/lib/product-images";
import { niceStep, niceMax } from "../src/lib/chart";
import { profitBarScale, profitBarLabelLayout } from "../src/lib/chart";
import { whatsappNumber, receiptText } from "../src/lib/receipt";
import {
  normalizeAccountsOverview,
  normalizeDashboard,
  normalizePurchasesOverview,
  normalizeSettlementsOverview,
} from "../src/lib/data";
import {
  accountKindLabel,
  accountTypeValue,
  canDeactivateAccount,
  deriveAccountBalance,
  isAccountKind,
  totalAvailableFunds,
} from "../src/lib/accounts";
import {
  purchaseGrandTotal,
  purchaseLineTotal,
  purchaseOutstanding,
  purchasePaymentStatus,
  validatePurchasePayment,
} from "../src/lib/purchases";
import {
  budgetProgress,
  buildMoneyOverview,
  matchesMoneyTransaction,
  saleOutstandingAmount,
  saleReceivedAmount,
} from "../src/lib/money";
import {
  matchesSettlementHistory,
  settlementPaymentStatus,
  settlementTypeLabel,
  validateSettlementDrafts,
} from "../src/lib/settlements";
import { userMessage } from "../src/lib/errors";
import {
  isValidEmail,
  isValidEntryDate,
  isValidPhone,
  parseMoneyInput,
  parseWholeInput,
  validateMoneyEntry,
} from "../src/lib/validation";
import { AUTH_MARKER_COOKIE, resolveAuthRedirect } from "../src/lib/auth-redirect";
import { authMarkerCookie, clearAuthMarkerCookie } from "../src/lib/auth-marker";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`, error);
    process.exitCode = 1;
  }
}

test("money is integer UGX", () => {
  assert.equal(formatUGX(1234500), "UGX 1,234,500");
  assert.equal(formatUGX(25000.4), "UGX 25,000");
});

test("formatMoney keeps full amounts by default", () => {
  assert.equal(formatMoney(270000), "UGX 270,000");
  assert.equal(formatMoney(4100), "UGX 4,100");
  assert.equal(formatMoney(0), "UGX 0");
  assert.equal(formatMoney(-115000), "UGX -115,000");
  assert.equal(formatMoney(25000.4), "UGX 25,000");
  assert.equal(formatMoney("1250000"), "UGX 1,250,000");
  assert.equal(formatMoney(null), "UGX 0");
});

test("formatMoney can omit the currency label", () => {
  assert.equal(formatMoney(270000, { currency: false }), "270,000");
  assert.equal(formatMoney(4100, { currency: false }), "4,100");
});

test("formatMoney compacts very large amounts", () => {
  assert.equal(formatMoney(0, { compact: true }), "0");
  assert.equal(formatMoney(4100, { compact: true }), "4.1K");
  assert.equal(formatMoney(115000, { compact: true }), "115K");
  assert.equal(formatMoney(270000, { compact: true }), "270K");
  assert.equal(formatMoney(1250000, { compact: true }), "1.25M");
  assert.equal(formatMoney(45600000, { compact: true }), "45.6M");
  assert.equal(formatMoney(2500000000, { compact: true }), "2.5B");
  assert.equal(formatMoney(-1250000, { compact: true }), "-1.25M");
});

test("formatUGX delegates to formatMoney", () => {
  assert.equal(formatUGX(1234500), formatMoney(1234500));
});

test("chart short labels", () => {
  assert.equal(shortMoney(1_200_000), "1.2M");
  assert.equal(shortMoney(340_000), "340k");
  assert.equal(shortMoney(-9_500), "-9.5k");
});

test("effective price applies discount", () => {
  assert.equal(effectivePrice({ price: 35000, discount_pct: 10 }), 31500);
  assert.equal(effectivePrice({ price: 27000, discount_pct: 0 }), 27000);
});

test("nice axes use about four steps", () => {
  assert.equal(niceStep(25000), 25000);
  assert.equal(niceMax(132000), 200000);
});

test("profit bars stay clear of the date labels", () => {
  const height = 236;
  const T = 26;
  const B = 68;
  const innerHeight = height - T - B;
  const dateLabelY = height - B + 16;

  const cases: { name: string; vals: number[] }[] = [
    { name: "one big negative", vals: [0, 0, -400_000, 0] },
    { name: "one big positive", vals: [0, 0, 400_000, 0] },
    { name: "mixed", vals: [-400_000, 250_000, 0, -12_000, 90_000] },
    { name: "tiny negative", vals: [-1, 0, 5] },
  ];

  for (const item of cases) {
    const { min, max } = profitBarScale(item.vals);
    if (item.vals.some((value) => value < 0)) {
      assert.ok(min < Math.min(...item.vals), `${item.name}: min extends past the lowest bar`);
    }
    const range = max - min || 1;
    const y = (value: number) => T + innerHeight - ((value - min) / range) * innerHeight;

    for (const value of item.vals) {
      const valueY = y(value);
      const label = profitBarLabelLayout(value, valueY);
      assert.ok(
        label.y + 8 <= dateLabelY,
        `${item.name}: label for ${value} clears the date labels`,
      );
      if (value < 0) {
        assert.ok(label.y > valueY + 6, `${item.name}: negative label sits below the bar`);
      } else {
        assert.ok(label.y < valueY, `${item.name}: non-negative label stays above the bar`);
      }
    }
  }
});

test("all-zero profit bars show the empty state", () => {
  const { min, max, step } = profitBarScale([0, 0, 0]);
  assert.equal(min, 0);
  assert.equal(max, 0);
  assert.equal(step, 1);
});

test("custom charts are capped at 60 days", () => {
  const result = clampDateRange("2026-01-01", "2026-04-01", 60);
  assert.equal(result.to, "2026-04-01");
  assert.equal(result.from, addDays("2026-04-01", -59));
});

test("business month follows the configured start day", () => {
  assert.equal(businessMonthKey("2026-10-23", 1), "2026-10");
  assert.equal(businessMonthKey("2026-10-23", 25), "2026-09");
  assert.equal(businessMonthKey("2026-10-25", 25), "2026-10");
  assert.equal(businessMonthKey("2026-01-05", 25), "2025-12");
});

test("reporting defaults start from today, this week and this month", () => {
  const today = "2026-11-04"; // Wednesday
  assert.deepEqual(defaultRange("daily", today, 1), { from: today, to: today });
  assert.deepEqual(defaultRange("weekly", today, 1), { from: "2026-11-02", to: today });
  assert.deepEqual(defaultRange("monthly", today, 1), { from: "2026-11-01", to: today });
  assert.deepEqual(defaultRange("custom", today, 1), { from: "2026-10-22", to: today });
});

test("reporting quick presets match daily, weekly and monthly windows", () => {
  const daily = periodPresets("daily", "2026-11-04", 1);
  assert.deepEqual(daily.map((item) => item.key), ["today", "yesterday"]);
  assert.deepEqual(daily[1], {
    key: "yesterday",
    label: "Yesterday",
    from: "2026-11-03",
    to: "2026-11-03",
  });

  const weekly = periodPresets("weekly", "2026-11-04", 1);
  assert.deepEqual(weekly[0], {
    key: "this-week",
    label: "This week",
    from: "2026-11-02",
    to: "2026-11-04",
  });
  assert.deepEqual(weekly[1], {
    key: "last-week",
    label: "Last week",
    from: "2026-10-26",
    to: "2026-11-01",
  });

  const monthly = periodPresets("monthly", "2026-11-04", 1);
  assert.deepEqual(monthly[1], {
    key: "last-month",
    label: "Last month",
    from: "2026-10-01",
    to: "2026-10-31",
  });
  assert.deepEqual(periodPresets("custom", "2026-11-04", 1), []);
});

test("business-month presets respect month_start_day", () => {
  assert.equal(businessMonthStartKey("2026-11-02", 25), "2026-10-25");
  const monthly = periodPresets("monthly", "2026-11-02", 25);
  assert.deepEqual(monthly[0], {
    key: "this-month",
    label: "This month",
    from: "2026-10-25",
    to: "2026-11-02",
  });
  assert.deepEqual(monthly[1], {
    key: "last-month",
    label: "Last month",
    from: "2026-09-25",
    to: "2026-10-24",
  });
  assert.deepEqual(monthRange("2026-10", 25, "2026-11-02"), {
    from: "2026-10-25",
    to: "2026-11-02",
  });
});

test("valid reporting URL values win and invalid values fall back", () => {
  assert.deepEqual(
    resolveReportingPeriod("custom", "2026-10-01", "2026-10-10", "2026-11-04", 1),
    { period: "custom", from: "2026-10-01", to: "2026-10-10" },
  );
  assert.deepEqual(
    resolveReportingPeriod("daily", "2026-12-01", "2026-12-01", "2026-11-04", 1),
    { period: "daily", from: "2026-11-04", to: "2026-11-04" },
  );
  assert.equal(
    sameRange(
      resolveReportingPeriod("weekly", "2026-10-31", "2026-10-01", "2026-11-04", 1),
      { from: "2026-10-01", to: "2026-10-31" },
    ),
    true,
  );
  assert.deepEqual(
    resolveReportingPeriod("daily", "2026-10-01", "2026-10-31", "2026-11-04", 1),
    { period: "daily", from: "2026-10-31", to: "2026-10-31" },
  );
});

test("dashboard snapshot normalises string numerics and nested totals", () => {
  const dashboard = normalizeDashboard({
    period: {
      from: "2026-11-01",
      to: "2026-11-02",
      sales: "125000",
      expenses: "5000",
      net_profit: "20000",
      orders: "3",
      customers: "2",
    },
    daily: [
      {
        day: "2026-11-01",
        sales: "100000",
        gross_profit: "20000",
        expenses: "5000",
        other_income: "0",
        net_profit: "15000",
      },
    ],
    cash: [{ day: "2026-11-01", cash_in: "100000", cash_out: "5000" }],
    categories: [{ category: "Transport", total: "5000" }],
    items: [{ name: "Kitenge", cost: "40000", expected: "65000", actual: "60000", sold: "2" }],
    transactions: [],
    current: {
      available_funds: "180000",
      customer_outstanding: "0",
      stock_value: "90000",
      stock_units: "5",
      accounts: [
        {
          id: "a1",
          name: "Cash",
          kind: "cash",
          opening_balance: "100000",
          balance: "180000",
          is_active: true,
        },
      ],
    },
    low_stock: [],
  });

  assert.equal(dashboard.period.sales, 125000);
  assert.equal(dashboard.period.orders, 3);
  assert.equal(dashboard.daily[0].net_profit, 15000);
  assert.equal(dashboard.cash[0].cash_out, 5000);
  assert.equal(dashboard.categories[0].total, 5000);
  assert.equal(dashboard.items[0].sold, 2);
  assert.equal(dashboard.current.available_funds, 180000);
  assert.equal(dashboard.current.accounts[0].balance, 180000);
});

test("account balances are opening balance plus recorded movements", () => {
  assert.equal(deriveAccountBalance(50000, [25000, -10000, -5000]), 60000);
  assert.equal(deriveAccountBalance("100000", ["25000", "-20000"]), 105000);
  assert.equal(deriveAccountBalance(null, []), 0);
});

test("available funds only count active accounts", () => {
  const accounts = [
    { balance: 120000, is_active: true },
    { balance: 30000, is_active: true },
    { balance: 0, is_active: false },
  ];
  assert.equal(totalAvailableFunds(accounts), 150000);
  assert.equal(totalAvailableFunds(accounts.map((account) => ({ ...account, is_active: false }))), 0);
});

test("an account must be emptied before deactivation", () => {
  assert.equal(canDeactivateAccount(0), true);
  assert.equal(canDeactivateAccount(0.4), true);
  assert.equal(canDeactivateAccount(1), false);
  assert.equal(canDeactivateAccount(-25000), false);
});

test("legacy mobile money accounts display as mobile money", () => {
  assert.equal(accountTypeValue("mtn_momo"), "mobile_money");
  assert.equal(accountTypeValue("airtel_money"), "mobile_money");
  assert.equal(accountTypeValue("savings"), "savings");
  assert.equal(accountTypeValue("unexpected"), "other");
  assert.equal(accountKindLabel("mtn_momo"), "Mobile Money");
  assert.equal(accountKindLabel("cash"), "Physical Cash");
  assert.equal(isAccountKind("bank"), true);
  assert.equal(isAccountKind("mobile_money"), true);
  assert.equal(isAccountKind("loan"), false);
});

test("accounts overview normalises string numerics", () => {
  const data = normalizeAccountsOverview({
    accounts: [
      {
        id: "a1",
        name: "Shop Cash",
        kind: "cash",
        opening_balance: "50000",
        description: "Till",
        color: "#0F766E",
        icon: "wallet",
        balance: "75000",
        movement_count: "2",
        last_activity: "2026-11-02",
        is_active: true,
      },
    ],
    transactions: [
      {
        id: "t1",
        account_id: "a1",
        account_name: "Shop Cash",
        amount: "25000",
        kind: "sale_payment",
        source_type: "sale",
        source_id: "s1",
        occurred_on: "2026-11-02",
        notes: "Sale S-1",
        created_at: "2026-11-02T10:00:00Z",
      },
    ],
  });

  assert.equal(data.accounts[0].balance, 75000);
  assert.equal(data.accounts[0].opening_balance, 50000);
  assert.equal(data.accounts[0].movement_count, 2);
  assert.equal(data.accounts[0].description, "Till");
  assert.equal(data.transactions[0].amount, 25000);
  assert.equal(data.transactions[0].account_name, "Shop Cash");
});

test("money overview counts only received income and shows unpaid separately", () => {
  const overview = buildMoneyOverview({
    availableFunds: 680000,
    salesReceivedThisMonth: 1200000,
    otherIncomeThisMonth: 50000,
    expensesThisMonth: 250000,
    receivables: 185000,
    payables: 90000,
  });

  assert.equal(overview.received_this_month, 1250000);
  assert.equal(overview.profit_this_month, 1000000);
  assert.equal(overview.receivables, 185000);
  assert.equal(overview.payables, 90000);
  assert.equal(overview.available_funds, 680000);
});

test("sale money helpers only count paid amounts", () => {
  assert.equal(
    saleReceivedAmount({ total: 100000, paid_amount: 40000, due_amount: 60000, status: "partial" }),
    40000,
  );
  assert.equal(
    saleReceivedAmount({ total: 100000, paid_amount: 0, due_amount: 0, status: "completed" }),
    100000,
  );
  assert.equal(
    saleReceivedAmount({ total: 100000, paid_amount: 0, due_amount: 100000, status: "credit" }),
    0,
  );
  assert.equal(
    saleOutstandingAmount({ total: 100000, paid_amount: 40000, due_amount: 60000, status: "partial" }),
    60000,
  );
});

test("budget progress flags close and over budgets", () => {
  const healthy = budgetProgress(200000, 50000);
  assert.equal(healthy.remaining, 150000);
  assert.equal(healthy.percent, 25);
  assert.equal(healthy.status, "ok");

  const close = budgetProgress(200000, 170000);
  assert.equal(close.status, "close");

  const over = budgetProgress(200000, 250000);
  assert.equal(over.status, "over");
  assert.equal(over.remaining, -50000);
  assert.equal(budgetProgress(0, 0).status, "ok");
});

test("transaction filters search descriptions and narrow by date/account", () => {
  const transaction = {
    id: "tx-1",
    kind: "expense" as const,
    title: "Boda to market",
    category: "Transport",
    amount: -15000,
    date: "2026-11-02",
    ts: null,
    account_id: "acc-cash",
    account_name: "Main Cash Box",
    note: "Boda to market",
  };

  assert.equal(matchesMoneyTransaction(transaction, {}), true);
  assert.equal(matchesMoneyTransaction(transaction, { search: "boda" }), true);
  assert.equal(matchesMoneyTransaction(transaction, { search: "airtime" }), false);
  assert.equal(matchesMoneyTransaction(transaction, { kind: "expense" }), true);
  assert.equal(matchesMoneyTransaction(transaction, { kind: "income" }), false);
  assert.equal(matchesMoneyTransaction(transaction, { accountId: "acc-momo" }), false);
  assert.equal(matchesMoneyTransaction(transaction, { from: "2026-11-03" }), false);
  assert.equal(matchesMoneyTransaction(transaction, { to: "2026-11-02" }), true);
  assert.equal(matchesMoneyTransaction(transaction, { category: "Transport" }), true);
});

test("stock purchase totals, payables and payment status", () => {
  const lines = [
    { quantity: 10, unit_cost: 5000 },
    { quantity: 2, unit_cost: 15000 },
  ];
  assert.equal(purchaseLineTotal(lines[0]), 50000);
  assert.equal(purchaseGrandTotal(lines), 80000);

  assert.equal(purchaseOutstanding(80000, 60000), 20000);
  assert.equal(purchaseOutstanding(80000, 80000), 0);
  assert.equal(purchaseOutstanding(80000, 90000), 0);

  assert.equal(purchasePaymentStatus(80000, 0), "unpaid");
  assert.equal(purchasePaymentStatus(80000, 60000), "partial");
  assert.equal(purchasePaymentStatus(80000, 80000), "paid");

  assert.equal(validatePurchasePayment(80000, 60000, "account-1", 100000), null);
  assert.match(validatePurchasePayment(80000, 60000, null) ?? "", /account used to pay/);
  assert.match(validatePurchasePayment(80000, 90000, "account-1") ?? "", /more than the total/);
  assert.match(
    validatePurchasePayment(80000, 60000, "account-1", 50000) ?? "",
    /enough money/,
  );
  assert.match(validatePurchasePayment(0, 0, null) ?? "", /at least one product/);
});

test("purchases overview normalises items, payables and outstanding", () => {
  const data = normalizePurchasesOverview({
    outstanding: "90000",
    supplier_payables: [
      {
        supplier_name: "Kikuubo Wholesalers",
        due_amount: "90000",
        purchase_count: "1",
        last_purchase_date: "2026-11-02",
      },
    ],
    purchases: [
      {
        id: "p1",
        reference_no: "P-1",
        supplier_name: "Kikuubo Wholesalers",
        account_id: "a1",
        account_name: "Main Cash Box",
        purchase_date: "2026-11-02",
        total_amount: "240000",
        paid_amount: "150000",
        due_amount: "90000",
        notes: "Two boxes",
        created_at: "2026-11-02T10:00:00Z",
        items: [
          {
            product_id: "prod-1",
            product_name: "Kitenge Dress",
            quantity: "4",
            unit_cost: "40000",
            total_cost: "160000",
          },
        ],
      },
    ],
  });

  assert.equal(data.outstanding, 90000);
  assert.equal(data.supplierPayables[0].due_amount, 90000);
  assert.equal(data.purchases[0].paid_amount, 150000);
  assert.equal(data.purchases[0].due_amount, 90000);
  assert.equal(data.purchases[0].items[0].quantity, 4);
  assert.equal(data.purchases[0].items[0].total_cost, 160000);
});

test("feature flags default on for existing vendors and respect explicit values", () => {  assert.equal(hasFeature({ features_enabled: {} }, "customers"), true);
  assert.equal(hasFeature({ features_enabled: { customers: false } }, "customers"), false);
  assert.equal(hasFeature({ features_enabled: { customers: true } }, "customers"), true);
  assert.equal(hasFeature({ features_enabled: {} }, "purchasing"), false);
});

test("new vendor feature defaults keep optional features off", () => {
  assert.equal(NEW_VENDOR_FEATURES.home, true);
  assert.equal(NEW_VENDOR_FEATURES.sales, true);
  assert.equal(NEW_VENDOR_FEATURES.stock, true);
  assert.equal(NEW_VENDOR_FEATURES.money, true);
  assert.equal(NEW_VENDOR_FEATURES.customers, false);
  assert.equal(NEW_VENDOR_FEATURES.suppliers, false);
  assert.equal(NEW_VENDOR_FEATURES.budgets, false);
  assert.equal(NEW_VENDOR_FEATURES.accounts, false);
  assert.equal(NEW_VENDOR_FEATURES.purchasing, false);
});

test("feature defaults never overwrite explicit flags", () => {
  assert.deepEqual(
    mergeFeatureDefaults({ customers: true, suppliers: false }, NEW_VENDOR_FEATURES),
    { ...NEW_VENDOR_FEATURES, customers: true, suppliers: false },
  );
});

test("Uganda WhatsApp numbers", () => {
  assert.equal(whatsappNumber("0772100200"), "256772100200");
  assert.equal(whatsappNumber("+256 772 100 200"), "256772100200");
});

test("receipt text contains savings and total", () => {
  const text = receiptText(
    {
      id: "abcd-1234",
      orderNo: "S-1",
      date: "2026-10-21",
      total: 25000,
      profit: 9000,
      priceReduction: 2000,
      paymentMethod: "Cash",
      customerName: "",
      customerPhone: "",
      items: [{ name: "Denim Jeans", qty: 1, listed: 27000, sold: 25000, cost: 16000 }],
    },
    {
      stallName: "Amina Fashions",
      tagline: "Quality styles, fair prices",
      businessName: "Amina Fashions",
      category: "Fashion & clothing",
      location: "Kampala",
      phone: "+256772000111",
      logoUrl: null,
      accent: "#0F8A4D",
      instagram: "",
      facebook: "",
      tiktok: "",
      whatsapp: "",
    },
  );
  assert.match(text, /You saved UGX 2,000/);
  assert.match(text, /Total: UGX 25,000/);
  assert.match(text, /Denim Jeans/);
});

test("legacy product cover is used when no gallery exists", () => {
  assert.deepEqual(productImages({ photo_url: "https://cdn.test/one.jpg", photo_urls: [] }), [
    "https://cdn.test/one.jpg",
  ]);
  assert.equal(coverImageUrl({ photo_url: "https://cdn.test/one.jpg" }), "https://cdn.test/one.jpg");
});

test("product galleries are de-duplicated and capped at eight", () => {
  const urls = Array.from({ length: 10 }, (_, index) => `https://cdn.test/${index}.jpg`);
  const cleaned = cleanProductImageUrls([...urls, urls[0], "javascript:alert(1)", "  "]);
  assert.equal(cleaned.length, MAX_PRODUCT_IMAGES);
  assert.equal(new Set(cleaned).size, MAX_PRODUCT_IMAGES);
  assert.ok(!cleaned.some((url) => url.startsWith("javascript:")));
});

test("product photo add keeps the limit and existing order", () => {
  const existing = ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"];
  const next = addProductImages(existing, [
    "https://cdn.test/c.jpg",
    "https://cdn.test/a.jpg",
  ]);
  assert.deepEqual(next, [
    "https://cdn.test/a.jpg",
    "https://cdn.test/b.jpg",
    "https://cdn.test/c.jpg",
  ]);
  assert.deepEqual(existing, ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"]);
});

test("product photos can be removed and reordered without mutation", () => {
  const images = ["a", "b", "c"].map((name) => `https://cdn.test/${name}.jpg`);
  const withoutB = removeProductImage(images, 1);
  assert.deepEqual(withoutB, [images[0], images[2]]);
  assert.deepEqual(images, [
    "https://cdn.test/a.jpg",
    "https://cdn.test/b.jpg",
    "https://cdn.test/c.jpg",
  ]);

  const moved = moveProductImage(images, 2, 0);
  assert.deepEqual(moved, [
    "https://cdn.test/c.jpg",
    "https://cdn.test/a.jpg",
    "https://cdn.test/b.jpg",
  ]);
  assert.deepEqual(setCoverProductImage(images, 1), [
    "https://cdn.test/b.jpg",
    "https://cdn.test/a.jpg",
    "https://cdn.test/c.jpg",
  ]);
  assert.deepEqual(moveProductImage(images, 0, 99), images);
});

test("money input accepts common vendor formats and rejects partial values", () => {
  assert.equal(parseMoneyInput("50,000"), 50000);
  assert.equal(parseMoneyInput("UGX 25,000"), 25000);
  assert.equal(parseMoneyInput(" 12 000 "), 12000);
  assert.equal(parseMoneyInput("25000.40"), 25000);
  assert.equal(parseMoneyInput(4100), 4100);
  assert.equal(parseMoneyInput(""), null);
  assert.equal(parseMoneyInput("12abc"), null);
  assert.equal(parseMoneyInput("-500"), null);
  assert.equal(parseMoneyInput("0"), 0);
});

test("quantity input only accepts whole numbers", () => {
  assert.equal(parseWholeInput("12"), 12);
  assert.equal(parseWholeInput("0"), 0);
  assert.equal(parseWholeInput(" 1,200 "), 1200);
  assert.equal(parseWholeInput("1.5"), null);
  assert.equal(parseWholeInput("two"), null);
  assert.equal(parseWholeInput(""), null);
});

test("transaction dates must be real and not in the future", () => {
  assert.equal(isValidEntryDate("2026-11-02", "2026-11-02"), true);
  assert.equal(isValidEntryDate("2026-10-31", "2026-11-02"), true);
  assert.equal(isValidEntryDate("2026-11-03", "2026-11-02"), false);
  assert.equal(isValidEntryDate("2026-02-30", "2026-11-02"), false);
  assert.equal(isValidEntryDate("", "2026-11-02"), false);
});

test("money entry validation catches the common mistakes", () => {
  const base = {
    amount: 50000,
    category: "Transport",
    entryDate: "2026-11-02",
    accountId: "cash",
    today: "2026-11-02",
  };
  assert.equal(validateMoneyEntry(base), null);
  assert.match(
    validateMoneyEntry({ ...base, amount: 0 }) ?? "",
    /greater than zero/i,
  );
  assert.match(
    validateMoneyEntry({ ...base, category: "   " }) ?? "",
    /category/i,
  );
  assert.match(
    validateMoneyEntry({ ...base, entryDate: "2026-12-01" }) ?? "",
    /date/i,
  );
  assert.match(
    validateMoneyEntry({ ...base, accountId: null, requireAccount: true }) ?? "",
    /account/i,
  );
});

test("customer contact validation is forgiving but catches typos", () => {
  assert.equal(isValidEmail(""), true);
  assert.equal(isValidEmail("sarah@example.com"), true);
  assert.equal(isValidEmail("sarah@example"), false);
  assert.equal(isValidPhone(""), true);
  assert.equal(isValidPhone("+256 700 123 456"), true);
  assert.equal(isValidPhone("123"), false);
});

test("technical database errors become readable messages", () => {
  assert.match(
    userMessage({ code: "23505", message: 'duplicate key value violates unique constraint "x"' }),
    /already exists/i,
  );
  assert.match(
    userMessage({
      code: "42501",
      message: "new row violates row-level security policy for table \"vendors\"",
    }),
    /permission/i,
  );
  assert.match(
    userMessage({ code: "PGRST205", message: "Could not find the table 'public.foo' in the schema cache" }),
    /isn't set up yet/i,
  );
  assert.match(userMessage(new Error("Failed to fetch")), /connection/i);
  assert.equal(
    userMessage("Not enough money in Cash. Available: UGX 5,000"),
    "Not enough money in Cash. Available: UGX 5,000",
  );
  assert.match(userMessage({ message: "unexpected internal failure at 0x00" }), /went wrong/i);
});

test("settlement payment status covers unpaid, partial and paid", () => {
  assert.equal(settlementPaymentStatus(0, 90000), "unpaid");
  assert.equal(settlementPaymentStatus(40000, 90000), "partial");
  assert.equal(settlementPaymentStatus(90000, 90000), "paid");
  assert.equal(settlementPaymentStatus(95000, 90000), "paid");
  assert.equal(settlementPaymentStatus(0, 0), "paid");
});

test("settlement type labels never mix customers and suppliers", () => {
  assert.equal(settlementTypeLabel("customer_collection"), "Customer collection");
  assert.equal(settlementTypeLabel("supplier_payment"), "Supplier payment");
});

test("settlement drafts support full, partial and multiple outstanding items", () => {
  const partial = validateSettlementDrafts([
    { id: "sale-1", outstanding: 50000, amount: "20,000" },
  ]);
  assert.equal(partial.ok, true);
  assert.equal(partial.total, 20000);
  assert.deepEqual(partial.allocations, [{ id: "sale-1", amount: 20000 }]);

  const multiple = validateSettlementDrafts([
    { id: "sale-1", outstanding: 50000, amount: "50000" },
    { id: "sale-2", outstanding: 45000, amount: "15000" },
    { id: "sale-3", outstanding: 30000, amount: "" },
  ]);
  assert.equal(multiple.ok, true);
  assert.equal(multiple.total, 65000);
  assert.equal(multiple.allocations.length, 2);

  const overpaid = validateSettlementDrafts([
    { id: "sale-1", outstanding: 50000, amount: "50001" },
  ]);
  assert.equal(overpaid.ok, false);
  assert.match(overpaid.error ?? "", /outstanding balance/i);

  const empty = validateSettlementDrafts([
    { id: "sale-1", outstanding: 50000, amount: "" },
  ]);
  assert.equal(empty.ok, false);
  assert.match(empty.error ?? "", /at least one/i);
});

test("settlement history filters by type, party, account and date", () => {
  const entry = {
    id: "payment-1",
    settlement_type: "customer_collection" as const,
    customer_id: "customer-1",
    party_name: "Nakato Sarah",
    amount: 40000,
    payment_method: "Cash",
    account_id: "acc-cash",
    account_name: "Main Cash Box",
    reference: "MM-8821",
    paid_on: "2026-11-03",
    created_at: "2026-11-03T10:00:00Z",
    status: "completed",
    allocations: [
      {
        sale_id: "sale-1",
        purchase_id: null,
        reference_no: "S-241102-0041",
        amount: 40000,
      },
    ],
  };

  assert.equal(matchesSettlementHistory(entry, {}), true);
  assert.equal(matchesSettlementHistory(entry, { type: "customer_collection" }), true);
  assert.equal(matchesSettlementHistory(entry, { type: "supplier_payment" }), false);
  assert.equal(matchesSettlementHistory(entry, { party: "Nakato Sarah" }), true);
  assert.equal(matchesSettlementHistory(entry, { party: "Kikuubo" }), false);
  assert.equal(matchesSettlementHistory(entry, { accountId: "acc-cash" }), true);
  assert.equal(matchesSettlementHistory(entry, { accountId: "acc-bank" }), false);
  assert.equal(matchesSettlementHistory(entry, { from: "2026-11-04" }), false);
  assert.equal(matchesSettlementHistory(entry, { to: "2026-11-03" }), true);
  assert.equal(matchesSettlementHistory(entry, { search: "S-241102" }), true);
  assert.equal(matchesSettlementHistory(entry, { search: "nobody" }), false);
});

test("settlements overview normalises outstanding balances and history", () => {
  const data = normalizeSettlementsOverview({
    customer_collections: [
      {
        customer_key: "id:customer-1",
        customer_id: "customer-1",
        customer_name: "Nakato Sarah",
        customer_phone: "+256700000001",
        outstanding: "95000",
        sale_count: 2,
        oldest_sale_date: "2026-10-21",
        last_payment_date: "2026-11-01",
      },
    ],
    customer_sales: [
      {
        id: "sale-1",
        order_no: "S-1",
        customer_id: "customer-1",
        customer_key: "id:customer-1",
        customer_name: "Nakato Sarah",
        customer_phone: null,
        sale_date: "2026-10-21",
        total: "90000",
        paid_amount: "40000",
        due_amount: "50000",
        status: "credit",
      },
    ],
    supplier_payables: [
      {
        supplier_key: "kikuubo",
        supplier_name: "Kikuubo",
        outstanding: "90000",
        purchase_count: 1,
        oldest_purchase_date: "2026-11-02",
        last_payment_date: null,
      },
    ],
    supplier_purchases: [
      {
        id: "purchase-1",
        reference_no: "P-1",
        supplier_key: "kikuubo",
        supplier_name: "Kikuubo",
        purchase_date: "2026-11-02",
        total_amount: "240000",
        paid_amount: "150000",
        due_amount: "90000",
        notes: null,
      },
    ],
    history: [
      {
        id: "payment-1",
        settlement_type: "customer_collection",
        customer_id: "customer-1",
        party_name: "Nakato Sarah",
        amount: "40000",
        payment_method: "Cash",
        account_id: "acc-cash",
        account_name: "Main Cash Box",
        reference: "MM-8821",
        paid_on: "2026-11-03",
        created_at: "2026-11-03T10:00:00Z",
        status: "completed",
        allocations: [
          { sale_id: "sale-1", purchase_id: null, reference_no: "S-1", amount: "40000" },
        ],
      },
    ],
    customer_outstanding: "95000",
    supplier_outstanding: "90000",
  });

  assert.equal(data.customerOutstanding, 95000);
  assert.equal(data.supplierOutstanding, 90000);
  assert.equal(data.customerCollections[0].outstanding, 95000);
  assert.equal(data.customerSales[0].due_amount, 50000);
  assert.equal(data.supplierPayables[0].outstanding, 90000);
  assert.equal(data.supplierPurchases[0].total_amount, 240000);
  assert.equal(data.history[0].amount, 40000);
  assert.equal(data.history[0].allocations[0].reference_no, "S-1");
});

test("auth redirects use the session marker without trusting it for access", () => {
  assert.equal(resolveAuthRedirect("/", false), "/login");
  assert.equal(resolveAuthRedirect("/", true), "/home");
  assert.equal(resolveAuthRedirect("/login", true), "/home");
  assert.equal(resolveAuthRedirect("/login/", true), "/home");
  assert.equal(resolveAuthRedirect("/signup", true), "/home");
  assert.equal(resolveAuthRedirect("/login", false), null);
  assert.equal(resolveAuthRedirect("/signup", false), null);
  assert.equal(resolveAuthRedirect("/home", false), null);
  assert.equal(resolveAuthRedirect("/stock", true), null);
});

test("session marker cookie is first-party, scoped and secure only on https", () => {
  const insecure = authMarkerCookie(false);
  assert.match(insecure, new RegExp(`^${AUTH_MARKER_COOKIE}=1;`));
  assert.match(insecure, /Path=\//);
  assert.match(insecure, /SameSite=Lax/);
  assert.doesNotMatch(insecure, /Secure/);

  const secure = authMarkerCookie(true);
  assert.match(secure, /; Secure$/);

  assert.match(clearAuthMarkerCookie(), /Max-Age=0/);
});

console.log(`\n${passed} unit tests passed`);
