import assert from "node:assert/strict";
import { formatUGX, shortMoney, addDays, clampDateRange } from "../src/lib/format";
import { effectivePrice } from "../src/lib/product";
import { niceStep, niceMax } from "../src/lib/chart";
import { whatsappNumber, receiptText } from "../src/lib/receipt";

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

test("custom charts are capped at 60 days", () => {
  const result = clampDateRange("2026-01-01", "2026-04-01", 60);
  assert.equal(result.to, "2026-04-01");
  assert.equal(result.from, addDays("2026-04-01", -59));
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

console.log(`\n${passed} unit tests passed`);
