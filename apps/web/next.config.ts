import type { NextConfig } from "next";

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
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://connect-js.stripe.com https://*.posthog.com; connect-src 'self' https://api.stripe.com https://*.posthog.com https://api.resend.com; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; base-uri 'self'; form-action 'self';",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "3000-it8fbc5z29q5hjljqdaf7-21feb482.sg1.manus.computer",
    "*.sg1.manus.computer",
    "*.manus.computer",
  ],
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
