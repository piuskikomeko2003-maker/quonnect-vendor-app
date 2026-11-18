#!/usr/bin/env node
/**
 * Print the LAN URL a tablet/phone can use to reach the dev server.
 * Run before `next dev -H 0.0.0.0` (see the dev:lan script).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require("node:os");

const port = process.env.PORT || "3000";

function lanIPv4Addresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();

  // Prefer the usual Wi-Fi/Ethernet interfaces so the first line is the one
  // most people should type on the tablet.
  const preferred = ["en0", "en1", "wlan0", "eth0", "Wi-Fi", "Ethernet"];
  const names = Object.keys(interfaces).sort((a, b) => {
    const aIndex = preferred.indexOf(a);
    const bIndex = preferred.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  for (const name of names) {
    for (const detail of interfaces[name] || []) {
      if (detail.family === "IPv4" && !detail.internal) {
        addresses.push({ name, address: detail.address });
      }
    }
  }

  return addresses;
}

const addresses = lanIPv4Addresses();

console.log("");
if (addresses.length === 0) {
  console.log("No LAN IPv4 address found. Connect the laptop to Wi-Fi, then retry.");
  console.log(`Local URL: http://localhost:${port}`);
} else {
  console.log("Open this on the tablet (same Wi-Fi):");
  addresses.forEach(({ name, address }) => {
    console.log(`  http://${address}:${port}    (${name})`);
  });
  console.log("");
  console.log("If your laptop IP changes, stop the server and run `npm run dev:lan` again.");
}
console.log("");
