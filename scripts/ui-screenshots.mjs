import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const out = path.resolve("docs/ui-checks");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

const screens = ["home", "sell", "stock", "money", "analytics", "stall", "profile"];

for (const screen of screens) {
  await page.goto(`http://localhost:3000/preview/${screen}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(out, `app-${screen}.png`) });
}

const file = `file://${path.resolve("quonnect-vendor-app.html")}`;
for (const screen of screens) {
  await page.goto(file, { waitUntil: "load" });
  await page.evaluate((name) => {
    S = seed();
    S.account = { phone: "+256772000111", email: "amina@example.com", hash: "x" };
    S.profile = {
      vendorName: "Amina Nakato",
      businessName: "Amina Fashions",
      phone: "+256 772 000 111",
      phone2: "",
      email: "amina@example.com",
      category: "Fashion & clothing",
      location: "Owino Market, Kampala",
      motto: "Quality styles, fair prices",
      logo: null,
      instagram: "aminafashions",
      facebook: "AminaFashions",
      tiktok: "aminafashions",
      whatsapp: "+256772000111",
    };
    S.stall = { name: "Amina Fashions", tagline: "Quality styles, fair prices", color: "#0F8A4D" };
    S.loggedIn = true;
    tab = name;
    render();
  }, screen);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, `prototype-${screen}.png`) });
}

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(out, "app-login.png") });
await page.goto("http://localhost:3000/signup", { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(out, "app-signup.png") });

await page.goto(file, { waitUntil: "load" });
await page.evaluate(() => {
  S = seed();
  authMode = "login";
  render();
});
await page.screenshot({ path: path.join(out, "prototype-login.png") });
await page.evaluate(() => {
  S = seed();
  authMode = "signup";
  render();
});
await page.screenshot({ path: path.join(out, "prototype-signup.png") });

console.log(JSON.stringify({ errors, out }, null, 2));
await browser.close();
