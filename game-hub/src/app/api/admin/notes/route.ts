import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || "mirkuz123";

function getProvidedKey(request: NextRequest): string {
  return (
    request.headers.get("x-admin-key") ||
    request.headers.get("x-admin-secret") ||
    request.headers.get("x-admin-password") ||
    request.headers.get("X-Admin-Key") ||
    request.headers.get("X-Admin-Secret") ||
    request.headers.get("X-Admin-Password") ||
    ""
  );
}

export async function GET(request: NextRequest) {
  const providedKey = getProvidedKey(request);
  if (!ADMIN_SECRET || providedKey !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  const url = new URL(request.url);
  const response = await fetch(`${BACKEND_URL}/api/admin/notes${url.search || ""}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": ADMIN_SECRET,
      "X-Admin-Key": ADMIN_SECRET,
      "X-Admin-Password": ADMIN_SECRET,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    try {
      return NextResponse.json(JSON.parse(text), { status: response.status });
    } catch {
      return NextResponse.json({ error: text || "Backend request failed" }, { status: response.status });
    }
  }

  try {
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
