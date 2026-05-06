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

  const trustedProxyIpHeaders = [
    req.headers.get("x-real-ip"),
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-forwarded-for"),
  ];

  const trustedProxyIp = trustedProxyIpHeaders.find((value) => value && value.trim().length > 0);
  if (trustedProxyIp) {
    return trustedProxyIp.split(",")[0]?.trim() ?? "unknown";
  }

  // x-forwarded-for can be client-controlled unless set by a trusted proxy.
  // Only trust it if x-real-ip or cf-connecting-ip was also present,
  // indicating we're behind a known proxy layer.
  if (trustedProxyIp) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0]?.trim() ?? null;
    }
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
