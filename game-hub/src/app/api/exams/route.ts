import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { freshoSessionHeaders } from "@/lib/serverSession";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || "mirkuz123";

const NO_CACHE = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
} as HeadersInit;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const backendParams = new URLSearchParams();
  const subject = searchParams.get("subject");
  const year = searchParams.get("year");
  if (subject) backendParams.append("subject", subject);
  if (year) backendParams.append("year", year);

  try {
    const response = await fetch(`${BACKEND_URL}/api/exams?${backendParams.toString()}`, {
      headers: { ...NO_CACHE, ...freshoSessionHeaders(request) },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Backend responded with ${response.status}`);
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error fetching exams:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const providedKey =
    request.headers.get("x-admin-key") ||
    request.headers.get("x-admin-secret") ||
    request.headers.get("x-admin-password") ||
    request.headers.get("X-Admin-Key") ||
    request.headers.get("X-Admin-Secret") ||
    request.headers.get("X-Admin-Password") || "";

  if (!ADMIN_SECRET || providedKey !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  const body = await request.json();
  try {
    const response = await fetch(`${BACKEND_URL}/api/exams`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": ADMIN_SECRET,
      } as HeadersInit,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(error, { status: response.status });
    }
    return NextResponse.json(await response.json(), { status: 201 });
  } catch (error) {
    console.error("Error creating exam:", error);
    return NextResponse.json({ error: "Failed to create exam" }, { status: 500 });
  }
}
