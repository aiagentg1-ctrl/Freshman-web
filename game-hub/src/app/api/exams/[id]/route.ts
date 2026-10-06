import { NextRequest, NextResponse } from "next/server";
import { freshoSessionHeaders } from "@/lib/serverSession";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/exams/${params.id}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        ...freshoSessionHeaders(request),
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Exam not found" }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error fetching exam:", error);
    return NextResponse.json({ error: "Failed to fetch exam" }, { status: 500 });
  }
}
