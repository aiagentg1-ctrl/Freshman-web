import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:8000";
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || "mirkuz123";

export async function GET(request: NextRequest) {
  const providedKey =
    request.headers.get("x-admin-key") ||
    request.headers.get("x-admin-secret") ||
    request.headers.get("x-admin-password") ||
    "";

  if (!ADMIN_SECRET || providedKey !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/chapter-exams`, {
      headers: {
        "X-Admin-Secret": ADMIN_SECRET,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("Admin chapter questions request failed:", error);
    return NextResponse.json({ error: "Chapter questions service is unavailable" }, { status: 502 });
  }
}