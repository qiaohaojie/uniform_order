import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { confirmChild, getChildById } from "@/db/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  // Pre-auth: bucket by IP only. Generous; just a probe-defence.
  const preAuthRl = applyRateLimit(req, "parent-children:confirm:anon", { limit: 60, windowMs: 60_000 });
  if (preAuthRl) return preAuthRl;

  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:confirm:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
  if (rl) return rl;

  const { id } = await ctx.params;
  const child = await getChildById(id);
  if (!child || child.parentId !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await confirmChild(id);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ child: updated });
}
