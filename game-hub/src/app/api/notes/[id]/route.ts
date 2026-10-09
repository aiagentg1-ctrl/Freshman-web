import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { freshoSessionHeaders } from "@/lib/serverSession";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/notes/${params.id}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        ...freshoSessionHeaders(request),
      } as HeadersInit,
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Note not found" }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error fetching note:", error);
    return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 });
  }
}
