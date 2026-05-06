import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// 'unsafe-eval' is dev-only (Next.js HMR / React refresh). Production bundles do not require it.
// us-assets.i.posthog.com serves the PostHog array-loader assets; us.i.posthog.com is ingest.
// worker-src 'self' blob: is required for PostHog session-recording web workers.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev && "'unsafe-eval'",
  "https://js.stripe.com",
  "https://connect-js.stripe.com",
  "https://*.posthog.com",
  "https://us-assets.i.posthog.com",
]
  .filter(Boolean)
  .join(" ");

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "connect-src 'self' https://api.stripe.com https://*.posthog.com https://us-assets.i.posthog.com https://api.resend.com",
  "worker-src 'self' blob:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
    value: csp,
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
