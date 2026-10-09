import { NextRequest, NextResponse } from "next/server";

export const ADMIN_SECRET =
  process.env.ADMIN_SECRET || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || "";

export function requireAdminKey(request: NextRequest): NextResponse | null {
  if (!ADMIN_SECRET) {
    return NextResponse.json(
      { error: "Admin authentication is not configured on the server." },
      { status: 503 },
    );
  }

  const providedKey =
    request.headers.get("x-admin-key") ||
    request.headers.get("x-admin-secret") ||
    request.headers.get("x-admin-password") ||
    "";
  if (providedKey !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }
  return null;
}
