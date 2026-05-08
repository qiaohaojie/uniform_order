import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { createChild, getChildrenForParent, getPubliclyListedTenants } from "@/db/queries";

const ALLOWED_YEARS = new Set(["7", "8", "9", "10", "11", "12"]);

function validateName(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "name must be a string" };
  const trimmed = value.trim();
  if (trimmed.length < 1) return { ok: false, error: "name is required" };
  if (trimmed.length > 60) return { ok: false, error: "name must be 60 characters or fewer" };
  return { ok: true, value: trimmed };
}

function validateYear(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "year must be a string" };
  const trimmed = value.trim();
  if (!ALLOWED_YEARS.has(trimmed)) return { ok: false, error: "year must be one of 7..12" };
  return { ok: true, value: trimmed };
}

function validateRollClass(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "rollClass must be a string" };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > 20) return { ok: false, error: "rollClass must be 20 characters or fewer" };
  return { ok: true, value: trimmed };
}

// GET /api/parent/children — list children for the current user.
export async function GET(req: NextRequest) {
  // Pre-auth: bucket by IP only. Generous; just a probe-defence.
  const preAuthRl = applyRateLimit(req, "parent-children:get:anon", { limit: 200, windowMs: 60_000 });
  if (preAuthRl) return preAuthRl;

  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:get:${auth.user.id}`, { limit: 60, windowMs: 60_000 });
  if (rl) return rl;

  const children = await getChildrenForParent(auth.user.id);
  return NextResponse.json({ children });
}

// POST /api/parent/children — create a new saved child.
export async function POST(req: NextRequest) {
  // Pre-auth: bucket by IP only. Generous; just a probe-defence.
  const preAuthRl = applyRateLimit(req, "parent-children:post:anon", { limit: 60, windowMs: 60_000 });
  if (preAuthRl) return preAuthRl;

  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:post:${auth.user.id}`, { limit: 20, windowMs: 60_000 });
  if (rl) return rl;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nameRes = validateName((body as Record<string, unknown>).name);
  if (!nameRes.ok) return NextResponse.json({ error: nameRes.error }, { status: 400 });

  const yearRes = validateYear((body as Record<string, unknown>).year);
  if (!yearRes.ok) return NextResponse.json({ error: yearRes.error }, { status: 400 });

  const rollRes = validateRollClass((body as Record<string, unknown>).rollClass);
  if (!rollRes.ok) return NextResponse.json({ error: rollRes.error }, { status: 400 });

  const tenantId = (body as Record<string, unknown>).tenantId;
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const allowedTenants = await getPubliclyListedTenants();
  if (!allowedTenants.some((t) => t.id === tenantId)) {
    return NextResponse.json({ error: "tenantId must be a publicly-listed tenant" }, { status: 400 });
  }

  const child = await createChild({
    parentId: auth.user.id,
    tenantId,
    name: nameRes.value,
    year: yearRes.value,
    rollClass: rollRes.value,
  });

  return NextResponse.json({ child }, { status: 201 });
}
