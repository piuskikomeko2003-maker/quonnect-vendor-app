#!/usr/bin/env node
// Point the Android WebView at the Next.js dev server on this Mac so edits
// show up live (HMR) instead of needing a rebuild + reinstall.
//
// Usage:
//   1. Terminal A: npm run dev:lan
//   2. Terminal B: npm run android:live
//
// To go back to the bundled offline build afterwards:
//   npm run build:mobile && npx cap sync android
import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";

const lan = Object.values(networkInterfaces())
  .flat()
  .find(
    (iface) =>
      iface &&
      iface.family === "IPv4" &&
      !iface.internal &&
      /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(iface.address),
  );

if (!lan) {
  console.error("No LAN IPv4 address found. Is Wi-Fi connected?");
  process.exit(1);
}

const url = `http://${lan.address}:${port}`;
console.log(`Live reload: ${url}`);
console.log("Make sure `npm run dev:lan` is running in another terminal.\n");

const child = spawn(
  "npx",
  ["cap", "run", "android", "--live-reload", "--host", lan.address, "--port", port],
  { stdio: "inherit" },
);

child.on("exit", (code) => process.exit(code ?? 0));
