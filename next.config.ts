import os from "node:os";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const devPort = process.env.PORT || "3000";

/** Every non-internal IPv4 address the laptop currently owns. */
function lanIPv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const details of Object.values(os.networkInterfaces())) {
    for (const detail of details ?? []) {
      if (detail.family === "IPv4" && !detail.internal) {
        addresses.push(detail.address);
      }
    }
  }
  return Array.from(new Set(addresses));
}

/** Accept `host`, `host:port`, or a full origin and keep the hostname. */
function parseOriginEntry(entry: string): { hostname: string; port: string } | null {
  const raw = entry.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `http://${raw}`);
    if (!url.hostname) return null;
    return { hostname: url.hostname, port: url.port };
  } catch {
    return null;
  }
}

// Optional comma-separated extras, e.g. DEV_ALLOWED_ORIGINS="my-laptop.local,10.0.0.7"
const extraOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(parseOriginEntry)
  .filter((entry): entry is { hostname: string; port: string } => entry !== null);

const lanHosts = lanIPv4Addresses();

const devHostnames = Array.from(
  new Set([
    "localhost",
    "127.0.0.1",
    ...lanHosts,
    ...extraOrigins.map((entry) => entry.hostname),
  ]),
);

// Server Actions compare the full host including the port, so the port is
// spelled out here. allowedDevOrigins ignores ports and only uses hostnames.
const serverActionOrigins = Array.from(
  new Set([
    ...["localhost", "127.0.0.1", ...lanHosts].map((hostname) => `${hostname}:${devPort}`),
    ...extraOrigins.map((entry) => `${entry.hostname}:${entry.port || devPort}`),
  ]),
);

const nextConfig: NextConfig = {
  ...(process.env.MOBILE_BUILD === "1"
    ? {
        // Capacitor needs a fully static bundle in `out/`. The normal
        // `npm run build` path stays server-capable so the web app is unchanged.
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  devIndicators: false,
  // Keep visited tab pages in the client router cache so switching back is
  // instant instead of refetching from the server on every tap.
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
    ...(isDev
      ? {
          // Server Actions are origin-checked. Accept actions from every
          // address this laptop has right now, so changing Wi-Fi/IP needs no
          // config edit - just restart the dev server.
          serverActions: {
            allowedOrigins: serverActionOrigins,
          },
        }
      : {}),
  },
  ...(isDev
    ? {
        // Allow the tablet to request dev assets/endpoints from the laptop
        // over Wi-Fi without hardcoding the laptop's current IP address.
        allowedDevOrigins: devHostnames,
      }
    : {}),
};

export default nextConfig;
