import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { freshoSessionHeaders } from "@/lib/serverSession";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/chapter-exams/${params.id}`, {
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", ...freshoSessionHeaders(request) },
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("Chapter exam backend request failed:", error);
    return NextResponse.json({ error: "Chapter exam service is unavailable" }, { status: 502 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const response = await fetch(`${BACKEND_URL}/api/chapter-exams/${params.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(error, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error updating chapter exam:", error);
    return NextResponse.json({ error: "Failed to update chapter exam" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const headers: HeadersInit = {};
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

    const response = await fetch(`${BACKEND_URL}/api/chapter-exams/${params.id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(error, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error deleting chapter exam:", error);
    return NextResponse.json({ error: "Failed to delete chapter exam" }, { status: 500 });
  }
}
