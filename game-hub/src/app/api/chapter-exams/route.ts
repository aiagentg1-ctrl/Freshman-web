import { NextRequest, NextResponse } from "next/server";
import { freshoSessionHeaders } from "@/lib/serverSession";

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const search = new URL(request.url).search;
  try {
    const response = await fetch(`${BACKEND_URL}/api/chapter-exams${search}`, {
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", ...freshoSessionHeaders(request) },
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("Chapter exams backend request failed:", error);
    return NextResponse.json({ error: "Chapter exams service is unavailable" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    // Forward admin headers if present
    if (request.headers.get("X-Admin-Secret")) {
      headers["X-Admin-Secret"] = request.headers.get("X-Admin-Secret")!;
    }
    if (request.headers.get("X-Admin-Key")) {
      headers["X-Admin-Key"] = request.headers.get("X-Admin-Key")!;
    }
    if (request.headers.get("X-Admin-Password")) {
      headers["X-Admin-Password"] = request.headers.get("X-Admin-Password")!;
    }

    const response = await fetch(`${BACKEND_URL}/api/chapter-exams`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(error, { status: response.status });
    }
    return NextResponse.json(await response.json(), { status: 201 });
  } catch (error) {
    console.error("Error creating chapter exam:", error);
    return NextResponse.json({ error: "Failed to create chapter exam" }, { status: 500 });
  }
}
