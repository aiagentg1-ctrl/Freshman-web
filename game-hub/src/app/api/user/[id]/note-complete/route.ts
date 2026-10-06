import { NextRequest, NextResponse } from "next/server";
import { freshoSessionHeaders } from "@/lib/serverSession";

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  try {
    const response = await fetch(`${BACKEND_URL}/api/user/${params.id}/note-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...freshoSessionHeaders(request) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      console.error("Note completion failed:", error);
      return NextResponse.json(error, { status: response.status });
    }
    const responseData = await response.json();
    console.log("Note completed successfully:", responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error completing note:", error);
    return NextResponse.json({ error: "Failed to complete note" }, { status: 500 });
  }
}
