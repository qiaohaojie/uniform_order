import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

// NOTE: This rate limiter is in-memory and resets on cold starts.
// Not suitable for distributed or persistent rate-limit enforcement.
// On Hostinger's single Node.js app this works correctly; if we ever scale
// to multiple instances, swap this for a Redis or Upstash-backed limiter.
const buckets = new Map<string, Bucket>();

function getClientAddress(req: NextRequest) {
  const requestIp = (req as unknown as { ip?: string | null }).ip;
  if (requestIp && requestIp.trim().length > 0) {
    return requestIp.trim();
  }

  const trustedProxyIp =
    req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip");
  if (trustedProxyIp && trustedProxyIp.trim().length > 0) {
    return trustedProxyIp.trim();
  }

  // x-forwarded-for fallback. Exactly one trusted reverse proxy (Hostinger)
  // sits in front of the Node app, so the proxy APPENDS the real client IP as
  // the LAST entry. The FIRST entry is client-supplied and spoofable, so we
  // trust only the last hop. (On Cloudflare/Vercel you'd trust a different
  // index; this is correct for the single-trusted-proxy Hostinger topology.)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const lastHop = parts[parts.length - 1];
    if (lastHop) return lastHop;
  }

  return null;
}

export function applyRateLimit(
  req: NextRequest,
  key: string,
  { limit, windowMs }: RateLimitOptions
) {
  const now = Date.now();
  const clientAddress = getClientAddress(req);
  // Fail closed when no client IP is derivable: instead of collapsing every
  // anonymous caller into one shared, generously-limited global bucket (a DoS
  // amplification vector), route them to a distinct `:noip` bucket with a much
  // tighter limit. Authenticated callers pass a user-id-scoped `key` and keep
  // the full limit regardless of IP.
  const bucketKey = clientAddress ? `${key}:${clientAddress}` : `${key}:noip`;
  const effectiveLimit = clientAddress ? limit : Math.max(1, Math.floor(limit / 6));
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= effectiveLimit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(effectiveLimit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
  return null;
}
