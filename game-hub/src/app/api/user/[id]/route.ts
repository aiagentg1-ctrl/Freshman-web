import { NextRequest, NextResponse } from "next/server";
import { freshoSessionHeaders } from "@/lib/serverSession";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/${params.id}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        ...freshoSessionHeaders(request),
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "User not found" }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...freshoSessionHeaders(request) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(error, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
