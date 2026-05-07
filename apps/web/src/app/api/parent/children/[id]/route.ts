import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { deleteChild, getChildById, updateChild } from "@/db/queries";

const ALLOWED_YEARS = new Set(["7", "8", "9", "10", "11", "12"]);

type RouteContext = { params: Promise<{ id: string }> };

async function loadOwnedChild(id: string, parentId: string) {
  const child = await getChildById(id);
  if (!child) return null;
  if (child.parentId !== parentId) return null;
  return child;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:patch:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
  if (rl) return rl;

  const { id } = await ctx.params;
  const child = await loadOwnedChild(id, auth.user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { name?: string; year?: string; rollClass?: string | null } = {};
  const b = body as Record<string, unknown>;

  if (b.name !== undefined) {
    if (typeof b.name !== "string") return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    const trimmed = b.name.trim();
    if (trimmed.length < 1 || trimmed.length > 60) {
      return NextResponse.json({ error: "name must be 1-60 characters" }, { status: 400 });
    }
    patch.name = trimmed;
  }

  if (b.year !== undefined) {
    if (typeof b.year !== "string" || !ALLOWED_YEARS.has(b.year.trim())) {
      return NextResponse.json({ error: "year must be one of 7..12" }, { status: 400 });
    }
    patch.year = b.year.trim();
  }

  if (b.rollClass !== undefined) {
    if (b.rollClass === null || (typeof b.rollClass === "string" && b.rollClass.trim().length === 0)) {
      patch.rollClass = null;
    } else if (typeof b.rollClass === "string" && b.rollClass.trim().length <= 20) {
      patch.rollClass = b.rollClass.trim();
    } else {
      return NextResponse.json({ error: "rollClass must be 0-20 characters" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const updated = await updateChild(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ child: updated });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:delete:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
  if (rl) return rl;

  const { id } = await ctx.params;
  const child = await loadOwnedChild(id, auth.user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteChild(id);
  return new NextResponse(null, { status: 204 });
}
