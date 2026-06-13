import { NextRequest, NextResponse } from "next/server";

// Per-request nonce CSP (issue #16). A static next.config header can't mint a
// per-request value, so the script-src nonce is issued here in middleware. Next
// reads `x-nonce` off the request headers and stamps it onto its framework +
// next/script tags automatically, which lets us drop blanket 'unsafe-inline'
// from script-src. style-src keeps 'unsafe-inline' (Tailwind/inline styles).
// Other static security headers (HSTS, nosniff, etc.) stay in next.config.ts.
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // 'unsafe-eval' is dev-only (Next HMR / React refresh); production never needs it.
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
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
    "connect-src 'self' https://api.stripe.com https://*.posthog.com https://us-assets.i.posthog.com https://api.resend.com https://utfs.io https://*.uploadthing.com",
    "worker-src 'self' blob:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  // Set the nonce + CSP on the REQUEST headers so Next can read the nonce when
  // rendering, and emit the same CSP on the RESPONSE so the browser enforces it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Run on HTML routes; skip static assets and the image optimizer (they don't
  // execute scripts and don't need a per-request nonce).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)",
  ],
};
