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
  allowedDevOrigins: [
    "3000-it8fbc5z29q5hjljqdaf7-21feb482.sg1.manus.computer",
    "*.sg1.manus.computer",
    "*.manus.computer",
  ],
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
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
