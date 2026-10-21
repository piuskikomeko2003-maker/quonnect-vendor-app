import { chromium } from "@playwright/test";
import path from "node:path";
const out = path.resolve("docs/ui-checks");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

async function go(screen) {
  await page.goto(`http://localhost:3000/preview/${screen}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
}

await go("stock");
await page.getByRole("button", { name: /Register new item/ }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, "app-stock-product-sheet.png") });
await page.keyboard.press("Escape");

await go("sell");
await page.locator(".chip").first().click();
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(out, "app-sell-cart.png") });

await go("home");
await page.getByRole("button", { name: /See All/ }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, "app-home-all-transactions.png") });
await page.keyboard.press("Escape");

await go("stall");
await page.getByRole("button", { name: "Customise" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, "app-stall-customise.png") });
await page.keyboard.press("Escape");
await page.locator(".app-main").evaluate((element) => element.scrollTo(0, element.scrollHeight));
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, "app-stall-preview.png") });

await go("profile");
await page.getByRole("button", { name: /Edit profile/ }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(out, "app-profile-edit.png") });

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
