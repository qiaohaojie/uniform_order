import { getAuth } from "@/lib/auth/server";
import type { NextRequest } from "next/server";

type AuthRouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: AuthRouteContext) {
  return getAuth().handler().GET(req, context);
}

export async function POST(req: NextRequest, context: AuthRouteContext) {
  return getAuth().handler().POST(req, context);
}
