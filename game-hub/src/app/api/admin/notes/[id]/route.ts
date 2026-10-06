import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_BASE_URL || "https://mirkuz-telegram-bot.onrender.com";
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

async function proxyToBackend(request: NextRequest, path: string) {
  const providedKey = getProvidedKey(request);
  if (!ADMIN_SECRET || providedKey !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  const method = request.method;
  const body = method === "GET" || method === "DELETE" ? undefined : await request.text();

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": ADMIN_SECRET,
      "X-Admin-Key": ADMIN_SECRET,
      "X-Admin-Password": ADMIN_SECRET,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    body,
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

  if (!text) {
    return new NextResponse(null, { status: 200 });
  }

  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
  });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToBackend(request, `/api/notes/${params.id}`);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToBackend(request, `/api/notes/${params.id}`);
}