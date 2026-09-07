import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in `src/middleware.ts` (it mints a
// per-request script-src nonce, which a static header here cannot do). The
// remaining static security headers stay below.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Next 16 treats 127.0.0.1 as a different origin from localhost and
  // rejects the Turbopack HMR websocket (HTTP/0.9 / INVALID_HTTP_RESPONSE).
  // Playwright and many agents use http://127.0.0.1:3000; without this,
  // client islands never hydrate (Add to cart, qty stepper, Browse Catalogue).
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.50.45"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "*.utfs.io" },
      { protocol: "https", hostname: "*.ufs.sh" },
    ],
  },
  async headers() {
    return [
      {
        // Do not attach these to /_next/* (HMR websocket upgrade).
        source: "/:path((?!_next/).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
