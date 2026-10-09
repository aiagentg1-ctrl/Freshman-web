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

export function requireAdminKey(request: NextRequest): NextResponse | null {
  if (!ADMIN_SECRET || getProvidedKey(request) !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }
  return null;
}

export async function proxyAdminRequest(
  request: NextRequest,
  backendPath: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${backendPath}${url.search || ""}`;
  const response = await fetch(backendUrl, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": ADMIN_SECRET,
      "X-Admin-Key": ADMIN_SECRET,
      "X-Admin-Password": ADMIN_SECRET,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      ...(init?.headers || {}),
    },
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    cache: "no-store",
    ...init,
  });

  const text = await response.text();
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

  return new NextResponse(text, {
    status: response.status,
    headers,
  });
}
