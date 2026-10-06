import { NextRequest, NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || "mirkuz123";

export async function GET(request: NextRequest) {
  const key =
    request.headers.get("x-admin-key") ||
    request.headers.get("x-admin-secret") ||
    request.headers.get("X-Admin-Key") ||
    request.headers.get("X-Admin-Secret") ||
    request.headers.get("X-Admin-Password") ||
    request.headers.get("x-admin-password");

  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
