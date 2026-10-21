import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // Keep visited tab pages in the client router cache so switching back is
    // instant instead of refetching from the server on every tap.
    staleTimes: { dynamic: 30, static: 300 },
  },
};

export default nextConfig;
