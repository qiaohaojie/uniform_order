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

  // x-forwarded-for can be spoofed by the client on untrusted networks.
  // We intentionally do not fall back to it here; only x-real-ip and
  // cf-connecting-ip from known proxy layers are accepted.
  return null;
}

export function applyRateLimit(
  req: NextRequest,
  key: string,
  { limit, windowMs }: RateLimitOptions
) {
  const now = Date.now();
  const clientAddress = getClientAddress(req);
  const bucketKey = clientAddress ? `${key}:${clientAddress}` : key;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
  return null;
}
