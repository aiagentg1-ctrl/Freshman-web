import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:8000";

async function forward(request: NextRequest, method: "POST" | "DELETE") {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/device-session`, {
      method,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("Fresho device session request failed:", error);
    return NextResponse.json({ error: "Device session service is unavailable" }, { status: 502 });
  }
}

export function POST(request: NextRequest) {
  return forward(request, "POST");
}

export function DELETE(request: NextRequest) {
  return forward(request, "DELETE");
}